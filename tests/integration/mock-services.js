#!/usr/bin/env node

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

// Mock data storage
const mockData = {
  projects: new Map(),
  executions: new Map(),
  users: new Map(),
  nodeStatus: new Map()
};

// Create mock orchestrator service
function createOrchestratorMock(port = 3002) {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'orchestrator-mock' });
  });

  // Auth middleware
  const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  };

  // Project endpoints
  app.post('/api/projects', authMiddleware, (req, res) => {
    const project = {
      id: `project-${Date.now()}`,
      ...req.body,
      userId: req.user.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockData.projects.set(project.id, project);
    res.status(201).json(project);
  });

  app.get('/api/projects/:id', authMiddleware, (req, res) => {
    const project = mockData.projects.get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  });

  app.put('/api/projects/:id', authMiddleware, (req, res) => {
    const project = mockData.projects.get(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const updated = { ...project, ...req.body, updatedAt: new Date().toISOString() };
    mockData.projects.set(req.params.id, updated);
    res.json(updated);
  });

  app.get('/api/projects', authMiddleware, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const projects = Array.from(mockData.projects.values());
    
    res.json({
      projects: projects.slice((page - 1) * limit, page * limit),
      total: projects.length,
      page,
      limit
    });
  });

  app.delete('/api/projects/:id', authMiddleware, (req, res) => {
    mockData.projects.delete(req.params.id);
    res.status(204).send();
  });

  // Execution endpoints
  app.post('/api/executions', authMiddleware, (req, res) => {
    const execution = {
      id: `exec-${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString(),
      nodeStatus: []
    };
    mockData.executions.set(execution.id, execution);
    
    // Emit WebSocket event
    io.emit('flow:started', {
      executionId: execution.id,
      projectId: execution.projectId,
      status: execution.status,
      timestamp: execution.createdAt
    });
    
    res.status(201).json(execution);
  });

  app.patch('/api/executions/:id', authMiddleware, (req, res) => {
    const execution = mockData.executions.get(req.params.id);
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }
    
    const updated = { ...execution, ...req.body };
    mockData.executions.set(req.params.id, updated);
    
    // Emit appropriate WebSocket event
    if (updated.status === 'completed') {
      io.emit('flow:completed', {
        executionId: updated.id,
        status: updated.status,
        results: updated.results
      });
    } else if (updated.status === 'failed') {
      io.emit('flow:failed', {
        executionId: updated.id,
        status: updated.status,
        error: updated.error
      });
    }
    
    res.json(updated);
  });

  app.delete('/api/executions/:id', authMiddleware, (req, res) => {
    mockData.executions.delete(req.params.id);
    res.status(204).send();
  });

  // Node status endpoint
  app.post('/api/node-status', authMiddleware, (req, res) => {
    const { executionId, nodeId, status, output } = req.body;
    
    const execution = mockData.executions.get(executionId);
    if (execution) {
      if (!execution.nodeStatus) execution.nodeStatus = [];
      execution.nodeStatus.push({ nodeId, status, output });
      mockData.executions.set(executionId, execution);
    }
    
    // Emit WebSocket events
    if (status === 'running') {
      io.emit('node:started', { executionId, nodeId, status });
    } else if (status === 'completed') {
      io.emit('node:completed', { executionId, nodeId, status, output });
    }
    
    res.json({ executionId, nodeId, status });
  });

  // User endpoints
  app.post('/api/users', authMiddleware, (req, res) => {
    const { password, ...userData } = req.body;
    const user = {
      id: `user-${Date.now()}`,
      ...userData,
      password: `hashed_${password}`, // Mock hash
      createdAt: new Date().toISOString()
    };
    mockData.users.set(user.id, user);
    
    const { password: _, ...safeUser } = user;
    res.status(201).json(safeUser);
  });

  // Flow validation
  app.post('/api/flow/validate', authMiddleware, (req, res) => {
    const { flow } = req.body;
    const valid = flow && flow.nodes && flow.edges;
    res.json({ valid, errors: valid ? [] : ['Invalid flow structure'] });
  });

  // Capabilities
  app.get('/api/capabilities', (req, res) => {
    res.json({
      maxNodes: 20,
      nodeTypes: ['setup', 'execution', 'testing'],
      maxParallel: 5
    });
  });

  // Terminal output
  app.post('/api/terminal-output', authMiddleware, (req, res) => {
    io.emit('terminal:output', req.body);
    res.json({ success: true });
  });

  // Preview
  app.post('/api/preview', authMiddleware, (req, res) => {
    io.emit('preview:update', req.body);
    res.json({ success: true });
  });

  // File change
  app.post('/api/file-change', authMiddleware, (req, res) => {
    io.emit('file:changed', req.body);
    res.json({ success: true });
  });

  // Broadcast
  app.post('/api/broadcast', authMiddleware, (req, res) => {
    const { event, data, room } = req.body;
    if (room) {
      io.to(room).emit(event, data);
    } else {
      io.emit(event, data);
    }
    res.json({ success: true });
  });

  // File transfer
  app.post('/api/file-transfer', authMiddleware, (req, res) => {
    io.emit('file:data', req.body);
    res.json({ success: true });
  });

  // Transaction test endpoint
  app.post('/api/projects-with-execution', authMiddleware, (req, res) => {
    const { project } = req.body;
    
    // Validate node types
    const invalidNode = project.flow.nodes.find(n => n.type === 'invalid-type');
    if (invalidNode) {
      return res.status(400).json({ error: 'Invalid node type' });
    }
    
    res.status(201).json({ project: { id: 'test-id' } });
  });

  // WebSocket authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.data.user = decoded;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  // WebSocket event handlers
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join:execution', ({ executionId }) => {
      socket.join(`execution:${executionId}`);
      socket.emit('joined:execution', { executionId });
    });

    socket.on('invalid:event', () => {
      socket.emit('error', { message: 'Invalid event received' });
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Mock orchestrator running on port ${port}`);
      resolve(server);
    });
  });
}

