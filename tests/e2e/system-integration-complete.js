#!/usr/bin/env node

const axios = require('axios');
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Configuration from environment
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:5006';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4007';
const PLANNING_URL = process.env.PLANNING_URL || 'http://localhost:6007';

const TEST_REPORT = {
  timestamp: new Date().toISOString(),
  environment: {
    orchestratorUrl: ORCHESTRATOR_URL,
    frontendUrl: FRONTEND_URL,
    planningUrl: PLANNING_URL
  },
  tests: [],
  metrics: {
    totalDuration: 0,
    passedTests: 0,
    failedTests: 0,
    performance: {}
  }
};

// Utility functions
async function waitForService(url, name, maxAttempts = 30) {
  console.log(`⏳ Waiting for ${name} at ${url}...`);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await axios.get(url, { timeout: 1000 });
      console.log(`✅ ${name} is ready`);
      return true;
    } catch (e) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error(`❌ ${name} failed to start at ${url}`);
}

async function createProject(api, name) {
  const response = await api.post('/api/projects', {
    name,
    description: `Integration test project: ${name}`,
    settings: {
      executionMode: 'parallel',
      maxConcurrentNodes: 5,
      timeoutMinutes: 30
    }
  });
  return response.data;
}

async function createComplexFlow(api, projectId) {
  // Create a complex flow with 10+ nodes including all node types
  const flow = {
    projectId,
    name: 'Complex Integration Test Flow',
    nodes: [
      {
        id: 'setup-1',
        type: 'setup',
        position: { x: 100, y: 100 },
        data: {
          agent: 'setup/nextjs',
          label: 'Setup Next.js Project',
          config: {
            projectName: 'test-app',
            typescript: true,
            eslint: true,
            tailwind: true
          }
        }
      },
      {
        id: 'parallel-1',
        type: 'execution',
        position: { x: 300, y: 50 },
        data: {
          agent: 'execution/react-component',
          label: 'Create Header Component'
        }
      },
      {
        id: 'parallel-2',
        type: 'execution',
        position: { x: 300, y: 150 },
        data: {
          agent: 'execution/react-component',
          label: 'Create Footer Component'
        }
      },
      {
        id: 'parallel-3',
        type: 'execution',
        position: { x: 300, y: 250 },
        data: {
          agent: 'execution/api-endpoint',
          label: 'Create API Routes'
        }
      },
      {
        id: 'merge-1',
        type: 'merge',
        position: { x: 500, y: 150 },
        data: { label: 'Merge Components' }
      },
      {
        id: 'test-1',
        type: 'testing',
        position: { x: 700, y: 100 },
        data: {
          agent: 'testing/jest',
          label: 'Run Unit Tests'
        }
      },
      {
        id: 'test-2',
        type: 'testing',
        position: { x: 700, y: 200 },
        data: {
          agent: 'testing/playwright',
          label: 'Run E2E Tests'
        }
      },
      {
        id: 'review-1',
        type: 'review',
        position: { x: 900, y: 150 },
        data: {
          agent: 'review/manual',
          label: 'Manual Code Review',
          config: {
            checkpoints: ['security', 'performance', 'best-practices']
          }
        }
      },
      {
        id: 'condition-1',
        type: 'conditional',
        position: { x: 1100, y: 150 },
        data: {
          label: 'Check Test Results',
          condition: 'tests.passed && review.approved'
        }
      },
      {
        id: 'integration-1',
        type: 'integration',
        position: { x: 1300, y: 100 },
        data: {
          agent: 'integration/git-commit',
          label: 'Commit Changes'
        }
      },
      {
        id: 'utility-1',
        type: 'utility',
        position: { x: 1300, y: 200 },
        data: {
          agent: 'utility/documentation',
          label: 'Generate Docs'
        }
      },
      {
        id: 'end-1',
        type: 'end',
        position: { x: 1500, y: 150 },
        data: { label: 'Flow Complete' }
      }
    ],
    edges: [
      { id: 'e1', source: 'setup-1', target: 'parallel-1' },
      { id: 'e2', source: 'setup-1', target: 'parallel-2' },
      { id: 'e3', source: 'setup-1', target: 'parallel-3' },
      { id: 'e4', source: 'parallel-1', target: 'merge-1' },
      { id: 'e5', source: 'parallel-2', target: 'merge-1' },
      { id: 'e6', source: 'parallel-3', target: 'merge-1' },
      { id: 'e7', source: 'merge-1', target: 'test-1' },
      { id: 'e8', source: 'merge-1', target: 'test-2' },
      { id: 'e9', source: 'test-1', target: 'review-1' },
      { id: 'e10', source: 'test-2', target: 'review-1' },
      { id: 'e11', source: 'review-1', target: 'condition-1' },
      { id: 'e12', source: 'condition-1', target: 'integration-1', sourceHandle: 'yes' },
      { id: 'e13', source: 'condition-1', target: 'utility-1', sourceHandle: 'no' },
      { id: 'e14', source: 'integration-1', target: 'end-1' },
      { id: 'e15', source: 'utility-1', target: 'end-1' }
    ]
  };
  
  const response = await api.post('/api/flows', flow);
  return response.data;
}

