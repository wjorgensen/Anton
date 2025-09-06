import { useEffect, useState, useCallback, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

interface NodeStatus {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'reviewing';
  progress?: number;
  output?: string;
  error?: string;
  timestamp: number;
}

interface PreviewData {
  nodeId: string;
  data: any;
  type: 'terminal' | 'web' | 'file' | 'logs';
  timestamp: number;
}

interface WebSocketHookResult {
  socket: Socket | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastConnectionTime: Date | null;
  nodeUpdates: Record<string, NodeStatus>;
  previewData: Record<string, PreviewData[]>;
  subscribeToExecution: (executionId: string) => void;
  subscribeToProject: (projectId: string) => void;
  subscribeToNode: (nodeId: string) => void;
  unsubscribeFromNode: (nodeId: string) => void;
  sendTerminalInput: (nodeId: string, input: string) => void;
  pauseFlow: (flowId: string) => void;
  resumeFlow: (flowId: string) => void;
  abortFlow: (flowId: string) => void;
  retryNode: (nodeId: string, flowId: string) => void;
  reconnect: () => void;
  clearError: () => void;
}

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3002';

export function useWebSocket(
  executionId?: string,
  authToken?: string
): WebSocketHookResult {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastConnectionTime, setLastConnectionTime] = useState<Date | null>(null);
  const [nodeUpdates, setNodeUpdates] = useState<Record<string, NodeStatus>>({});
  const [previewData, setPreviewData] = useState<Record<string, PreviewData[]>>({});
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const createConnection = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    setConnecting(true);
    setError(null);
    
    const newSocket = io(WEBSOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: authToken ? { token: authToken } : undefined,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected to', WEBSOCKET_URL);
      setConnected(true);
      setConnecting(false);
      setError(null);
      setLastConnectionTime(new Date());
      reconnectAttempts.current = 0;

      if (executionId) {
        newSocket.emit('subscribe:execution', executionId);
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setConnected(false);
      setConnecting(false);
      
      if (reason !== 'io client disconnect') {
        setError(`Connection lost: ${reason}`);
        
        // Attempt to reconnect after delay
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            console.log(`Reconnection attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`);
            newSocket.connect();
          } else {
            setError('Failed to reconnect: Maximum attempts exceeded');
          }
        }, delay);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
      setConnecting(false);
      setError(`Connection failed: ${error.message}`);
      
      reconnectAttempts.current++;
      
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        setError('Connection failed: Maximum attempts exceeded');
        newSocket.close();
      }
    });

    // Event listeners for real-time updates
    newSocket.on('node:update', (data: { nodeId: string; status: NodeStatus }) => {
      setNodeUpdates(prev => ({
        ...prev,
        [data.nodeId]: data.status
      }));
    });

    newSocket.on('preview:data', (data: PreviewData) => {
      setPreviewData(prev => ({
        ...prev,
        [data.nodeId]: [...(prev[data.nodeId] || []), data]
      }));
    });

    // Node lifecycle events
    newSocket.on('node:started', (data: any) => {
      setNodeUpdates(prev => ({
        ...prev,
        [data.nodeId]: {
          status: 'running',
          timestamp: Date.now()
        }
      }));
    });

    newSocket.on('node:completed', (data: any) => {
      setNodeUpdates(prev => ({
        ...prev,
        [data.nodeId]: {
          status: 'completed',
          output: data.output,
          timestamp: Date.now()
        }
      }));
    });

    newSocket.on('node:failed', (data: any) => {
      setNodeUpdates(prev => ({
        ...prev,
        [data.nodeId]: {
          status: 'failed',
          error: data.error,
          timestamp: Date.now()
        }
      }));
    });

    newSocket.on('node:review', (data: any) => {
      setNodeUpdates(prev => ({
        ...prev,
        [data.nodeId]: {
          status: 'reviewing',
          timestamp: Date.now()
        }
      }));
    });

    // Terminal and file events
    newSocket.on('terminal:output', (data: {
      nodeId: string;
      output: string;
      stream: 'stdout' | 'stderr';
      timestamp: number;
    }) => {
      setPreviewData(prev => ({
        ...prev,
        [data.nodeId]: [
          ...(prev[data.nodeId] || []),
          {
            nodeId: data.nodeId,
            data: {
              output: data.output,
              stream: data.stream
            },
            type: 'terminal',
            timestamp: data.timestamp
          }
        ]
      }));
    });

    newSocket.on('files:changed', (data: {
      nodeId: string;
      files: string[];
      timestamp: number;
    }) => {
      setPreviewData(prev => ({
        ...prev,
        [data.nodeId]: [
          ...(prev[data.nodeId] || []),
          {
            nodeId: data.nodeId,
            data: { files: data.files },
            type: 'file',
            timestamp: data.timestamp
          }
        ]
      }));
    });

    // Flow history replay
    newSocket.on('flow:history', (data: { flowId: string; events: any[] }) => {
      console.log('Received flow history:', data);
      data.events.forEach(event => {
        if (event.event === 'node:update' && event.nodeId) {
          setNodeUpdates(prev => ({
            ...prev,
            [event.nodeId]: event.status
          }));
        }
        if (event.event === 'preview:data' && event.nodeId) {
          setPreviewData(prev => ({
            ...prev,
            [event.nodeId]: [...(prev[event.nodeId] || []), {
              nodeId: event.nodeId,
              data: event.data,
              type: event.type,
              timestamp: event.timestamp
            }]
          }));
        }
      });
    });

    // Latency monitoring
    newSocket.on('pong', (data: { timestamp: number }) => {
      const latency = Date.now() - data.timestamp;
      console.log(`WebSocket latency: ${latency}ms`);
    });

    setSocket(newSocket);
    
    // Start ping interval for connection health monitoring
    const pingInterval = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit('ping');
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      newSocket.close();
    };
  }, [authToken]);

  // Initial connection and reconnection on execution change
  useEffect(() => {
    createConnection();
  }, [createConnection, executionId]);

  const subscribeToExecution = useCallback((execId: string) => {
    if (socket?.connected) {
      socket.emit('subscribe:execution', execId);
    }
  }, [socket]);

  const subscribeToProject = useCallback((projectId: string) => {
    if (socket?.connected) {
      socket.emit('subscribe:project', projectId);
    }
  }, [socket]);

  const subscribeToNode = useCallback((nodeId: string) => {
    if (socket?.connected) {
      socket.emit('subscribe:node', nodeId);
    }
  }, [socket]);

  const unsubscribeFromNode = useCallback((nodeId: string) => {
    if (socket?.connected) {
      socket.emit('unsubscribe:node', nodeId);
    }
  }, [socket]);

  const sendTerminalInput = useCallback((nodeId: string, input: string) => {
    if (socket?.connected) {
      socket.emit('terminal:input', { nodeId, input });
    }
  }, [socket]);

  const pauseFlow = useCallback((flowId: string) => {
    if (socket?.connected) {
      socket.emit('flow:pause', flowId);
    }
  }, [socket]);

  const resumeFlow = useCallback((flowId: string) => {
    if (socket?.connected) {
      socket.emit('flow:resume', flowId);
    }
  }, [socket]);

  const abortFlow = useCallback((flowId: string) => {
    if (socket?.connected) {
      socket.emit('flow:abort', flowId);
    }
  }, [socket]);

  const retryNode = useCallback((nodeId: string, flowId: string) => {
    if (socket?.connected) {
      socket.emit('node:retry', { nodeId, flowId });
    }
  }, [socket]);

  const reconnect = useCallback(() => {
    setError(null);
    reconnectAttempts.current = 0;
    if (socket) {
      socket.disconnect();
    }
    createConnection();
  }, [createConnection, socket]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    socket,
    connected,
    connecting,
    error,
    lastConnectionTime,
    nodeUpdates,
    previewData,
    subscribeToExecution,
    subscribeToProject,
    subscribeToNode,
    unsubscribeFromNode,
    sendTerminalInput,
    pauseFlow,
    resumeFlow,
    abortFlow,
    retryNode,
    reconnect,
    clearError
  };
}