// Create mock planning service
function createPlanningMock(port = 3003) {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'planning-mock' });
  });

  // Generate flow
  app.post('/api/generate', (req, res) => {
    const { requirements } = req.body;
    
    if (!requirements) {
      return res.status(400).json({ error: 'Requirements are required' });
    }
    
    if (typeof requirements === 'object' && requirements.description === '') {
      return res.status(400).json({ error: 'Requirements description cannot be empty' });
    }
    
    // Generate mock flow based on requirements
    const nodeCount = requirements.minimal ? 3 : 5;
    const nodes = [];
    const edges = [];
    
    for (let i = 0; i < nodeCount; i++) {
      const nodeType = i === 0 ? 'setup' : i === nodeCount - 1 ? 'testing' : 'execution';
      nodes.push({
        id: `node${i + 1}`,
        type: nodeType,
        position: { x: 100 + i * 200, y: 100 },
        data: {
          label: `${nodeType} Node ${i + 1}`,
          category: nodeType,
          agentId: `${nodeType}-agent`,
          config: {}
        }
      });
      
      if (i > 0) {
        edges.push({
          id: `edge${i}`,
          source: `node${i}`,
          target: `node${i + 1}`
        });
      }
    }
    
    // Add parallel nodes for complex requirements
    if (requirements.services && requirements.services.length > 1) {
      const baseNode = nodes[1];
      requirements.services.forEach((service, idx) => {
        const parallelNode = {
          id: `parallel-${idx}`,
          type: 'execution',
          position: { x: baseNode.position.x, y: 200 + idx * 100 },
          data: {
            label: service.name || `Service ${idx + 1}`,
            category: 'execution',
            agentId: 'service-agent'
          }
        };
        nodes.push(parallelNode);
        edges.push({
          id: `parallel-edge-${idx}`,
          source: nodes[0].id,
          target: parallelNode.id
        });
      });
    }
    
    res.json({ flow: { nodes, edges } });
  });

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Mock planning service running on port ${port}`);
      resolve(server);
    });
  });
}

// Main function to start mock services
async function startMockServices() {
  console.log('Starting mock services for integration testing...');
  
  const orchestrator = await createOrchestratorMock(3002);
  const planning = await createPlanningMock(3003);
  
  console.log('Mock services started successfully');
  console.log('Press Ctrl+C to stop');
  
  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down mock services...');
    orchestrator.close();
    planning.close();
    process.exit(0);
  });
}

// Start services if run directly
if (require.main === module) {
  startMockServices().catch(console.error);
}

module.exports = {
  createOrchestratorMock,
  createPlanningMock,
  startMockServices
};