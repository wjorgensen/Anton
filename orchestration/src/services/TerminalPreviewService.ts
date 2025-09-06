import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { Terminal } from '@xterm/headless';
import { WebSocketService } from './WebSocketService';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

interface TerminalSession {
  terminal: Terminal;
  tailProcess?: ChildProcessWithoutNullStreams;
  buffer: string[];
  maxBufferSize: number;
  lastActivity: number;
  executionId: string;
  nodeId: string;
}

interface BufferOptions {
  maxLines?: number;
  maxSizeBytes?: number;
  flushInterval?: number;
}

export class TerminalPreviewService extends EventEmitter {
  private terminals = new Map<string, TerminalSession>();
  private websocket: WebSocketService;
  private bufferOptions: Required<BufferOptions>;
  private flushTimer?: NodeJS.Timer;
  private outputPath: string;
  
  constructor(
    websocket: WebSocketService,
    outputPath: string = '/projects',
    bufferOptions: BufferOptions = {}
  ) {
    super();
    this.websocket = websocket;
    this.outputPath = outputPath;
    this.bufferOptions = {
      maxLines: bufferOptions.maxLines || 1000,
      maxSizeBytes: bufferOptions.maxSizeBytes || 1024 * 1024, // 1MB default
      flushInterval: bufferOptions.flushInterval || 100 // 100ms default
    };
    
    this.startFlushTimer();
  }
  
  createTerminal(nodeId: string, executionId: string): Terminal {
    if (this.terminals.has(nodeId)) {
      this.closeTerminal(nodeId);
    }
    
    const terminal = new Terminal({
      cols: 80,
      rows: 24,
      scrollback: 1000
    });
    
    const session: TerminalSession = {
      terminal,
      buffer: [],
      maxBufferSize: this.bufferOptions.maxLines,
      lastActivity: Date.now(),
      executionId,
      nodeId
    };
    
    this.terminals.set(nodeId, session);
    
    // Hook into Claude output via tail -f
    this.attachToClaudeOutput(nodeId, executionId);
    
    // Set up terminal write handler
    terminal.onData((data) => {
      this.bufferOutput(nodeId, data);
    });
    
    console.log(`Created terminal for node ${nodeId}, execution ${executionId}`);
    
    return terminal;
  }
  