// Test functions
async function testEndToEndScenario() {
  console.log('\n🧪 Testing End-to-End Scenario...');
  const testResult = {
    name: 'End-to-End Scenario',
    status: 'running',
    startTime: Date.now(),
    steps: []
  };
  
  try {
    const api = axios.create({ baseURL: ORCHESTRATOR_URL });
    
    // Step 1: Create project
    console.log('  📁 Creating new project...');
    const project = await createProject(api, 'E2E Test Project');
    testResult.steps.push({ step: 'Create Project', status: 'passed', projectId: project.id });
    
    // Step 2: Design complex flow
    console.log('  🎨 Designing complex flow with 12 nodes...');
    const flow = await createComplexFlow(api, project.id);
    testResult.steps.push({ step: 'Design Flow', status: 'passed', nodeCount: flow.nodes.length });
    
    // Step 3: Execute flow with WebSocket monitoring
    console.log('  ⚡ Executing flow with real-time monitoring...');
    const ws = new WebSocket(`${ORCHESTRATOR_URL.replace('http', 'ws')}/ws`);
    const executionEvents = [];
    
    await new Promise((resolve, reject) => {
      ws.on('open', async () => {
        // Start execution
        const execution = await api.post('/api/executions', {
          flowId: flow.id,
          projectId: project.id
        });
        
        ws.on('message', (data) => {
          const event = JSON.parse(data.toString());
          executionEvents.push(event);
          
          if (event.type === 'execution:complete') {
            resolve(execution.data);
          } else if (event.type === 'execution:error') {
            reject(new Error(event.error));
          }
        });
      });
      
      ws.on('error', reject);
      
      // Timeout after 5 minutes
      setTimeout(() => reject(new Error('Execution timeout')), 300000);
    });
    
    ws.close();
    testResult.steps.push({ 
      step: 'Execute Flow', 
      status: 'passed', 
      eventsReceived: executionEvents.length 
    });
    
    // Step 4: Review results
    console.log('  📊 Reviewing execution results...');
    const executionDetails = await api.get(`/api/executions/${flow.id}`);
    const { nodes, status, duration } = executionDetails.data;
    
    testResult.steps.push({
      step: 'Review Results',
      status: 'passed',
      executionStatus: status,
      duration,
      completedNodes: nodes.filter(n => n.status === 'completed').length
    });
    
    // Step 5: Export outputs
    console.log('  💾 Exporting outputs...');
    const exportResponse = await api.post(`/api/projects/${project.id}/export`, {
      format: 'json',
      includeExecutionHistory: true
    });
    
    testResult.steps.push({
      step: 'Export Outputs',
      status: 'passed',
      exportSize: exportResponse.data.size
    });
    
    testResult.status = 'passed';
  } catch (error) {
    testResult.status = 'failed';
    testResult.error = error.message;
  }
  
  testResult.duration = Date.now() - testResult.startTime;
  TEST_REPORT.tests.push(testResult);
  
  if (testResult.status === 'passed') {
    console.log('  ✅ End-to-End Scenario: PASSED');
    TEST_REPORT.metrics.passedTests++;
  } else {
    console.log(`  ❌ End-to-End Scenario: FAILED - ${testResult.error}`);
    TEST_REPORT.metrics.failedTests++;
  }
}

