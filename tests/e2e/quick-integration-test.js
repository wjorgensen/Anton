#!/usr/bin/env node

const axios = require('axios');
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');

// Configuration - use default local ports
const CONFIG = {
  orchestrator: 'http://localhost:3002',
  frontend: 'http://localhost:3000',
  planning: 'http://localhost:3003'
};

const TEST_REPORT = {
  timestamp: new Date().toISOString(),
  environment: CONFIG,
  tests: [],
  summary: {
    passed: 0,
    failed: 0,
    total: 0
  }
};

// Quick health check
async function testServiceHealth() {
  console.log('\n🧪 Testing Service Health...');
  const results = {};
  
  // Test orchestrator
  try {
    await axios.get(`${CONFIG.orchestrator}/health`, { timeout: 2000 });
    results.orchestrator = 'healthy';
    console.log('  ✅ Orchestrator: HEALTHY');
  } catch (e) {
    results.orchestrator = 'offline';
    console.log('  ❌ Orchestrator: OFFLINE');
  }
  
  // Test frontend
  try {
    await axios.get(CONFIG.frontend, { timeout: 2000 });
    results.frontend = 'healthy';
    console.log('  ✅ Frontend: HEALTHY');
  } catch (e) {
    results.frontend = 'offline';
    console.log('  ❌ Frontend: OFFLINE');
  }
  
  // Test planning
  try {
    await axios.get(`${CONFIG.planning}/health`, { timeout: 2000 });
    results.planning = 'healthy';
    console.log('  ✅ Planning Service: HEALTHY');
  } catch (e) {
    results.planning = 'offline';
    console.log('  ❌ Planning Service: OFFLINE');
  }
  
  TEST_REPORT.tests.push({
    name: 'Service Health',
    status: Object.values(results).every(v => v === 'healthy') ? 'passed' : 'failed',
    details: results
  });
}

// Test API endpoints
async function testAPIEndpoints() {
  console.log('\n🧪 Testing API Endpoints...');
  const api = axios.create({ 
    baseURL: CONFIG.orchestrator,
    timeout: 5000
  });
  
  const endpoints = [
    { path: '/api/projects', method: 'GET', name: 'List Projects' },
    { path: '/api/agents', method: 'GET', name: 'List Agents' },
    { path: '/api/executions', method: 'GET', name: 'List Executions' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await api[endpoint.method.toLowerCase()](endpoint.path);
      console.log(`  ✅ ${endpoint.name}: ${response.status}`);
      TEST_REPORT.tests.push({
        name: endpoint.name,
        status: 'passed',
        responseStatus: response.status
      });
      TEST_REPORT.summary.passed++;
    } catch (e) {
      console.log(`  ❌ ${endpoint.name}: ${e.message}`);
      TEST_REPORT.tests.push({
        name: endpoint.name,
        status: 'failed',
        error: e.message
      });
      TEST_REPORT.summary.failed++;
    }
  }
}

