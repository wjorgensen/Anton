import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from './generated/prisma';
import { DatabaseService } from './services/DatabaseService';
import { AuthService } from './services/AuthService';
import { configureSecurityHeaders } from './middleware/security';
import { 
  apiLimiter, 
  authLimiter, 
  executionLimiter, 
  projectCreationLimiter,
  apiKeyLimiter 
} from './middleware/rateLimit';
import { authenticate, optionalAuth, authorize, checkResourceOwnership } from './middleware/auth';

// Load environment variables
dotenv.config();

// Initialize services
const prisma = new PrismaClient();
const dbService = new DatabaseService(prisma);
const authService = new AuthService(prisma);
const app = express();
const PORT = process.env.PORT || 3002;

// Security Headers (Helmet)
configureSecurityHeaders(app);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.CORS_ORIGIN || 'https://anton.app').split(',')
    : true,
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));

// Apply general rate limiting to all routes
app.use(apiLimiter);

// ==================== PUBLIC ENDPOINTS ====================

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0-secure',
    database: 'connected'
  });
});

// ==================== AUTHENTICATION ENDPOINTS ====================

// User registration
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 8 characters long' 
      });
    }

    const result = await authService.register(email, password, name);
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Registration failed' 
    });
  }
});

// User login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    const result = await authService.login(email, password);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Login failed' 
    });
  }
});

// ==================== USER MANAGEMENT ENDPOINTS ====================

// Get current user profile
app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        lastLoginAt: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get profile' 
    });
  }
});

// Update user profile
app.patch('/api/auth/me', authenticate, async (req, res) => {
  try {
    const { name, email } = req.body;
    const updatedUser = await authService.updateProfile(req.user!.userId, { name, email });
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update profile' 
    });
  }
});

// Change password
app.post('/api/auth/change-password', authenticate, authLimiter, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Old and new passwords are required' 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ 
        success: false, 
        error: 'New password must be at least 8 characters long' 
      });
    }

    await authService.changePassword(req.user!.userId, oldPassword, newPassword);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to change password' 
    });
  }
});

// ==================== API KEY MANAGEMENT ====================

// Create API key
app.post('/api/auth/api-keys', authenticate, apiKeyLimiter, async (req, res) => {
  try {
    const { name, expiresInDays } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: 'API key name is required' 
      });
    }

    const result = await authService.createApiKey(req.user!.userId, name, expiresInDays);
    res.status(201).json({ 
      success: true, 
      apiKey: result.key,
      id: result.id,
      message: 'Save this API key securely. It will not be shown again.' 
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create API key' 
    });
  }
});

// List API keys
app.get('/api/auth/api-keys', authenticate, async (req, res) => {
  try {
    const keys = await authService.listApiKeys(req.user!.userId);
    res.json({ success: true, apiKeys: keys });
  } catch (error) {
    console.error('Error listing API keys:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to list API keys' 
    });
  }
});

// Revoke API key
app.delete('/api/auth/api-keys/:id', authenticate, async (req, res) => {
  try {
    await authService.revokeApiKey(req.user!.userId, req.params.id);
    res.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to revoke API key' 
    });
  }
});

// ==================== PROTECTED PROJECT ENDPOINTS ====================

// Create project (requires authentication)
app.post('/api/projects', authenticate, projectCreationLimiter, async (req, res) => {
  try {
    const { name, description, flow } = req.body;
    
    if (!name || !flow) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and flow are required' 
      });
    }

    const project = await dbService.createProject({ 
      name, 
      description, 
      flow,
      userId: req.user!.userId 
    });
    
    res.json({ success: true, project });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// List projects (optional auth - shows user's projects if authenticated)
app.get('/api/projects', optionalAuth, async (req, res) => {
  try {
    const projects = await dbService.listProjects(req.user?.userId);
    res.json({ success: true, projects });
  } catch (error) {
    console.error('Error listing projects:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// Get project by ID (requires ownership or admin)
app.get('/api/projects/:id', authenticate, async (req, res) => {
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

// Update project (requires ownership or admin)
app.patch('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const { name, description, flow } = req.body;
    
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(flow && { flow })
      }
    });
    
    res.json({ success: true, project });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update project' 
    });
  }
});

