import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from './generated/prisma';
import { DatabaseService } from './services/DatabaseService';

// Load environment variables
dotenv.config();

// Initialize services
const prisma = new PrismaClient();
const dbService = new DatabaseService(prisma);
const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.CORS_ORIGIN : true,
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    database: 'connected'
  });
});

// Project management endpoints
app.post('/api/projects', async (req, res) => {
  try {
    const { name, description, flow } = req.body;
    
    if (!name || !flow) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and flow are required' 
      });
    }

    const project = await dbService.createProject({ name, description, flow });
    res.json({ success: true, project });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

app.get('/api/projects', async (req, res) => {
  try {
    const projects = await dbService.listProjects();
    res.json({ success: true, projects });
  } catch (error) {
    console.error('Error listing projects:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await dbService.getProject(req.params.id);
    
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        error: 'Project not found' 
      });
    }
    
    res.json({ success: true, project });
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// Execution management endpoints
app.post('/api/projects/:id/execute', async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await dbService.getProject(projectId);
    
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        error: 'Project not found' 
      });
    }

    const execution = await dbService.createExecution({
      projectId,
      metadata: { 
        startedBy: 'api',
        options: req.body.options || {}
      }
    });

    // For now, we'll just return the execution without actually starting it
    // The full orchestration will be implemented later
    console.log(`Execution ${execution.id} created for project ${project.name}`);
    
    res.json({ 
      success: true, 
      execution,
      message: 'Execution created successfully'
    });
  } catch (error) {
    console.error('Error creating execution:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

app.get('/api/executions/:id', async (req, res) => {
  try {
    const execution = await dbService.getExecution(req.params.id);
    
    if (!execution) {
      return res.status(404).json({ 
        success: false, 
        error: 'Execution not found' 
      });
    }
    
    res.json({ success: true, execution });
  } catch (error) {
    console.error('Error getting execution:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// Hook callback endpoints (for agent communication)
app.post('/api/agent-complete', async (req, res) => {
  try {
    const { nodeId, executionId, status, output, errorMessage } = req.body;
    
    console.log(`Agent completion callback: ${nodeId} in execution ${executionId} - ${status}`);
    
    // Find and update the node execution
    const nodeExecution = await dbService.findNodeExecution(executionId, nodeId);
    
    if (nodeExecution) {
      await dbService.updateNodeExecution(nodeExecution.id, {
        status,
        output,
        errorMessage,
        completedAt: new Date()
      });
    }
    
    res.json({ success: true, message: 'Agent completion recorded' });
  } catch (error) {
    console.error('Error handling agent completion:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

app.post('/api/review-feedback', async (req, res) => {
  try {
    const { executionId, nodeId, approved, feedback } = req.body;
    
    console.log(`Review feedback: ${nodeId} in execution ${executionId} - ${approved ? 'approved' : 'rejected'}`);
    
    // Find and update the node execution
    const nodeExecution = await dbService.findNodeExecution(executionId, nodeId);
    
    if (nodeExecution) {
      await dbService.updateNodeExecution(nodeExecution.id, {
        status: approved ? 'completed' : 'failed',
        output: {
          approved,
          feedback
        },
        completedAt: new Date()
      });
    }
    
    res.json({ success: true, message: 'Review feedback recorded' });
  } catch (error) {
    console.error('Error handling review feedback:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// Statistics endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const projects = await prisma.project.count();
    const executions = await prisma.execution.count();
    const nodeExecutions = await prisma.nodeExecution.count();
    
    const activeExecutions = await prisma.execution.count({
      where: {
        status: {
          in: ['starting', 'running', 'paused']
        }
      }
    });
    
    res.json({
      success: true,
      stats: {
        projects,
        executions,
        nodeExecutions,
        activeExecutions
      }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// Start the server
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');

    // Start server
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║     Anton v2 Database & API Server               ║
║                                                   ║
║     Server running on port ${PORT}              ║
║     Database connected (SQLite)                  ║
║                                                   ║
║     Endpoints:                                    ║
║     POST /api/projects                           ║
║     GET  /api/projects                           ║
║     GET  /api/projects/:id                       ║
║     POST /api/projects/:id/execute               ║
║     GET  /api/executions/:id                     ║
║     POST /api/agent-complete                     ║
║     POST /api/review-feedback                    ║
║     GET  /api/stats                              ║
║     GET  /health                                 ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

export { app, prisma, dbService };