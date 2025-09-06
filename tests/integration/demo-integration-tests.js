#!/usr/bin/env node

const axios = require('axios');
const io = require('socket.io-client');
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');

const API_URL = process.env.API_URL || 'http://localhost:3002';
const PLANNING_URL = process.env.PLANNING_SERVICE_URL || 'http://localhost:3003';
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

// Generate auth token
const generateToken = (userId = 'test-user-1') => {
  return jwt.sign({ userId, role: 'developer' }, JWT_SECRET, { expiresIn: '1h' });
};

// Test results storage
const results = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: {}
};

// Helper to run a test
async function runTest(name, fn) {
  const startTime = Date.now();
  let status = 'passed';
  let error = null;

  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    status = 'failed';
    error = e.message;
    console.log(`✗ ${name}: ${error}`);
  }

  const duration = Date.now() - startTime;
  results.tests.push({ name, status, duration, error });
  return status === 'passed';
}

// Test Suite 1: API-to-Database Flow
async function testAPIDatabase() {
  console.log('\n=== API-to-Database Flow Tests ===');
  
  const authClient = axios.create({
    baseURL: API_URL,
    headers: {
      'Authorization': `Bearer ${generateToken()}`,
      'Content-Type': 'application/json'
    },
    timeout: 5000
  });

  let projectId;

  await runTest('Create project via API', async () => {
    const response = await authClient.post('/api/projects', {
      name: 'Demo Test Project',
      description: 'Testing API integration',
      flow: {
        nodes: [
          { id: 'node1', type: 'setup', position: { x: 100, y: 100 }, data: { label: 'Setup' } }
        ],
        edges: []
      }
    });
    
    if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}`);
    projectId = response.data.id;
    if (!projectId) throw new Error('No project ID returned');
  });

  await runTest('Retrieve project from API', async () => {
    const response = await authClient.get(`/api/projects/${projectId}`);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (response.data.name !== 'Demo Test Project') throw new Error('Project name mismatch');
  });

  await runTest('Update project via API', async () => {
    const response = await authClient.put(`/api/projects/${projectId}`, {
      name: 'Updated Demo Project',
      description: 'Updated description'
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (response.data.name !== 'Updated Demo Project') throw new Error('Update failed');
  });

  await runTest('List projects with pagination', async () => {
    const response = await authClient.get('/api/projects?page=1&limit=10');
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (!Array.isArray(response.data.projects)) throw new Error('Projects not returned as array');
  });

  await runTest('Create execution record', async () => {
    const response = await authClient.post('/api/executions', {
      projectId,
      status: 'running'
    });
    if (response.status !== 201) throw new Error(`Expected 201, got ${response.status}`);
  });

  await runTest('Handle authentication errors', async () => {
    const invalidClient = axios.create({
      baseURL: API_URL,
      headers: { 'Authorization': 'Bearer invalid-token' }
    });
    
    try {
      await invalidClient.get('/api/projects');
      throw new Error('Should have failed authentication');
    } catch (error) {
      if (error.response?.status !== 401) {
        throw new Error(`Expected 401, got ${error.response?.status}`);
      }
    }
  });
}

// Test Suite 2: Planning Service Integration
async function testPlanningService() {
  console.log('\n=== Planning Service Integration Tests ===');
  
  const planningClient = axios.create({
    baseURL: PLANNING_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000
  });

  await runTest('Generate flow from requirements', async () => {
    const response = await planningClient.post('/api/generate', {
      requirements: {
        description: 'Build a REST API with authentication',
        features: ['User management', 'JWT auth', 'Database']
      }
    });
    
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (!response.data.flow) throw new Error('No flow generated');
    if (!response.data.flow.nodes || response.data.flow.nodes.length < 3) {
      throw new Error('Insufficient nodes in generated flow');
    }
  });

  await runTest('Generate complex multi-service flow', async () => {
    const response = await planningClient.post('/api/generate', {
      requirements: {
        description: 'Microservices architecture',
        services: [
          { name: 'API Gateway', type: 'nodejs' },
          { name: 'User Service', type: 'nodejs' }
        ]
      }
    });
    
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    const nodes = response.data.flow.nodes;
    if (nodes.length < 5) throw new Error('Expected more nodes for complex architecture');
  });

  await runTest('Validate agent references in flow', async () => {
    const response = await planningClient.post('/api/generate', {
      requirements: { description: 'Simple API', minimal: true }
    });
    
    const nodes = response.data.flow.nodes;
    for (const node of nodes) {
      if (!node.data.agentId) throw new Error(`Node ${node.id} missing agentId`);
      if (!node.data.category) throw new Error(`Node ${node.id} missing category`);
    }
  });

  await runTest('Handle invalid requirements gracefully', async () => {
    try {
      await planningClient.post('/api/generate', { requirements: null });
      throw new Error('Should have rejected null requirements');
    } catch (error) {
      if (error.response?.status !== 400) {
        throw new Error(`Expected 400, got ${error.response?.status}`);
      }
    }
  });
}

// Test Suite 3: WebSocket Real-time Updates
async function testWebSocketRealtime() {
  console.log('\n=== WebSocket Real-time Updates Tests ===');

  const authClient = axios.create({
    baseURL: API_URL,
    headers: {
      'Authorization': `Bearer ${generateToken()}`,
      'Content-Type': 'application/json'
    }
  });

  await runTest('WebSocket connects with authentication', async () => {
    const socket = io(API_URL, {
      auth: { token: generateToken() },
      transports: ['websocket']
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        if (!socket.connected) reject(new Error('Not connected'));
        socket.close();
        resolve();
      });
      socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  });

  await runTest('WebSocket rejects invalid authentication', async () => {
    const socket = io(API_URL, {
      auth: { token: 'invalid-token' },
      transports: ['websocket']
    });

    await new Promise((resolve, reject) => {
      socket.on('connect_error', (error) => {
        if (error.message.includes('Authentication')) {
          socket.close();
          resolve();
        } else {
          reject(new Error('Expected authentication error'));
        }
      });
      socket.on('connect', () => {
        socket.close();
        reject(new Error('Should not connect with invalid token'));
      });
      setTimeout(() => resolve(), 2000);
    });
  });

  await runTest('WebSocket broadcasts flow events', async () => {
    const socket = io(API_URL, {
      auth: { token: generateToken() },
      transports: ['websocket']
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', async () => {
        socket.on('flow:started', (data) => {
          if (data.executionId && data.status) {
            socket.close();
            resolve();
          } else {
            reject(new Error('Invalid flow:started event data'));
          }
        });

        // Trigger event via API
        await authClient.post('/api/executions', {
          projectId: 'test-project',
          status: 'running'
        });
      });
      
      socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Event timeout')), 5000);
    });
  });

  await runTest('WebSocket handles node status updates', async () => {
    const socket = io(API_URL, {
      auth: { token: generateToken() },
      transports: ['websocket']
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', async () => {
        socket.on('node:started', (data) => {
          if (data.nodeId === 'test-node' && data.status === 'running') {
            socket.close();
            resolve();
          }
        });

        // Trigger node update
        await authClient.post('/api/node-status', {
          executionId: 'test-exec',
          nodeId: 'test-node',
          status: 'running'
        });
      });

      setTimeout(() => reject(new Error('Node event timeout')), 5000);
    });
  });

  await runTest('WebSocket streams terminal output', async () => {
    const socket = io(API_URL, {
      auth: { token: generateToken() },
      transports: ['websocket']
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', async () => {
        socket.on('terminal:output', (data) => {
          if (data.line && data.type) {
            socket.close();
            resolve();
          }
        });

        await authClient.post('/api/terminal-output', {
          executionId: 'test-exec',
          nodeId: 'node1',
          line: 'Test output',
          type: 'stdout'
        });
      });

      setTimeout(() => reject(new Error('Terminal output timeout')), 5000);
    });
  });
}

// Performance metrics
async function testPerformance() {
  console.log('\n=== Performance Metrics ===');

  const authClient = axios.create({
    baseURL: API_URL,
    headers: {
      'Authorization': `Bearer ${generateToken()}`,
      'Content-Type': 'application/json'
    }
  });

  const operations = [
    { name: 'Create Project', fn: () => authClient.post('/api/projects', {
      name: `Perf Test ${Date.now()}`,
      flow: { nodes: [], edges: [] }
    })},
    { name: 'List Projects', fn: () => authClient.get('/api/projects') },
    { name: 'Generate Flow', fn: () => axios.post(`${PLANNING_URL}/api/generate`, {
      requirements: { description: 'Simple API' }
    })}
  ];

  for (const op of operations) {
    const startTime = Date.now();
    try {
      await op.fn();
      const duration = Date.now() - startTime;
      console.log(`  ${op.name}: ${duration}ms ${duration < 1000 ? '✓' : '⚠'}`);
    } catch (error) {
      console.log(`  ${op.name}: Failed - ${error.message}`);
    }
  }
}

// Main execution
async function main() {
  console.log('====================================');
  console.log('   Anton Integration Tests (Demo)   ');
  console.log('====================================');

  const startTime = Date.now();

  // Run test suites
  await testAPIDatabase();
  await testPlanningService();
  await testWebSocketRealtime();
  await testPerformance();

  // Generate summary
  const totalTests = results.tests.length;
  const passedTests = results.tests.filter(t => t.status === 'passed').length;
  const failedTests = results.tests.filter(t => t.status === 'failed').length;
  const totalDuration = Date.now() - startTime;

  results.summary = {
    total: totalTests,
    passed: passedTests,
    failed: failedTests,
    successRate: ((passedTests / totalTests) * 100).toFixed(2) + '%',
    duration: totalDuration
  };

  // Display summary
  console.log('\n====================================');
  console.log('           Test Summary             ');
  console.log('====================================');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Success Rate: ${results.summary.successRate}`);
  console.log(`Duration: ${totalDuration}ms`);

  // Save report
  const reportPath = path.join(__dirname, '../../test-reports/phase1-integration.json');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nReport saved to: ${reportPath}`);

  return failedTests === 0 ? 0 : 1;
}

// Export for use in other test runners
module.exports = { runTest, testAPIDatabase, testPlanningService, testWebSocketRealtime };

// Run if executed directly
if (require.main === module) {
  main().then(process.exit).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}