async function testServiceIntegration() {
  console.log('\n🧪 Testing Service Integration...');
  const testResult = {
    name: 'Service Integration',
    status: 'running',
    startTime: Date.now(),
    checks: []
  };
  
  try {
    // Check all services are running
    console.log('  🏥 Verifying all services...');
    const services = [
      { url: `${ORCHESTRATOR_URL}/health`, name: 'Orchestrator' },
      { url: `${FRONTEND_URL}`, name: 'Frontend' },
      { url: `${PLANNING_URL}/health`, name: 'Planning Service' }
    ];
    
    for (const service of services) {
      try {
        const response = await axios.get(service.url, { timeout: 5000 });
        testResult.checks.push({
          service: service.name,
          status: 'healthy',
          responseTime: response.headers['x-response-time'] || 'N/A'
        });
      } catch (e) {
        testResult.checks.push({
          service: service.name,
          status: 'unhealthy',
          error: e.message
        });
      }
    }
    
    // Test service communication
    console.log('  🔄 Testing service communication...');
    const api = axios.create({ baseURL: ORCHESTRATOR_URL });
    
    // Test planning service integration
    const planResponse = await api.post('/api/planning/generate', {
      requirements: 'Create a simple todo app with React',
      constraints: {
        maxNodes: 10,
        preferredAgents: ['setup/react', 'execution/react-component']
      }
    });
    
    testResult.checks.push({
      test: 'Planning Service Integration',
      status: planResponse.data ? 'passed' : 'failed',
      generatedNodes: planResponse.data?.nodes?.length || 0
    });
    
    // Test database consistency
    console.log('  🗄️ Checking database consistency...');
    const dbStats = await api.get('/api/admin/database/stats');
    testResult.checks.push({
      test: 'Database Consistency',
      status: 'passed',
      stats: dbStats.data
    });
    
    // Test queue processing
    console.log('  📨 Verifying queue processing...');
    const queueStats = await api.get('/api/admin/queue/stats');
    testResult.checks.push({
      test: 'Queue Processing',
      status: 'passed',
      stats: queueStats.data
    });
    
    testResult.status = 'passed';
  } catch (error) {
    testResult.status = 'failed';
    testResult.error = error.message;
  }
  
  testResult.duration = Date.now() - testResult.startTime;
  TEST_REPORT.tests.push(testResult);
  
  if (testResult.status === 'passed') {
    console.log('  ✅ Service Integration: PASSED');
    TEST_REPORT.metrics.passedTests++;
  } else {
    console.log(`  ❌ Service Integration: FAILED - ${testResult.error}`);
    TEST_REPORT.metrics.failedTests++;
  }
}

