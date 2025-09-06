import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { EventEmitter } from 'events';
import { FlowExecutor } from '../core/FlowExecutor';
import { HookHandler } from '../hooks/HookHandler';
import { JobQueueManager } from '../queues/JobQueue';
import jwt from 'jsonwebtoken';

interface ClientInfo {
  userId: string;
  flowSubscriptions: Set<string>;
  nodeSubscriptions: Set<string>;
  role: 'admin' | 'developer' | 'viewer';
}

interface StreamOptions {
  flowId?: string;
  nodeId?: string;
  eventTypes?: string[];
  includeHistory?: boolean;
}

export class WebSocketService extends EventEmitter {
  private io: SocketIOServer;
  private clients: Map<string, ClientInfo> = new Map();
  private flowClients: Map<string, Set<string>> = new Map();
  private nodeClients: Map<string, Set<string>> = new Map();
  private eventHistory: Map<string, any[]> = new Map();
  private maxHistoryPerFlow: number = 100;

  constructor(
    httpServer: HTTPServer,
    jwtSecret: string,
    corsOrigin: string = '*'
  ) {
    super();

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: corsOrigin,
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });

    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        // Allow connections without authentication in development mode
        if (!token && process.env.NODE_ENV === 'development') {
          socket.data.userId = 'dev-user';
          socket.data.role = 'admin';
          console.log('Development mode: allowing unauthenticated connection');
          return next();
        }
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, jwtSecret) as any;
        socket.data.userId = decoded.userId;
        socket.data.role = decoded.role || 'viewer';
        
        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });

    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      const clientInfo: ClientInfo = {
        userId: socket.data.userId,
        flowSubscriptions: new Set(),
        nodeSubscriptions: new Set(),
        role: socket.data.role
      };

      this.clients.set(socket.id, clientInfo);
      console.log(`Client ${socket.id} connected (user: ${clientInfo.userId})`);

      socket.on('subscribe:flow', (flowId: string) => {
        this.subscribeToFlow(socket, flowId);
      });

      socket.on('unsubscribe:flow', (flowId: string) => {
        this.unsubscribeFromFlow(socket, flowId);
      });

      socket.on('subscribe:project', (projectId: string) => {
        socket.join(`project:${projectId}`);
        socket.emit('subscribed:project', { projectId });
        console.log(`Client ${socket.id} subscribed to project ${projectId}`);
      });

      socket.on('subscribe:execution', (executionId: string) => {
        socket.join(`execution:${executionId}`);
        socket.emit('subscribed:execution', { executionId });
        console.log(`Client ${socket.id} subscribed to execution ${executionId}`);
      });

      socket.on('subscribe:node', (nodeId: string) => {
        this.subscribeToNode(socket, nodeId);
      });

      socket.on('unsubscribe:node', (nodeId: string) => {
        this.unsubscribeFromNode(socket, nodeId);
      });

      socket.on('stream:start', (options: StreamOptions) => {
        this.startStreaming(socket, options);
      });

      socket.on('stream:stop', () => {
        this.stopStreaming(socket);
      });

      socket.on('flow:pause', (flowId: string) => {
        if (clientInfo.role === 'admin' || clientInfo.role === 'developer') {
          this.emit('flow:pause', { flowId, userId: clientInfo.userId });
        }
      });

      socket.on('flow:resume', (flowId: string) => {
        if (clientInfo.role === 'admin' || clientInfo.role === 'developer') {
          this.emit('flow:resume', { flowId, userId: clientInfo.userId });
        }
      });

      socket.on('flow:abort', (flowId: string) => {
        if (clientInfo.role === 'admin') {
          this.emit('flow:abort', { flowId, userId: clientInfo.userId });
        }
      });

      socket.on('node:retry', ({ nodeId, flowId }) => {
        if (clientInfo.role === 'admin' || clientInfo.role === 'developer') {
          this.emit('node:retry', { nodeId, flowId, userId: clientInfo.userId });
        }
      });

      socket.on('terminal:input', ({ nodeId, input }) => {
        this.emit('terminal:input', { nodeId, input, socketId: socket.id });
      });

      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private subscribeToFlow(socket: Socket, flowId: string): void {
    const clientInfo = this.clients.get(socket.id);
    if (!clientInfo) return;

    clientInfo.flowSubscriptions.add(flowId);
    socket.join(`flow:${flowId}`);

    if (!this.flowClients.has(flowId)) {
      this.flowClients.set(flowId, new Set());
    }
    this.flowClients.get(flowId)!.add(socket.id);

    const history = this.eventHistory.get(flowId);
    if (history && history.length > 0) {
      socket.emit('flow:history', { flowId, events: history });
    }

    socket.emit('subscribed:flow', { flowId });
    console.log(`Client ${socket.id} subscribed to flow ${flowId}`);
  }

  private unsubscribeFromFlow(socket: Socket, flowId: string): void {
    const clientInfo = this.clients.get(socket.id);
    if (!clientInfo) return;

    clientInfo.flowSubscriptions.delete(flowId);
    socket.leave(`flow:${flowId}`);

    const flowClientSet = this.flowClients.get(flowId);
    if (flowClientSet) {
      flowClientSet.delete(socket.id);
      if (flowClientSet.size === 0) {
        this.flowClients.delete(flowId);
      }
    }

    socket.emit('unsubscribed:flow', { flowId });
    console.log(`Client ${socket.id} unsubscribed from flow ${flowId}`);
  }

  private subscribeToNode(socket: Socket, nodeId: string): void {
    const clientInfo = this.clients.get(socket.id);
    if (!clientInfo) return;

    clientInfo.nodeSubscriptions.add(nodeId);
    socket.join(`node:${nodeId}`);

    if (!this.nodeClients.has(nodeId)) {
      this.nodeClients.set(nodeId, new Set());
    }
    this.nodeClients.get(nodeId)!.add(socket.id);

    socket.emit('subscribed:node', { nodeId });
    console.log(`Client ${socket.id} subscribed to node ${nodeId}`);
  }

  private unsubscribeFromNode(socket: Socket, nodeId: string): void {
    const clientInfo = this.clients.get(socket.id);
    if (!clientInfo) return;

    clientInfo.nodeSubscriptions.delete(nodeId);
    socket.leave(`node:${nodeId}`);

    const nodeClientSet = this.nodeClients.get(nodeId);
    if (nodeClientSet) {
      nodeClientSet.delete(socket.id);
      if (nodeClientSet.size === 0) {
        this.nodeClients.delete(nodeId);
      }
    }

    socket.emit('unsubscribed:node', { nodeId });
    console.log(`Client ${socket.id} unsubscribed from node ${nodeId}`);
  }

  private startStreaming(socket: Socket, options: StreamOptions): void {
    socket.data.streaming = true;
    socket.data.streamOptions = options;

    if (options.flowId) {
      this.subscribeToFlow(socket, options.flowId);
    }

    if (options.nodeId) {
      this.subscribeToNode(socket, options.nodeId);
    }

    socket.emit('stream:started', options);
  }

  private stopStreaming(socket: Socket): void {
    socket.data.streaming = false;
    socket.data.streamOptions = null;

    socket.emit('stream:stopped');
  }

  private handleDisconnect(socket: Socket): void {
    const clientInfo = this.clients.get(socket.id);
    if (!clientInfo) return;

    for (const flowId of clientInfo.flowSubscriptions) {
      this.unsubscribeFromFlow(socket, flowId);
    }

    for (const nodeId of clientInfo.nodeSubscriptions) {
      this.unsubscribeFromNode(socket, nodeId);
    }

    this.clients.delete(socket.id);
    console.log(`Client ${socket.id} disconnected`);
  }

  broadcastFlowEvent(flowId: string, event: string, data: any): void {
    this.io.to(`flow:${flowId}`).emit(event, { flowId, ...data });
    
    this.addToHistory(flowId, { event, data, timestamp: Date.now() });
  }

  broadcastNodeEvent(nodeId: string, event: string, data: any): void {
    this.io.to(`node:${nodeId}`).emit(event, { nodeId, ...data });
  }

  broadcastToAll(event: string, data: any): void {
    this.io.emit(event, data);
  }

  sendToClient(socketId: string, event: string, data: any): void {
    this.io.to(socketId).emit(event, data);
  }

  streamTerminalOutput(nodeId: string, output: string, stream: 'stdout' | 'stderr'): void {
    this.io.to(`node:${nodeId}`).emit('terminal:output', {
      nodeId,
      output,
      stream,
      timestamp: Date.now()
    });
  }

  streamFileChange(nodeId: string, files: string[]): void {
    this.io.to(`node:${nodeId}`).emit('files:changed', {
      nodeId,
      files,
      timestamp: Date.now()
    });
  }

  streamMetrics(flowId: string, metrics: any): void {
    this.io.to(`flow:${flowId}`).emit('metrics:update', {
      flowId,
      metrics,
      timestamp: Date.now()
    });
  }

  emitNodeUpdate(executionId: string, nodeId: string, status: any): void {
    this.io.to(`execution:${executionId}`).emit('node:update', {
      nodeId,
      status,
      timestamp: Date.now()
    });
    
    this.io.to(`node:${nodeId}`).emit('node:update', {
      nodeId,
      status,
      timestamp: Date.now()
    });
    
    this.addToHistory(executionId, {
      event: 'node:update',
      nodeId,
      status,
      timestamp: Date.now()
    });
  }

  emitPreviewData(executionId: string, nodeId: string, data: any): void {
    const previewData = {
      nodeId,
      data,
      type: data.type || 'terminal',
      timestamp: Date.now()
    };
    
    this.io.to(`execution:${executionId}`).emit('preview:data', previewData);
    this.io.to(`node:${nodeId}`).emit('preview:data', previewData);
    
    this.addToHistory(executionId, {
      event: 'preview:data',
      ...previewData
    });
  }

  private addToHistory(flowId: string, event: any): void {
    if (!this.eventHistory.has(flowId)) {
      this.eventHistory.set(flowId, []);
    }

    const history = this.eventHistory.get(flowId)!;
    history.push(event);

    if (history.length > this.maxHistoryPerFlow) {
      history.shift();
    }
  }

  attachToExecutor(executor: FlowExecutor, flowId: string): void {
    executor.on('flow:started', (data) => {
      this.broadcastFlowEvent(flowId, 'flow:started', data);
    });

    executor.on('flow:completed', (data) => {
      this.broadcastFlowEvent(flowId, 'flow:completed', data);
    });

    executor.on('flow:failed', (data) => {
      this.broadcastFlowEvent(flowId, 'flow:failed', data);
    });

    executor.on('node:started', (data) => {
      this.broadcastFlowEvent(flowId, 'node:started', data);
      this.broadcastNodeEvent(data.nodeId, 'node:started', data);
    });

    executor.on('node:completed', (data) => {
      this.broadcastFlowEvent(flowId, 'node:completed', data);
      this.broadcastNodeEvent(data.nodeId, 'node:completed', data);
    });

    executor.on('node:failed', (data) => {
      this.broadcastFlowEvent(flowId, 'node:failed', data);
      this.broadcastNodeEvent(data.nodeId, 'node:failed', data);
    });

    executor.on('node:retry', (data) => {
      this.broadcastFlowEvent(flowId, 'node:retry', data);
      this.broadcastNodeEvent(data.nodeId, 'node:retry', data);
    });

    executor.on('node:review', (data) => {
      this.broadcastFlowEvent(flowId, 'node:review', data);
      this.broadcastNodeEvent(data.nodeId, 'node:review', data);
    });

    executor.on('agent:output', (data) => {
      this.streamTerminalOutput(data.nodeId, data.output, data.stream);
    });
  }

  attachToHookHandler(hookHandler: HookHandler): void {
    hookHandler.on('hook:stop', (event) => {
      this.broadcastNodeEvent(event.nodeId, 'hook:stop', event);
    });

    hookHandler.on('hook:error', (event) => {
      this.broadcastNodeEvent(event.nodeId, 'hook:error', event);
    });

    hookHandler.on('hook:checkpoint', (event) => {
      this.broadcastNodeEvent(event.nodeId, 'hook:checkpoint', event);
    });

    hookHandler.on('hook:fileChange', (data) => {
      this.streamFileChange(data.nodeId, data.files);
    });
  }

  attachToJobQueue(jobQueue: JobQueueManager): void {
    jobQueue.on('flow:queued', (data) => {
      this.broadcastFlowEvent(data.flowId, 'flow:queued', data);
    });

    jobQueue.on('flow:progress', (data) => {
      this.broadcastFlowEvent(data.flowId, 'flow:progress', data.progress);
    });

    jobQueue.on('node:queued', (data) => {
      this.broadcastNodeEvent(data.nodeId, 'node:queued', data);
    });

    jobQueue.on('node:active', (data) => {
      this.broadcastNodeEvent(data.nodeId, 'node:active', data);
    });
  }

  getStats(): {
    connectedClients: number;
    activeFlows: number;
    activeNodes: number;
    totalSubscriptions: number;
  } {
    let totalSubscriptions = 0;
    
    for (const client of this.clients.values()) {
      totalSubscriptions += client.flowSubscriptions.size + client.nodeSubscriptions.size;
    }

    return {
      connectedClients: this.clients.size,
      activeFlows: this.flowClients.size,
      activeNodes: this.nodeClients.size,
      totalSubscriptions
    };
  }

  clearHistory(flowId?: string): void {
    if (flowId) {
      this.eventHistory.delete(flowId);
    } else {
      this.eventHistory.clear();
    }
  }

  close(): void {
    this.io.close();
  }
}