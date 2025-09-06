import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { z } from 'zod';
import { PrismaClient } from '../generated/prisma';
import { WebPreviewService } from '../services/web-preview';
import authRoutes from './auth-routes';
import projectRoutes from './project-routes';
import executionRoutes from './execution-routes';
import metricsRegister, { trackHttpRequest } from '../services/MetricsService';
import { Logger, requestLogger } from '../utils/Logger';
import { initSentry, sentryRequestHandler, sentryErrorHandler } from '../utils/Sentry';

// Load environment variables
dotenv.config();

// Initialize Sentry (must be first)
initSentry();

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Web Preview Service
const webPreviewService = new WebPreviewService();

// Initialize tRPC
const t = initTRPC.create();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false // Allow embedding for preview functionality
}));

// Sentry request handler (must be before other middleware)
app.use(sentryRequestHandler());

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // In production, check against allowed origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-Total-Count', 'X-Request-ID']
};

app.use(cors(corsOptions));

// Request logging middleware (replaces morgan)
app.use(requestLogger());

app.use(express.json({ limit: '10mb' }));

// Metrics middleware
app.use((req, res, next) => {
  const trackRequest = trackHttpRequest(req.method, req.route?.path || req.path);
  
  res.on('finish', () => {
    trackRequest(res.statusCode);
  });
  
  next();
});

// Input validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  flow: z.record(z.any()),
});

const executeProjectSchema = z.object({
  projectId: z.string().uuid(),
});

const agentCompleteSchema = z.object({
  nodeId: z.string(),
  executionId: z.string().uuid(),
  status: z.enum(['completed', 'failed', 'error']),
  output: z.record(z.any()).optional(),
  errorMessage: z.string().optional(),
});

const reviewFeedbackSchema = z.object({
  executionId: z.string().uuid(),
  nodeId: z.string(),
  approved: z.boolean(),
  feedback: z.string().optional(),
  changes: z.record(z.any()).optional(),
});

// tRPC router
export const appRouter = t.router({
  // Project management
  createProject: t.procedure
    .input(createProjectSchema)
    .mutation(async ({ input }) => {
      const project = await prisma.project.create({
        data: {
          name: input.name,
          description: input.description,
          flow: input.flow,
          status: 'created',
        },
      });
      return project;
    }),

  getProject: t.procedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const project = await prisma.project.findUnique({
        where: { id: input.id },
        include: {
          executions: {
            include: {
              nodes: true,
            },
            orderBy: { startedAt: 'desc' },
          },
        },
      });
      if (!project) {
        throw new Error('Project not found');
      }
      return project;
    }),

  listProjects: t.procedure
    .query(async () => {
      const projects = await prisma.project.findMany({
        include: {
          executions: {
            include: {
              nodes: true,
            },
            orderBy: { startedAt: 'desc' },
            take: 1, // Only latest execution
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return projects;
    }),

  // Execution management
  executeProject: t.procedure
    .input(executeProjectSchema)
    .mutation(async ({ input }) => {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId },
      });
      
      if (!project) {
        throw new Error('Project not found');
      }

      const execution = await prisma.execution.create({
        data: {
          projectId: input.projectId,
          status: 'starting',
          metadata: {
            flow: project.flow,
            startedBy: 'api', // TODO: Add user context
          },
        },
      });

      // TODO: Trigger orchestration engine
      console.log(`Starting execution ${execution.id} for project ${project.name}`);
      
      return execution;
    }),

  getExecution: t.procedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const execution = await prisma.execution.findUnique({
        where: { id: input.id },
        include: {
          project: true,
          nodes: {
            orderBy: { startedAt: 'asc' },
          },
        },
      });
      if (!execution) {
        throw new Error('Execution not found');
      }
      return execution;
    }),

  // Hook callbacks
  agentComplete: t.procedure
    .input(agentCompleteSchema)
    .mutation(async ({ input }) => {
      const nodeExecution = await prisma.nodeExecution.findFirst({
        where: {
          executionId: input.executionId,
          nodeId: input.nodeId,
        },
      });

      if (!nodeExecution) {
        throw new Error('Node execution not found');
      }

      const updatedNode = await prisma.nodeExecution.update({
        where: { id: nodeExecution.id },
        data: {
          status: input.status,
          output: input.output,
          errorMessage: input.errorMessage,
          completedAt: new Date(),
        },
      });

      // TODO: Trigger next nodes in execution
      console.log(`Node ${input.nodeId} completed with status: ${input.status}`);
      
      return updatedNode;
    }),

  reviewFeedback: t.procedure
    .input(reviewFeedbackSchema)
    .mutation(async ({ input }) => {
      // Find the review node execution
      const nodeExecution = await prisma.nodeExecution.findFirst({
        where: {
          executionId: input.executionId,
          nodeId: input.nodeId,
        },
      });

      if (!nodeExecution) {
        throw new Error('Node execution not found');
      }

      const updatedNode = await prisma.nodeExecution.update({
        where: { id: nodeExecution.id },
        data: {
          status: input.approved ? 'completed' : 'failed',
          output: {
            approved: input.approved,
            feedback: input.feedback,
            changes: input.changes,
          },
          completedAt: new Date(),
        },
      });

      // TODO: Handle review feedback in orchestration
      console.log(`Review feedback received for node ${input.nodeId}: ${input.approved ? 'approved' : 'rejected'}`);
      
      return updatedNode;
    }),
});