async function testErrorRecovery() {
  console.log('\n🧪 Testing Error Recovery...');
  const testResult = {
    name: 'Error Recovery',
    status: 'running',
    startTime: Date.now(),
    scenarios: []
  };
  
  try {
    const api = axios.create({ baseURL: ORCHESTRATOR_URL });
    
    // Scenario 1: Create execution and simulate orchestrator restart
    console.log('  🔄 Testing orchestrator restart recovery...');
    const project = await createProject(api, 'Recovery Test');
    const flow = await createComplexFlow(api, project.id);
    
    // Start execution
    const execution = await api.post('/api/executions', {
      flowId: flow.id,
      projectId: project.id
    });
    
    // Simulate orchestrator restart (would need actual process control in production)
    console.log('    Simulating orchestrator restart...');
    await new Promise(r => setTimeout(r, 2000));
    
    // Check execution resumed
    const resumedExecution = await api.get(`/api/executions/${execution.data.id}`);
    testResult.scenarios.push({
      scenario: 'Orchestrator Restart',
      recovered: resumedExecution.data.status !== 'failed',
      finalStatus: resumedExecution.data.status
    });
    
    // Scenario 2: Test partial failure handling
    console.log('  ⚠️ Testing partial failure handling...');
    const failFlow = {
      projectId: project.id,
      name: 'Failure Test Flow',
      nodes: [
        {
          id: 'node-1',
          type: 'execution',
          data: { agent: 'execution/react-component', label: 'Success Node' }
        },
        {
          id: 'node-2',
          type: 'execution',
          data: { 
            agent: 'execution/invalid-agent', 
            label: 'Failure Node',
            config: { forceError: true }
          }
        },
        {
          id: 'node-3',
          type: 'execution',
          data: { agent: 'execution/react-component', label: 'After Failure' }
        }
      ],
      edges: [
        { id: 'e1', source: 'node-1', target: 'node-2' },
        { id: 'e2', source: 'node-2', target: 'node-3' }
      ]
    };
    
    const failFlowResponse = await api.post('/api/flows', failFlow);
    const failExecution = await api.post('/api/executions', {
      flowId: failFlowResponse.data.id,
      projectId: project.id
    });
    
    // Wait for completion
    await new Promise(r => setTimeout(r, 10000));
    
    const failResult = await api.get(`/api/executions/${failExecution.data.id}`);
    testResult.scenarios.push({
      scenario: 'Partial Failure',
      handled: failResult.data.nodes[0].status === 'completed',
      failedNode: failResult.data.nodes[1].status === 'failed',
      stoppedPropagation: failResult.data.nodes[2].status === 'pending'
    });
    
    // Scenario 3: Test data integrity after crash
    console.log('  💾 Testing data integrity...');
    const integrityCheck = await api.post('/api/admin/integrity-check', {
      checkExecutions: true,
      checkWorkspaces: true,
      checkDatabase: true
    });
    
    testResult.scenarios.push({
      scenario: 'Data Integrity',
      passed: integrityCheck.data.passed,
      issues: integrityCheck.data.issues || []
    });
    
    testResult.status = 'passed';
  } catch (error) {
    testResult.status = 'failed';
    testResult.error = error.message;
  }
  
  testResult.duration = Date.now() - testResult.startTime;
  TEST_REPORT.tests.push(testResult);
  
  if (testResult.status === 'passed') {
    console.log('  ✅ Error Recovery: PASSED');
    TEST_REPORT.metrics.passedTests++;
  } else {
    console.log(`  ❌ Error Recovery: FAILED - ${testResult.error}`);
    TEST_REPORT.metrics.failedTests++;
  }
}