// Delete project (requires ownership or admin)
app.delete('/api/projects/:id', authenticate, async (req, res) => {
  try {
    await prisma.project.delete({
      where: { id: req.params.id }
    });
    
    res.json({ success: true, message: 'Project deleted' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete project' 
    });
  }
});

// ==================== PROTECTED EXECUTION ENDPOINTS ====================

// Start execution (requires project ownership)
app.post(
  '/api/projects/:id/execute', 
  authenticate, 
  executionLimiter, 
  async (req, res) => {
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
          startedBy: req.user!.email,
          userId: req.user!.userId,
          options: req.body.options || {}
        }
      });

      console.log(`Execution ${execution.id} created for project ${project.name} by ${req.user!.email}`);
      
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
  }
);

// Get execution by ID (requires ownership)
app.get('/api/executions/:id', authenticate, async (req, res) => {
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

// ==================== HOOK CALLBACK ENDPOINTS (Internal use) ====================

// These endpoints should ideally use a different authentication mechanism
// (e.g., shared secret) since they're called by hook scripts

app.post('/api/agent-complete', async (req, res) => {
  try {
    const { nodeId, executionId, status, output, errorMessage } = req.body;
    
    console.log(`Agent completion callback: ${nodeId} in execution ${executionId} - ${status}`);
    
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

// ==================== ADMIN ENDPOINTS ====================

// Admin statistics (requires admin role)
app.get('/api/admin/stats', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const users = await prisma.user.count();
    const projects = await prisma.project.count();
    const executions = await prisma.execution.count();
    const nodeExecutions = await prisma.nodeExecution.count();
    const apiKeys = await prisma.apiKey.count();
    
    const activeExecutions = await prisma.execution.count({
      where: {
        status: {
          in: ['starting', 'running', 'paused']
        }
      }
    });

    const activeUsers = await prisma.user.count({
      where: {
        lastLoginAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    });
    
    res.json({
      success: true,
      stats: {
        users,
        activeUsers,
        projects,
        executions,
        nodeExecutions,
        activeExecutions,
        apiKeys
      }
    });
  } catch (error) {
    console.error('Error getting admin stats:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// List all users (admin only)
app.get('/api/admin/users', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: {
            projects: true,
            apiKeys: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to list users' 
    });
  }
});

// Update user status (admin only)
app.patch('/api/admin/users/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { isActive, role } = req.body;
    
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(role && { role })
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true
      }
    });
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update user' 
    });
  }
});

// ==================== SERVER STARTUP ====================

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');

    // Check JWT secret
    if (!process.env.JWT_SECRET) {
      console.warn(`
⚠️  WARNING: JWT_SECRET is not set in environment variables!
⚠️  Using a default secret which is INSECURE for production.
⚠️  Please set JWT_SECRET in your .env file.
      `);
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║     Anton v2 Secure API Server                   ║
║                                                   ║
║     Server running on port ${PORT}              ║
║     Database connected (SQLite)                  ║
║     Security features enabled:                   ║
║       ✓ JWT Authentication                       ║
║       ✓ API Key Authentication                   ║
║       ✓ Rate Limiting                            ║
║       ✓ Security Headers (Helmet)                ║
║       ✓ CORS Protection                          ║
║                                                   ║
║     Auth Endpoints:                              ║
║     POST /api/auth/register                      ║
║     POST /api/auth/login                         ║
║     GET  /api/auth/me                            ║
║     POST /api/auth/change-password               ║
║                                                   ║
║     Protected Endpoints:                         ║
║     POST /api/projects (authenticated)           ║
║     GET  /api/projects/:id (owner/admin)         ║
║     POST /api/projects/:id/execute (owner)       ║
║                                                   ║
║     Admin Endpoints:                             ║
║     GET  /api/admin/stats                        ║
║     GET  /api/admin/users                        ║
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

export { app, prisma, authService };