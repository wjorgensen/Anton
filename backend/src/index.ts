import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
import { planningRouter } from './routes/planning';
import { executionRouter } from './routes/execution';
import { webhookRouter } from './routes/webhooks';
import { logger } from './utils/logger';
import { setupWebSocketHandlers } from './websocket/handlers';
import { ClaudeStreamManager } from './services/ClaudeStreamManager';
import { DatabaseService } from './services/DatabaseService';
import { WebhookManager } from './services/WebhookManager';
import { PlanningService } from './services/PlanningService';
import { ExecutionService } from './services/ExecutionService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { 
    query: req.query, 
    body: req.body 
  });
  next();
});

// Routes
app.use('/api/planning', planningRouter);
app.use('/api/execution', executionRouter);
app.use('/api/webhooks', webhookRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Create HTTP server
const server = http.createServer(app);

// Setup WebSocket server for real-time streaming
const wss = new WebSocketServer({ server, path: '/ws' });

// Initialize Claude stream manager
const streamManager = ClaudeStreamManager.getInstance();

// Setup WebSocket handlers
setupWebSocketHandlers(wss, streamManager);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message 
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    const db = DatabaseService.getInstance();
    await db.initialize();
    logger.info('✅ Database connected and initialized');

    // Initialize services and setup webhook forwarding
    const planningService = new PlanningService();
    const executionService = new ExecutionService();
    const webhookManager = new WebhookManager();
    
    // Setup event forwarding from services to webhooks
    webhookManager.setupEventForwarding(planningService, executionService);
    logger.info('🔗 Webhook event forwarding configured');

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Anton Backend v2 running on http://localhost:${PORT}`);
      logger.info(`📡 WebSocket server available at ws://localhost:${PORT}/ws`);
      logger.info(`🗄️ PostgreSQL database: ${process.env.DB_NAME}`);
      logger.info(`🤖 Claude Code integration enabled`);
      logger.info(`🪝 Webhook system active`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();