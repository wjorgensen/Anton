import express, { Express } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { HookHandler } from './hooks/HookHandler';
import { JobQueueManager } from './queues/JobQueue';
import { WebSocketService } from './services/WebSocketService';
import { TerminalPreviewService } from './services/TerminalPreviewService';
import { ErrorHandler, OrchestrationError, ErrorCode } from './utils/ErrorHandler';
import { FlowExecutor } from './core/FlowExecutor';
import { DatabaseService } from './services/DatabaseService';
import { PrismaClient } from './generated/prisma';
import { Flow, ExecutionOptions } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

dotenv.config();

class OrchestrationServer {
  private app: Express;
  private server: any;
  private hookHandler: HookHandler;
  private jobQueue: JobQueueManager;
  private wsService: WebSocketService;
  private terminalPreview: TerminalPreviewService;
  private errorHandler: ErrorHandler;
  private dbService: DatabaseService;
  private prisma: PrismaClient;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3002');
    this.errorHandler = new ErrorHandler();
    this.prisma = new PrismaClient();
    this.dbService = new DatabaseService(this.prisma);
    
    this.setupMiddleware();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }));
    
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: 'Too many requests from this IP'
    });
    this.app.use('/api/', limiter);

    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }

  private async initializeServices(): Promise<void> {
    this.server = createServer(this.app);

    // Initialize database connection
    await this.prisma.$connect();
    console.log('✅ Database connected');

    this.hookHandler = new HookHandler(this.prisma);
    
    this.jobQueue = new JobQueueManager(
      {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      this.hookHandler
    );

    this.wsService = new WebSocketService(
      this.server,
      process.env.JWT_SECRET || 'default-secret',
      process.env.CORS_ORIGIN || '*'
    );

    // Initialize Terminal Preview Service
    this.terminalPreview = new TerminalPreviewService(
      this.wsService,
      process.env.OUTPUT_PATH || '/projects'
    );

    this.hookHandler.setWebSocketService(this.wsService);
    this.jobQueue.setWebSocketService(this.wsService);
    this.wsService.attachToHookHandler(this.hookHandler);
    this.wsService.attachToJobQueue(this.jobQueue);

    await this.jobQueue.startWorkers(parseInt(process.env.WORKER_CONCURRENCY || '5'));
  }

  private setupRoutes(): void {
    this.app.use(this.hookHandler.getRouter());

    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        stats: {
          hooks: this.hookHandler.getStats(),
          websocket: this.wsService.getStats(),
          errors: this.errorHandler.analyzeErrors()
        }
      });
    });

    // Database management routes
    this.app.post('/api/projects', async (req, res) => {
      try {
        const { name, description, flow } = req.body;
        const project = await this.dbService.createProject({ name, description, flow });
        res.json({ success: true, project });
      } catch (error) {
        res.status(400).json({ success: false, error: (error as Error).message });
      }
    });

    this.app.get('/api/projects', async (req, res) => {
      try {
        const projects = await this.dbService.listProjects();
        res.json({ success: true, projects });
      } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    // Template API endpoint - must be before :id route
    this.app.get('/api/projects/templates', async (req, res) => {
      try {
        const templatesPath = path.join(__dirname, '../../../agents/library');
        const categories = ['setup', 'execution', 'testing', 'integration', 'review', 'utility'];
        const templates: any[] = [];

        for (const category of categories) {
          const categoryPath = path.join(templatesPath, category);
          try {
            const files = await fs.readdir(categoryPath);
            for (const file of files) {
              if (file.endsWith('.json')) {
                const filePath = path.join(categoryPath, file);
                const content = await fs.readFile(filePath, 'utf8');
                const agent = JSON.parse(content);
                templates.push({
                  id: `${category}-${path.basename(file, '.json')}`,
                  name: agent.name || path.basename(file, '.json'),
                  category,
                  description: agent.description || '',
                  instructions: agent.instructions || '',
                  icon: agent.icon || 'Settings',
                  color: agent.color || '#6B7280',
                  estimatedTime: agent.estimatedTime || 5,
                  estimatedTokens: agent.estimatedTokens || 1000,
                  ...agent
                });
              }
            }
          } catch (err) {
            console.warn(`Could not read category ${category}:`, err);
          }
        }

        res.json({ success: true, templates });
      } catch (error) {
        console.error('Error loading templates:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to load agent templates',
          details: (error as Error).message
        });
      }
    });

    this.app.get('/api/projects/:id', async (req, res) => {
      try {
        const project = await this.dbService.getProject(req.params.id);
        if (!project) {
          return res.status(404).json({ success: false, error: 'Project not found' });
        }
        res.json({ success: true, project });
      } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    this.app.delete('/api/projects/:id', async (req, res) => {
      try {
        const project = await this.dbService.getProject(req.params.id);
        if (!project) {
          return res.status(404).json({ success: false, error: 'Project not found' });
        }
        
        // Delete the project from database
        await this.dbService.deleteProject(req.params.id);
        
        res.json({ success: true, message: 'Project deleted successfully' });
      } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    this.app.post('/api/projects/:id/execute', async (req, res) => {
      try {
        const projectId = req.params.id;
        const project = await this.dbService.getProject(projectId);
        
        if (!project) {
          return res.status(404).json({ success: false, error: 'Project not found' });
        }

        const execution = await this.dbService.createExecution({
          projectId,
          metadata: { 
            startedBy: 'api',
            options: req.body.options || {}
          }
        });

        // Queue the flow for execution
        const job = await this.jobQueue.addFlowJob({
          flowId: project.id,
          executionId: execution.id,
          flow: project.flow as Flow,
          options: req.body.options || {}
        });

        res.json({ 
          success: true, 
          execution: execution,
          jobId: job.id
        });
      } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    this.app.get('/api/executions/:id', async (req, res) => {
      try {
        const execution = await this.dbService.getExecution(req.params.id);
        if (!execution) {
          return res.status(404).json({ success: false, error: 'Execution not found' });
        }
        res.json({ success: true, execution });
      } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    this.app.post('/api/flow/execute', async (req, res) => {
      try {
        const { flow, options } = req.body;
        
        if (!flow || !flow.nodes || !flow.edges) {
          throw new OrchestrationError(
            ErrorCode.INVALID_FLOW,
            'Invalid flow structure',
            { flow }
          );
        }

        const defaultOptions: ExecutionOptions = {
          maxParallel: 5,
          timeout: 300000,
          retryStrategy: {
            maxAttempts: 3,
            backoff: 'exponential',
            initialDelay: 1000,
            maxDelay: 30000,
            contextEnhancement: {
              includeErrors: true,
              includeStackTrace: true,
              includeSuggestions: true,
              includeRelatedCode: false
            }
          },
          debug: false,
          dryRun: false
        };

        const mergedOptions = { ...defaultOptions, ...options };

        const job = await this.jobQueue.addFlowJob({
          flowId: flow.id,
          flow,
          options: mergedOptions
        });

        res.json({
          success: true,
          jobId: job.id,
          flowId: flow.id
        });

      } catch (error) {
        await this.errorHandler.handleError(error as Error, { 
          endpoint: '/api/flow/execute' 
        });
        res.status(400).json({
          success: false,
          error: (error as Error).message
        });
      }
    });

    this.app.post('/api/flow/pause/:flowId', async (req, res) => {
      try {
        const { flowId } = req.params;
        
        this.wsService.broadcastFlowEvent(flowId, 'flow:pausing', {});
        
        res.json({ success: true, flowId });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: (error as Error).message
        });
      }
    });

    this.app.post('/api/flow/resume/:flowId', async (req, res) => {
      try {
        const { flowId } = req.params;
        
        this.wsService.broadcastFlowEvent(flowId, 'flow:resuming', {});
        
        res.json({ success: true, flowId });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: (error as Error).message
        });
      }
    });

    this.app.post('/api/flow/abort/:flowId', async (req, res) => {
      try {
        const { flowId } = req.params;
        
        this.wsService.broadcastFlowEvent(flowId, 'flow:aborting', {});
        
        res.json({ success: true, flowId });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: (error as Error).message
        });
      }
    });

    this.app.get('/api/queue/stats', async (req, res) => {
      try {
        const stats = await this.jobQueue.getQueueStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({
          error: (error as Error).message
        });
      }
    });

    this.app.post('/api/queue/clear', async (req, res) => {
      try {
        await this.jobQueue.clearQueues();
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({
          error: (error as Error).message
        });
      }
    });

    this.app.get('/api/errors', (req, res) => {
      const { code, nodeId, flowId } = req.query;
      const errors = this.errorHandler.getErrorLog({
        code: code as ErrorCode,
        nodeId: nodeId as string,
        flowId: flowId as string
      });
      res.json(errors);
    });


    // Preview API endpoints
    this.app.get('/api/preview/url', (req, res) => {
      const { nodeId } = req.query;
      if (!nodeId) {
        return res.status(400).json({ error: 'nodeId is required' });
      }
      // Return preview URL for the node
      const previewUrl = `http://localhost:3000/preview/${nodeId}`;
      res.json({ success: true, url: previewUrl });
    });

    this.app.post('/api/preview/update', (req, res) => {
      const { nodeId, content, type } = req.body;
      if (!nodeId) {
        return res.status(400).json({ error: 'nodeId is required' });
      }
      // Broadcast preview update via WebSocket
      this.wsService.broadcastNodeEvent(nodeId, 'preview:update', {
        type: type || 'html',
        content,
        timestamp: new Date().toISOString()
      });
      res.json({ success: true });
    });

    // Terminal Preview endpoints
    this.app.post('/api/terminal/create', (req, res) => {
      try {
        const { nodeId, executionId } = req.body;
        
        if (!nodeId || !executionId) {
          return res.status(400).json({ 
            error: 'nodeId and executionId are required' 
          });
        }
        
        this.terminalPreview.createTerminal(nodeId, executionId);
        res.json({ success: true, nodeId, executionId });
      } catch (error) {
        res.status(500).json({ 
          error: (error as Error).message 
        });
      }
    });

    this.app.post('/api/terminal/write', (req, res) => {
      try {
        const { nodeId, data } = req.body;
        
        if (!nodeId || !data) {
          return res.status(400).json({ 
            error: 'nodeId and data are required' 
          });
        }
        
        this.terminalPreview.writeToTerminal(nodeId, data);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ 
          error: (error as Error).message 
        });
      }
    });

    this.app.post('/api/terminal/clear/:nodeId', (req, res) => {
      try {
        const { nodeId } = req.params;
        this.terminalPreview.clearTerminal(nodeId);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ 
          error: (error as Error).message 
        });
      }
    });

    this.app.post('/api/terminal/resize/:nodeId', (req, res) => {
      try {
        const { nodeId } = req.params;
        const { cols, rows } = req.body;
        
        if (!cols || !rows) {
          return res.status(400).json({ 
            error: 'cols and rows are required' 
          });
        }
        
        this.terminalPreview.resizeTerminal(nodeId, cols, rows);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ 
          error: (error as Error).message 
        });
      }
    });

    this.app.get('/api/terminal/stats', (req, res) => {
      try {
        const stats = this.terminalPreview.getStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ 
          error: (error as Error).message 
        });
      }
    });

    this.app.post('/api/test/flow', async (req, res) => {
      try {
        const testFlow: Flow = {
          id: 'test-flow-1',
          version: 1,
          name: 'Test Flow',
          description: 'A test flow for development',
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          nodes: [
            {
              id: 'node-1',
              agentId: 'test-agent',
              label: 'Test Node 1',
              instructions: 'Echo "Hello from Node 1" and write it to output.json',
              inputs: {},
              position: { x: 100, y: 100 },
              config: {
                retryOnFailure: true,
                maxRetries: 2,
                timeout: 60000,
                requiresReview: false
              },
              status: 'pending'
            },
            {
              id: 'node-2',
              agentId: 'test-agent',
              label: 'Test Node 2',
              instructions: 'Read input.json and echo the content',
              inputs: {},
              position: { x: 300, y: 100 },
              config: {
                retryOnFailure: true,
                maxRetries: 2,
                timeout: 60000,
                requiresReview: false
              },
              status: 'pending'
            }
          ],
          edges: [
            {
              id: 'edge-1',
              source: 'node-1',
              target: 'node-2',
              sourceHandle: 'output',
              targetHandle: 'input'
            }
          ],
          metadata: {}
        };

        const options: ExecutionOptions = {
          maxParallel: 2,
          timeout: 120000,
          retryStrategy: {
            maxAttempts: 2,
            backoff: 'exponential',
            initialDelay: 1000,
            maxDelay: 10000,
            contextEnhancement: {
              includeErrors: true,
              includeStackTrace: true,
              includeSuggestions: true,
              includeRelatedCode: false
            }
          },
          debug: true,
          dryRun: false
        };

        const job = await this.jobQueue.addFlowJob({
          flowId: testFlow.id,
          flow: testFlow,
          options
        });

        res.json({
          success: true,
          jobId: job.id,
          flowId: testFlow.id,
          message: 'Test flow queued for execution'
        });

      } catch (error) {
        res.status(500).json({
          success: false,
          error: (error as Error).message
        });
      }
    });

    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        path: req.path
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use((err: Error, req: any, res: any, next: any) => {
      console.error('Unhandled error:', err);
      
      const orchError = err instanceof OrchestrationError 
        ? err 
        : OrchestrationError.fromError(err);
      
      res.status(500).json({
        error: orchError.message,
        code: orchError.code,
        details: process.env.NODE_ENV === 'development' ? orchError.details : undefined
      });
    });

    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error: Error) => {
      console.error('Uncaught Exception:', error);
      this.gracefulShutdown();
    });

    process.on('SIGTERM', () => {
      console.log('SIGTERM received, starting graceful shutdown');
      this.gracefulShutdown();
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, starting graceful shutdown');
      this.gracefulShutdown();
    });
  }

  private async gracefulShutdown(): Promise<void> {
    console.log('Starting graceful shutdown...');
    
    try {
      await this.jobQueue.pauseQueues();
      
      await this.jobQueue.stopWorkers();
      
      this.wsService.close();
      
      await new Promise<void>((resolve) => {
        this.server.close(() => {
          console.log('HTTP server closed');
          resolve();
        });
      });
      
      await this.jobQueue.cleanup();
      
      // Clean up terminal preview service
      this.terminalPreview.destroy();
      console.log('Terminal preview service cleaned up');
      
      // Close database connection
      await this.prisma.$disconnect();
      console.log('Database disconnected');
      
      console.log('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  async start(): Promise<void> {
    await this.initializeServices();
    this.setupRoutes();
    
    this.server.listen(this.port, () => {
      console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║     Anton v2 Orchestration Engine                ║
║                                                   ║
║     Server running on port ${this.port}              ║
║     WebSocket enabled                            ║
║     Redis connected                              ║
║     Workers active                               ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
      `);
    });
  }
}

const server = new OrchestrationServer();
server.start().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});