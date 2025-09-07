import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { ClaudeMessage, StreamUpdate } from '../types';

interface StreamSession {
  id: string;
  type: 'planning' | 'execution';
  status: 'active' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  messages: ClaudeMessage[];
  subscribers: Set<string>;
}

export class ClaudeStreamManager extends EventEmitter {
  private static instance: ClaudeStreamManager;
  private sessions: Map<string, StreamSession> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map();

  private constructor() {
    super();
    this.setupCleanup();
  }

  static getInstance(): ClaudeStreamManager {
    if (!ClaudeStreamManager.instance) {
      ClaudeStreamManager.instance = new ClaudeStreamManager();
    }
    return ClaudeStreamManager.instance;
  }

  createSession(id: string, type: 'planning' | 'execution'): StreamSession {
    const session: StreamSession = {
      id,
      type,
      status: 'active',
      startTime: Date.now(),
      messages: [],
      subscribers: new Set()
    };
    
    this.sessions.set(id, session);
    logger.info(`Stream session created: ${id} (${type})`);
    
    return session;
  }

  addMessage(sessionId: string, message: ClaudeMessage) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Session not found: ${sessionId}`);
      return;
    }
    
    session.messages.push(message);
    
    // Parse and emit different types of messages
    this.processMessage(session, message);
  }

  private processMessage(session: StreamSession, message: ClaudeMessage) {
    const update: StreamUpdate = {
      type: session.type,
      sessionId: session.id,
      data: message
    };
    
    // Emit based on message type
    switch (message.type) {
      case 'system':
        if (message.subtype === 'init') {
          this.emit('session-init', {
            sessionId: session.id,
            tools: message.tools,
            model: message.model,
            cwd: message.cwd
          });
        }
        break;
        
      case 'assistant':
        if (message.message) {
          // Parse assistant messages for content
          const content = message.message.content;
          if (content) {
            this.emit('assistant-message', {
              sessionId: session.id,
              content,
              toolUse: message.message.tool_use
            });
          }
        }
        break;
        
      case 'user':
        // Tool results
        if (message.message?.content) {
          this.emit('tool-result', {
            sessionId: session.id,
            content: message.message.content
          });
        }
        break;
        
      case 'result':
        // Final result
        session.status = message.is_error ? 'failed' : 'completed';
        session.endTime = Date.now();
        this.emit('session-complete', {
          sessionId: session.id,
          success: !message.is_error,
          result: message.result,
          duration: message.duration_ms,
          cost: message.total_cost_usd
        });
        break;
    }
    
    // Emit raw stream update for subscribers
    if (session.type === 'planning') {
      this.emit('planning-stream', update);
    } else {
      this.emit('execution-stream', update);
    }
    
    // Notify specific node subscribers if this is a node execution
    if (update.nodeId) {
      this.emit('node-stream', {
        ...update,
        nodeId: update.nodeId
      });
    }
  }

  subscribe(channel: string, clientId: string) {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(clientId);
    
    // Add to session subscribers if it's a session channel
    const sessionId = this.extractSessionId(channel);
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.subscribers.add(clientId);
      }
    }
  }

  unsubscribe(channel: string, clientId: string) {
    const subscribers = this.subscriptions.get(channel);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.subscriptions.delete(channel);
      }
    }
    
    // Remove from session subscribers
    const sessionId = this.extractSessionId(channel);
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.subscribers.delete(clientId);
      }
    }
  }

  getStatus(sessionId: string): any {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { status: 'not_found' };
    }
    
    return {
      status: session.status,
      type: session.type,
      messageCount: session.messages.length,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.endTime ? session.endTime - session.startTime : Date.now() - session.startTime,
      subscriberCount: session.subscribers.size
    };
  }

  getSession(sessionId: string): StreamSession | undefined {
    return this.sessions.get(sessionId);
  }

  getMessages(sessionId: string, offset: number = 0, limit: number = 100): ClaudeMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    
    return session.messages.slice(offset, offset + limit);
  }

  completeSession(sessionId: string, success: boolean = true) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = success ? 'completed' : 'failed';
      session.endTime = Date.now();
      
      // Clean up after a delay to allow final messages
      setTimeout(() => {
        this.cleanupSession(sessionId);
      }, 60000); // Keep for 1 minute after completion
    }
  }

  private extractSessionId(channel: string): string | null {
    const parts = channel.split('-');
    if (parts.length >= 2) {
      return parts.slice(1).join('-');
    }
    return null;
  }

  private cleanupSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session && session.status !== 'active') {
      // Only cleanup if there are no active subscribers
      if (session.subscribers.size === 0) {
        this.sessions.delete(sessionId);
        logger.info(`Cleaned up session: ${sessionId}`);
      }
    }
  }

  private setupCleanup() {
    // Periodic cleanup of old sessions
    setInterval(() => {
      const now = Date.now();
      const maxAge = 3600000; // 1 hour
      
      for (const [sessionId, session] of this.sessions) {
        if (session.status !== 'active' && session.endTime) {
          if (now - session.endTime > maxAge && session.subscribers.size === 0) {
            this.sessions.delete(sessionId);
            logger.info(`Auto-cleaned session: ${sessionId}`);
          }
        }
      }
    }, 300000); // Run every 5 minutes
  }

  // Parse Claude streaming output to extract structured data
  parseClaudeOutput(output: string): ClaudeMessage[] {
    const messages: ClaudeMessage[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          messages.push(message);
        } catch (error) {
          // Not valid JSON, skip
        }
      }
    }
    
    return messages;
  }

  // Get summary statistics
  getStats() {
    const activeSessions = Array.from(this.sessions.values()).filter(s => s.status === 'active');
    const completedSessions = Array.from(this.sessions.values()).filter(s => s.status === 'completed');
    const failedSessions = Array.from(this.sessions.values()).filter(s => s.status === 'failed');
    
    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      completedSessions: completedSessions.length,
      failedSessions: failedSessions.length,
      totalSubscriptions: this.subscriptions.size,
      totalMessages: Array.from(this.sessions.values()).reduce((sum, s) => sum + s.messages.length, 0)
    };
  }
}