  private attachToClaudeOutput(nodeId: string, executionId: string): void {
    const session = this.terminals.get(nodeId);
    if (!session) return;
    
    const outputPath = path.join(this.outputPath, executionId, nodeId, 'output.log');
    const errorPath = path.join(this.outputPath, executionId, nodeId, 'error.log');
    
    // Check if file exists, create if not
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Touch files to ensure they exist
    if (!fs.existsSync(outputPath)) {
      fs.writeFileSync(outputPath, '');
    }
    if (!fs.existsSync(errorPath)) {
      fs.writeFileSync(errorPath, '');
    }
    
    // Use tail -f to follow the output file
    const tail = spawn('tail', ['-f', '-n', '0', outputPath]);
    session.tailProcess = tail;
    
    tail.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      session.terminal.write(text);
      
      // Stream to WebSocket with ANSI preservation
      this.websocket.emitPreviewData(executionId, nodeId, {
        type: 'terminal',
        content: text,
        ansi: true,
        stream: 'stdout',
        timestamp: Date.now()
      });
      
      // Update activity timestamp
      session.lastActivity = Date.now();
    });
    
    tail.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      session.terminal.write(`\x1b[31m${text}\x1b[0m`); // Red color for errors
      
      this.websocket.emitPreviewData(executionId, nodeId, {
        type: 'terminal',
        content: text,
        ansi: true,
        stream: 'stderr',
        timestamp: Date.now()
      });
      
      session.lastActivity = Date.now();
    });
    
    tail.on('error', (error) => {
      console.error(`Tail process error for node ${nodeId}:`, error);
      this.emit('error', { nodeId, error: error.message });
    });
    
    tail.on('exit', (code) => {
      console.log(`Tail process exited for node ${nodeId} with code ${code}`);
    });
    
    // Also tail the error log
    const errorTail = spawn('tail', ['-f', '-n', '0', errorPath]);
    
    errorTail.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      session.terminal.write(`\x1b[31m${text}\x1b[0m`);
      
      this.websocket.emitPreviewData(executionId, nodeId, {
        type: 'terminal',
        content: text,
        ansi: true,
        stream: 'stderr',
        timestamp: Date.now()
      });
    });
  }
  
  private bufferOutput(nodeId: string, data: string): void {
    const session = this.terminals.get(nodeId);
    if (!session) return;
    
    session.buffer.push(data);
    
    // Check buffer limits
    if (session.buffer.length > session.maxBufferSize) {
      this.flushBuffer(nodeId);
    }
    
    // Calculate buffer size in bytes
    const bufferSize = session.buffer.reduce((size, str) => size + str.length, 0);
    if (bufferSize > this.bufferOptions.maxSizeBytes) {
      this.flushBuffer(nodeId);
    }
  }
  
  private flushBuffer(nodeId: string): void {
    const session = this.terminals.get(nodeId);
    if (!session || session.buffer.length === 0) return;
    
    const content = session.buffer.join('');
    session.buffer = [];
    
    this.websocket.emitPreviewData(session.executionId, nodeId, {
      type: 'terminal',
      content,
      ansi: true,
      buffered: true,
      timestamp: Date.now()
    });
  }
  
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      for (const [nodeId, session] of this.terminals.entries()) {
        if (session.buffer.length > 0) {
          this.flushBuffer(nodeId);
        }
        
        // Clean up inactive terminals (no activity for 30 minutes)
        const inactiveTime = Date.now() - session.lastActivity;
        if (inactiveTime > 30 * 60 * 1000) {
          console.log(`Cleaning up inactive terminal for node ${nodeId}`);
          this.closeTerminal(nodeId);
        }
      }
    }, this.bufferOptions.flushInterval);
  }
  
  writeToTerminal(nodeId: string, data: string): void {
    const session = this.terminals.get(nodeId);
    if (!session) return;
    
    session.terminal.write(data);
    this.bufferOutput(nodeId, data);
    session.lastActivity = Date.now();
  }
  
  clearTerminal(nodeId: string): void {
    const session = this.terminals.get(nodeId);
    if (!session) return;
    
    session.terminal.clear();
    session.buffer = [];
    
    this.websocket.emitPreviewData(session.executionId, nodeId, {
      type: 'terminal',
      action: 'clear',
      timestamp: Date.now()
    });
  }
  
  resizeTerminal(nodeId: string, cols: number, rows: number): void {
    const session = this.terminals.get(nodeId);
    if (!session) return;
    
    session.terminal.resize(cols, rows);
    
    this.websocket.emitPreviewData(session.executionId, nodeId, {
      type: 'terminal',
      action: 'resize',
      cols,
      rows,
      timestamp: Date.now()
    });
  }
  
  getTerminalContent(nodeId: string): string | null {
    const session = this.terminals.get(nodeId);
    if (!session) return null;
    
    const buffer: string[] = [];
    const terminal = session.terminal;
    
    for (let i = 0; i < terminal.rows; i++) {
      const line = terminal.buffer.active.getLine(i);
      if (line) {
        buffer.push(line.translateToString());
      }
    }
    
    return buffer.join('\n');
  }
  
  closeTerminal(nodeId: string): void {
    const session = this.terminals.get(nodeId);
    if (!session) return;
    
    // Flush any remaining buffer
    this.flushBuffer(nodeId);
    
    // Kill tail process if exists
    if (session.tailProcess) {
      session.tailProcess.kill();
    }
    
    // Dispose terminal
    session.terminal.dispose();
    
    // Remove from map
    this.terminals.delete(nodeId);
    
    console.log(`Closed terminal for node ${nodeId}`);
    
    this.websocket.emitPreviewData(session.executionId, nodeId, {
      type: 'terminal',
      action: 'close',
      timestamp: Date.now()
    });
  }
  
  closeAllTerminals(): void {
    for (const nodeId of this.terminals.keys()) {
      this.closeTerminal(nodeId);
    }
  }
  
  getStats(): {
    activeTerminals: number;
    totalBufferedBytes: number;
    terminals: Array<{
      nodeId: string;
      executionId: string;
      bufferSize: number;
      lastActivity: number;
    }>;
  } {
    const terminals: Array<{
      nodeId: string;
      executionId: string;
      bufferSize: number;
      lastActivity: number;
    }> = [];
    
    let totalBufferedBytes = 0;
    
    for (const [nodeId, session] of this.terminals.entries()) {
      const bufferSize = session.buffer.reduce((size, str) => size + str.length, 0);
      totalBufferedBytes += bufferSize;
      
      terminals.push({
        nodeId,
        executionId: session.executionId,
        bufferSize,
        lastActivity: session.lastActivity
      });
    }
    
    return {
      activeTerminals: this.terminals.size,
      totalBufferedBytes,
      terminals
    };
  }
  
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.closeAllTerminals();
    this.removeAllListeners();
  }
}