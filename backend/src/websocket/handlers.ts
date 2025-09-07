import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger';
import { ClaudeStreamManager } from '../services/ClaudeStreamManager';
import { v4 as uuidv4 } from 'uuid';

interface WSClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  sessionId?: string;
  executionId?: string;
}

export function setupWebSocketHandlers(
  wss: WebSocketServer,
  streamManager: ClaudeStreamManager
) {
  const clients = new Map<string, WSClient>();

  wss.on('connection', (ws: WebSocket, req) => {
    const clientId = uuidv4();
    const client: WSClient = {
      id: clientId,
      ws,
      subscriptions: new Set()
    };
    
    clients.set(clientId, client);
    logger.info(`WebSocket client connected: ${clientId}`);
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connection',
      clientId,
      message: 'Connected to Anton Backend WebSocket'
    }));
    
    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(client, message, streamManager);
      } catch (error) {
        logger.error('Failed to parse WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format'
        }));
      }
    });
    
    // Handle client disconnect
    ws.on('close', () => {
      clients.delete(clientId);
      // Unsubscribe from all streams
      for (const subscription of client.subscriptions) {
        streamManager.unsubscribe(subscription, clientId);
      }
      logger.info(`WebSocket client disconnected: ${clientId}`);
    });
    
    // Handle errors
    ws.on('error', (error) => {
      logger.error(`WebSocket error for client ${clientId}:`, error);
    });
    
    // Ping/pong for keepalive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
    
    ws.on('pong', () => {
      // Client is alive
    });
  });
  
  // Subscribe to stream manager events
  streamManager.on('planning-stream', (data) => {
    broadcastToSubscribers(clients, 'planning', data);
  });
  
  streamManager.on('execution-stream', (data) => {
    broadcastToSubscribers(clients, 'execution', data);
  });
  
  streamManager.on('node-stream', (data) => {
    broadcastToSubscribers(clients, `node-${data.nodeId}`, data);
  });
  
  return wss;
}

function handleClientMessage(
  client: WSClient,
  message: any,
  streamManager: ClaudeStreamManager
) {
  const { ws } = client;
  
  switch (message.type) {
    case 'subscribe':
      handleSubscribe(client, message, streamManager);
      break;
      
    case 'unsubscribe':
      handleUnsubscribe(client, message, streamManager);
      break;
      
    case 'get-status':
      handleGetStatus(client, message, streamManager);
      break;
      
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;
      
    default:
      ws.send(JSON.stringify({
        type: 'error',
        error: `Unknown message type: ${message.type}`
      }));
  }
}

function handleSubscribe(
  client: WSClient,
  message: any,
  streamManager: ClaudeStreamManager
) {
  const { channel, sessionId, executionId, nodeId } = message;
  
  let subscriptionKey = '';
  
  switch (channel) {
    case 'planning':
      if (!sessionId) {
        client.ws.send(JSON.stringify({
          type: 'error',
          error: 'sessionId required for planning subscription'
        }));
        return;
      }
      subscriptionKey = `planning-${sessionId}`;
      client.sessionId = sessionId;
      break;
      
    case 'execution':
      if (!executionId) {
        client.ws.send(JSON.stringify({
          type: 'error',
          error: 'executionId required for execution subscription'
        }));
        return;
      }
      subscriptionKey = `execution-${executionId}`;
      client.executionId = executionId;
      break;
      
    case 'node':
      if (!nodeId) {
        client.ws.send(JSON.stringify({
          type: 'error',
          error: 'nodeId required for node subscription'
        }));
        return;
      }
      subscriptionKey = `node-${nodeId}`;
      break;
      
    default:
      client.ws.send(JSON.stringify({
        type: 'error',
        error: `Unknown channel: ${channel}`
      }));
      return;
  }
  
  client.subscriptions.add(subscriptionKey);
  streamManager.subscribe(subscriptionKey, client.id);
  
  client.ws.send(JSON.stringify({
    type: 'subscribed',
    channel,
    subscriptionKey
  }));
  
  logger.info(`Client ${client.id} subscribed to ${subscriptionKey}`);
}

function handleUnsubscribe(
  client: WSClient,
  message: any,
  streamManager: ClaudeStreamManager
) {
  const { channel, subscriptionKey } = message;
  
  if (subscriptionKey && client.subscriptions.has(subscriptionKey)) {
    client.subscriptions.delete(subscriptionKey);
    streamManager.unsubscribe(subscriptionKey, client.id);
    
    client.ws.send(JSON.stringify({
      type: 'unsubscribed',
      subscriptionKey
    }));
    
    logger.info(`Client ${client.id} unsubscribed from ${subscriptionKey}`);
  } else {
    client.ws.send(JSON.stringify({
      type: 'error',
      error: 'Invalid subscription key'
    }));
  }
}

function handleGetStatus(
  client: WSClient,
  message: any,
  streamManager: ClaudeStreamManager
) {
  const { sessionId, executionId } = message;
  
  // Get status from stream manager
  const status = streamManager.getStatus(sessionId || executionId);
  
  client.ws.send(JSON.stringify({
    type: 'status',
    sessionId,
    executionId,
    status
  }));
}

function broadcastToSubscribers(
  clients: Map<string, WSClient>,
  channel: string,
  data: any
) {
  for (const [clientId, client] of clients) {
    // Check if client is subscribed to this channel
    const isSubscribed = Array.from(client.subscriptions).some(sub => 
      sub.includes(channel) || channel.includes(sub)
    );
    
    if (isSubscribed && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        type: 'stream',
        channel,
        data,
        timestamp: Date.now()
      }));
    }
  }
}