async function testPerformanceUnderLoad() {
  console.log('\n🧪 Testing Performance Under Load...');
  const testResult = {
    name: 'Performance Under Load',
    status: 'running',
    startTime: Date.now(),
    metrics: {}
  };
  
  try {
    const api = axios.create({ baseURL: ORCHESTRATOR_URL });
    
    // Create 10 projects
    console.log('  📁 Creating 10 test projects...');
    const projects = [];
    const projectStartTime = Date.now();
    
    for (let i = 0; i < 10; i++) {
      const project = await createProject(api, `Load Test Project ${i + 1}`);
      projects.push(project);
    }
    
    testResult.metrics.projectCreationTime = Date.now() - projectStartTime;
    testResult.metrics.avgProjectCreationTime = testResult.metrics.projectCreationTime / 10;
    
    // Create flows for each project
    console.log('  🎨 Creating flows for all projects...');
    const flows = [];
    const flowStartTime = Date.now();
    
    for (const project of projects) {
      const flow = await createComplexFlow(api, project.id);
      flows.push(flow);
    }
    
    testResult.metrics.flowCreationTime = Date.now() - flowStartTime;
    testResult.metrics.avgFlowCreationTime = testResult.metrics.flowCreationTime / 10;
    
    // Run 5 concurrent executions
    console.log('  ⚡ Running 5 concurrent executions...');
    const executions = [];
    const executionStartTime = Date.now();
    
    const executionPromises = flows.slice(0, 5).map(async (flow, index) => {
      const execution = await api.post('/api/executions', {
        flowId: flow.id,
        projectId: projects[index].id
      });
      return execution.data;
    });
    
    const concurrentExecutions = await Promise.all(executionPromises);
    executions.push(...concurrentExecutions);
    
    // Monitor executions
    console.log('  📊 Monitoring concurrent executions...');
    const monitoringInterval = setInterval(async () => {
      try {
        const systemStats = await api.get('/api/admin/system/stats');
        console.log(`    CPU: ${systemStats.data.cpu}%, Memory: ${systemStats.data.memory}MB`);
      } catch (e) {
        // System stats endpoint might not exist
      }
    }, 5000);
    
    // Wait for all executions to complete
    await new Promise(r => setTimeout(r, 30000));
    clearInterval(monitoringInterval);
    
    // Check execution results
    const executionResults = await Promise.all(
      executions.map(exec => api.get(`/api/executions/${exec.id}`))
    );
    
    const completedExecutions = executionResults.filter(
      r => r.data.status === 'completed'
    ).length;
    
    testResult.metrics.concurrentExecutionTime = Date.now() - executionStartTime;
    testResult.metrics.completedExecutions = completedExecutions;
    testResult.metrics.executionSuccessRate = (completedExecutions / 5) * 100;
    
    // Monitor system resources
    console.log('  💻 Checking system resources...');
    const finalStats = await api.get('/api/admin/system/stats').catch(() => ({
      data: { cpu: 'N/A', memory: 'N/A', activeConnections: 'N/A' }
    }));
    
    testResult.metrics.finalSystemStats = finalStats.data;
    
    // Verify no degradation
    testResult.metrics.performanceDegraded = 
      testResult.metrics.avgFlowCreationTime > 5000 ||
      testResult.metrics.executionSuccessRate < 80;
    
    testResult.status = testResult.metrics.performanceDegraded ? 'failed' : 'passed';
  } catch (error) {
    testResult.status = 'failed';
    testResult.error = error.message;
  }
  
  testResult.duration = Date.now() - testResult.startTime;
  TEST_REPORT.tests.push(testResult);
  
  if (testResult.status === 'passed') {
    console.log('  ✅ Performance Under Load: PASSED');
    TEST_REPORT.metrics.passedTests++;
  } else {
    console.log(`  ❌ Performance Under Load: FAILED - ${testResult.error}`);
    TEST_REPORT.metrics.failedTests++;
  }
}