export type AppRouter = typeof appRouter;

// Create HTTP server for tRPC
const server = createHTTPServer({
  router: appRouter,
  createContext: () => ({}),
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/executions', executionRoutes);

// REST endpoints for webhook callbacks (non-tRPC endpoints)
app.post('/api/agent-complete', async (req, res) => {
  try {
    const result = await appRouter.createCaller({}).agentComplete(req.body);
    res.json(result);
  } catch (error) {
    console.error('Agent complete callback error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

app.post('/api/review-feedback', async (req, res) => {
  try {
    const result = await appRouter.createCaller({}).reviewFeedback(req.body);
    res.json(result);
  } catch (error) {
    console.error('Review feedback callback error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

// Web Preview endpoints
app.post('/api/preview/:executionId/:nodeId', async (req, res) => {
  try {
    const { executionId, nodeId } = req.params;
    
    // Start preview server for this node
    const url = await webPreviewService.startPreviewServer(nodeId, executionId);
    
    res.json({ 
      url,
      nodeId,
      executionId,
      status: 'running'
    });
  } catch (error) {
    console.error('Preview server start error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to start preview server' });
  }
});

app.delete('/api/preview/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    
    // Stop preview server for this node
    await webPreviewService.stopPreviewServer(nodeId);
    
    res.json({ 
      nodeId,
      status: 'stopped'
    });
  } catch (error) {
    console.error('Preview server stop error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to stop preview server' });
  }
});

app.get('/api/preview/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    
    // Get preview URL if server is running
    const url = webPreviewService.getPreviewUrl(nodeId);
    
    if (!url) {
      res.status(404).json({ error: 'Preview server not found' });
      return;
    }
    
    res.json({ 
      url,
      nodeId,
      status: 'running'
    });
  } catch (error) {
    console.error('Preview server status error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get preview status' });
  }
});

app.get('/api/preview/active', async (req, res) => {
  try {
    // Get all active preview servers
    const servers = webPreviewService.getActiveServers();
    
    res.json({ 
      servers: Array.from(servers.entries()).map(([nodeId, info]) => ({
        nodeId,
        ...info
      }))
    });
  } catch (error) {
    console.error('Active preview servers error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get active servers' });
  }
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsRegister.contentType);
    res.end(await metricsRegister.metrics());
  } catch (error) {
    console.error('Error collecting metrics:', error);
    res.status(500).end('Error collecting metrics');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
  });
});

// Sentry error handler (must be after all routes)
app.use(sentryErrorHandler());

// Global error handler
app.use((error: any, req: any, res: any, next: any) => {
  Logger.error('Unhandled error', error, {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id,
  });

  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;

  res.status(error.statusCode || 500).json({
    error: message,
    requestId: req.requestId,
  });
});

// Start the servers
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    Logger.info('Database connected successfully');

    // Start tRPC server
    server.listen(PORT + 1, () => {
      Logger.info('tRPC server started', { 
        port: PORT + 1, 
        url: `http://localhost:${PORT + 1}` 
      });
    });

    // Start Express server
    app.listen(PORT, () => {
      Logger.info('Express server started', { 
        port: PORT, 
        url: `http://localhost:${PORT}`,
        healthCheckUrl: `http://localhost:${PORT}/health`,
        metricsUrl: `http://localhost:${PORT}/metrics`,
        environment: process.env.NODE_ENV || 'development'
      });
    });
  } catch (error) {
    Logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  Logger.info('SIGTERM received, shutting down gracefully...');
  try {
    await webPreviewService.stopAllServers();
    await prisma.$disconnect();
    Logger.info('Server shutdown completed');
    process.exit(0);
  } catch (error) {
    Logger.error('Error during shutdown', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  Logger.info('SIGINT received, shutting down gracefully...');
  try {
    await webPreviewService.stopAllServers();
    await prisma.$disconnect();
    Logger.info('Server shutdown completed');
    process.exit(0);
  } catch (error) {
    Logger.error('Error during shutdown', error);
    process.exit(1);
  }
});

if (require.main === module) {
  startServer();
}

export { app, prisma };