// Test WebSocket connection
async function testWebSocket() {
  console.log('\n🧪 Testing WebSocket Connection...');
  
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:3002/ws`);
    let timeout = setTimeout(() => {
      console.log('  ❌ WebSocket: Connection timeout');
      TEST_REPORT.tests.push({
        name: 'WebSocket Connection',
        status: 'failed',
        error: 'Connection timeout'
      });
      TEST_REPORT.summary.failed++;
      ws.close();
      resolve();
    }, 5000);
    
    ws.on('open', () => {
      clearTimeout(timeout);
      console.log('  ✅ WebSocket: Connected');
      TEST_REPORT.tests.push({
        name: 'WebSocket Connection',
        status: 'passed'
      });
      TEST_REPORT.summary.passed++;
      ws.close();
      resolve();
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`  ❌ WebSocket: ${error.message}`);
      TEST_REPORT.tests.push({
        name: 'WebSocket Connection',
        status: 'failed',
        error: error.message
      });
      TEST_REPORT.summary.failed++;
      resolve();
    });
  });
}

// Test project creation
async function testProjectCreation() {
  console.log('\n🧪 Testing Project Creation...');
  
  try {
    const api = axios.create({ 
      baseURL: CONFIG.orchestrator,
      timeout: 10000
    });
    
    const projectData = {
      name: `Integration Test ${Date.now()}`,
      description: 'Quick integration test project',
      settings: {
        executionMode: 'sequential',
        maxConcurrentNodes: 1
      }
    };
    
    const response = await api.post('/api/projects', projectData);
    
    if (response.data && response.data.id) {
      console.log(`  ✅ Project created: ${response.data.id}`);
      TEST_REPORT.tests.push({
        name: 'Project Creation',
        status: 'passed',
        projectId: response.data.id
      });
      TEST_REPORT.summary.passed++;
      
      // Try to retrieve the project
      const getResponse = await api.get(`/api/projects/${response.data.id}`);
      if (getResponse.data.id === response.data.id) {
        console.log('  ✅ Project retrieval: Success');
        TEST_REPORT.tests.push({
          name: 'Project Retrieval',
          status: 'passed'
        });
        TEST_REPORT.summary.passed++;
      }
    } else {
      throw new Error('Invalid response structure');
    }
  } catch (e) {
    console.log(`  ❌ Project creation failed: ${e.message}`);
    TEST_REPORT.tests.push({
      name: 'Project Creation',
      status: 'failed',
      error: e.message
    });
    TEST_REPORT.summary.failed++;
  }
}

// Test flow generation
async function testFlowGeneration() {
  console.log('\n🧪 Testing Flow Generation...');
  
  try {
    const api = axios.create({ 
      baseURL: CONFIG.orchestrator,
      timeout: 15000
    });
    
    const flowRequest = {
      requirements: 'Create a simple REST API with one endpoint',
      constraints: {
        maxNodes: 5,
        preferredAgents: ['setup/nodejs', 'execution/api-endpoint']
      }
    };
    
    const response = await api.post('/api/planning/generate', flowRequest);
    
    if (response.data && response.data.nodes && response.data.nodes.length > 0) {
      console.log(`  ✅ Flow generated: ${response.data.nodes.length} nodes`);
      TEST_REPORT.tests.push({
        name: 'Flow Generation',
        status: 'passed',
        nodeCount: response.data.nodes.length
      });
      TEST_REPORT.summary.passed++;
    } else {
      throw new Error('No nodes generated');
    }
  } catch (e) {
    console.log(`  ❌ Flow generation failed: ${e.message}`);
    TEST_REPORT.tests.push({
      name: 'Flow Generation',
      status: 'failed',
      error: e.message
    });
    TEST_REPORT.summary.failed++;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Quick Integration Tests');
  console.log('=' .repeat(50));
  
  const startTime = Date.now();
  
  // Run all tests
  await testServiceHealth();
  await testAPIEndpoints();
  await testWebSocket();
  await testProjectCreation();
  await testFlowGeneration();
  
  // Calculate totals
  TEST_REPORT.summary.total = TEST_REPORT.tests.length;
  TEST_REPORT.summary.duration = Date.now() - startTime;
  TEST_REPORT.summary.successRate = TEST_REPORT.summary.total > 0 
    ? (TEST_REPORT.summary.passed / TEST_REPORT.summary.total * 100).toFixed(2) + '%'
    : '0%';
  
  // Display summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Summary');
  console.log('=' .repeat(50));
  console.log(`Total Tests: ${TEST_REPORT.summary.total}`);
  console.log(`Passed: ${TEST_REPORT.summary.passed}`);
  console.log(`Failed: ${TEST_REPORT.summary.failed}`);
  console.log(`Success Rate: ${TEST_REPORT.summary.successRate}`);
  console.log(`Duration: ${(TEST_REPORT.summary.duration / 1000).toFixed(2)}s`);
  
  // Save report
  const reportPath = path.join(__dirname, '../../test-reports/quick-integration.json');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(TEST_REPORT, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(TEST_REPORT.summary.failed > 0 ? 1 : 0);
}

// Check if we have axios and ws installed
const checkDependencies = async () => {
  try {
    require('axios');
    require('ws');
    return true;
  } catch (e) {
    console.log('⚠️ Missing dependencies. Installing...');
    const { execSync } = require('child_process');
    execSync('npm install axios ws', { stdio: 'inherit', cwd: __dirname });
    return true;
  }
};

// Run
checkDependencies().then(() => {
  runTests().catch(console.error);
});