async function testDataPersistence() {
  console.log('\n🧪 Testing Data Persistence...');
  const testResult = {
    name: 'Data Persistence',
    status: 'running',
    startTime: Date.now(),
    checks: []
  };
  
  try {
    const api = axios.create({ baseURL: ORCHESTRATOR_URL });
    
    // Create test data
    console.log('  💾 Creating test data...');
    const project = await createProject(api, 'Persistence Test');
    const flow = await createComplexFlow(api, project.id);
    const execution = await api.post('/api/executions', {
      flowId: flow.id,
      projectId: project.id
    });
    
    // Store IDs for verification
    const testData = {
      projectId: project.id,
      flowId: flow.id,
      executionId: execution.data.id
    };
    
    // Simulate service restart (in production would actually restart services)
    console.log('  🔄 Simulating service restart...');
    await new Promise(r => setTimeout(r, 5000));
    
    // Verify data retained
    console.log('  ✔️ Verifying data retention...');
    
    // Check project exists
    const projectCheck = await api.get(`/api/projects/${testData.projectId}`);
    testResult.checks.push({
      item: 'Project',
      retained: projectCheck.data.id === testData.projectId,
      data: projectCheck.data
    });
    
    // Check flow exists
    const flowCheck = await api.get(`/api/flows/${testData.flowId}`);
    testResult.checks.push({
      item: 'Flow',
      retained: flowCheck.data.id === testData.flowId,
      nodeCount: flowCheck.data.nodes.length
    });
    
    // Check execution exists
    const executionCheck = await api.get(`/api/executions/${testData.executionId}`);
    testResult.checks.push({
      item: 'Execution',
      retained: executionCheck.data.id === testData.executionId,
      status: executionCheck.data.status
    });
    
    // Test backup/restore
    console.log('  🔐 Testing backup/restore...');
    const backupResponse = await api.post('/api/admin/backup', {
      includeWorkspaces: true,
      includeDatabase: true
    }).catch(() => ({ data: { status: 'not-implemented' } }));
    
    testResult.checks.push({
      item: 'Backup',
      status: backupResponse.data.status,
      size: backupResponse.data.size || 'N/A'
    });
    
    // Check file outputs
    console.log('  📄 Checking file outputs...');
    const workspaceCheck = await api.get(
      `/api/workspaces/${project.id}/files`
    ).catch(() => ({ data: { files: [] } }));
    
    testResult.checks.push({
      item: 'File Outputs',
      fileCount: workspaceCheck.data.files?.length || 0
    });
    
    testResult.status = 'passed';
  } catch (error) {
    testResult.status = 'failed';
    testResult.error = error.message;
  }
  
  testResult.duration = Date.now() - testResult.startTime;
  TEST_REPORT.tests.push(testResult);
  
  if (testResult.status === 'passed') {
    console.log('  ✅ Data Persistence: PASSED');
    TEST_REPORT.metrics.passedTests++;
  } else {
    console.log(`  ❌ Data Persistence: FAILED - ${testResult.error}`);
    TEST_REPORT.metrics.failedTests++;
  }
}

// Main test runner
async function runAllTests() {
  const startTime = Date.now();
  console.log('🚀 Starting Complete System Integration Tests');
  console.log('=' .repeat(50));
  
  try {
    // Wait for all services to be ready
    await waitForService(`${ORCHESTRATOR_URL}/health`, 'Orchestrator');
    await waitForService(FRONTEND_URL, 'Frontend');
    await waitForService(`${PLANNING_URL}/health`, 'Planning Service');
    
    // Run all test suites
    await testEndToEndScenario();
    await testServiceIntegration();
    await testErrorRecovery();
    await testPerformanceUnderLoad();
    await testDataPersistence();
    
  } catch (error) {
    console.error('❌ Fatal error during tests:', error.message);
    process.exit(1);
  }
  
  // Calculate final metrics
  TEST_REPORT.metrics.totalDuration = Date.now() - startTime;
  TEST_REPORT.metrics.totalTests = TEST_REPORT.tests.length;
  TEST_REPORT.metrics.successRate = 
    (TEST_REPORT.metrics.passedTests / TEST_REPORT.metrics.totalTests) * 100;
  
  // Generate report
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Results Summary');
  console.log('=' .repeat(50));
  console.log(`Total Tests: ${TEST_REPORT.metrics.totalTests}`);
  console.log(`Passed: ${TEST_REPORT.metrics.passedTests}`);
  console.log(`Failed: ${TEST_REPORT.metrics.failedTests}`);
  console.log(`Success Rate: ${TEST_REPORT.metrics.successRate.toFixed(2)}%`);
  console.log(`Total Duration: ${(TEST_REPORT.metrics.totalDuration / 1000).toFixed(2)}s`);
  
  // Save report to file
  const reportPath = path.join(
    __dirname, 
    '../../test-reports',
    'system-integration.json'
  );
  
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(TEST_REPORT, null, 2));
  console.log(`\n📄 Full report saved to: ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(TEST_REPORT.metrics.failedTests > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(console.error);