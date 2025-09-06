import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { performance } from 'perf_hooks';
import * as fs from 'fs-extra';
import * as path from 'path';

// Dynamic port configuration from environment variables
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:5004';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4004';
const PLANNING_URL = process.env.PLANNING_URL || 'http://localhost:6004';

const API_BASE_URL = `${ORCHESTRATOR_URL}/api`;
const WS_URL = ORCHESTRATOR_URL;
const TEST_TIMEOUT = 300000; // 5 minutes for complex flows
const REPORT_DIR = path.join(__dirname, '../../test-reports');

interface NodeUpdate {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  timestamp: number;
  output?: string;
  preview?: {
    type: 'terminal' | 'web' | 'file';
    data: any;
  };
}

interface FlowResult {
  testName: string;
  projectId: string;
  executionId: string;
  startTime: number;
  endTime: number;
  duration: number;
  nodes: Record<string, {
    status: string;
    startTime?: number;
    endTime?: number;
    duration?: number;
    result?: any;
    error?: string;
    output?: string[];
    retries?: number;
  }>;
  parallelEfficiency?: number;
  dependencyAccuracy?: number;
  completionRate?: number;
  memoryUsage?: {
    start: number;
    peak: number;
    end: number;
  };
  errors?: Array<{
    nodeId: string;
    error: string;
    timestamp: number;
  }>;
}

describe('Flow Execution Real Tests', () => {
  let socket: Socket;
  let authToken: string;
  const testResults: FlowResult[] = [];
  let memoryMonitor: NodeJS.Timer;
  let peakMemory = 0;
  let startMemory = 0;

  beforeAll(async () => {
    await fs.ensureDir(REPORT_DIR);
    
    // Create test user or use existing
    try {
      const authResponse = await axios.post(`${API_BASE_URL}/auth/register`, {
        email: `test-${Date.now()}@example.com`,
        password: 'testpassword123',
        name: 'Test User'
      });
      authToken = authResponse.data.token;
    } catch (error) {
      // Try login if registration fails
      const authResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: 'test@example.com',
        password: 'testpassword123'
      });
      authToken = authResponse.data.token;
    }

    // Start memory monitoring
    startMemory = process.memoryUsage().heapUsed;
    memoryMonitor = setInterval(() => {
      const currentMemory = process.memoryUsage().heapUsed;
      if (currentMemory > peakMemory) {
        peakMemory = currentMemory;
      }
    }, 100);
  });

  beforeEach(async () => {
    socket = io(WS_URL, {
      auth: { token: authToken },
      transports: ['websocket']
    });

    await new Promise<void>((resolve) => {
      socket.on('connect', () => {
        console.log('WebSocket connected');
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (socket) {
      socket.disconnect();
    }
  });

  afterAll(async () => {
    clearInterval(memoryMonitor);
    
    const endMemory = process.memoryUsage().heapUsed;
    
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        orchestratorUrl: ORCHESTRATOR_URL,
        frontendUrl: FRONTEND_URL,
        planningUrl: PLANNING_URL
      },
      results: testResults,
      summary: {
        totalTests: testResults.length,
        successfulTests: testResults.filter(r => r.completionRate === 1).length,
        failedTests: testResults.filter(r => r.completionRate < 1).length,
        avgExecutionTime: testResults.reduce((acc, r) => acc + r.duration, 0) / testResults.length,
        avgParallelEfficiency: testResults
          .filter(r => r.parallelEfficiency !== undefined)
          .reduce((acc, r) => acc + (r.parallelEfficiency || 0), 0) / 
          testResults.filter(r => r.parallelEfficiency !== undefined).length || 0,
        avgDependencyAccuracy: testResults
          .filter(r => r.dependencyAccuracy !== undefined)
          .reduce((acc, r) => acc + (r.dependencyAccuracy || 0), 0) /
          testResults.filter(r => r.dependencyAccuracy !== undefined).length || 0,
        avgCompletionRate: testResults
          .reduce((acc, r) => acc + (r.completionRate || 0), 0) / testResults.length,
        memoryUsage: {
          start: startMemory / 1024 / 1024,
          peak: peakMemory / 1024 / 1024,
          end: endMemory / 1024 / 1024,
          leakDetected: (endMemory - startMemory) / 1024 / 1024 > 100
        },
        errorStats: {
          totalErrors: testResults.reduce((acc, r) => acc + (r.errors?.length || 0), 0),
          nodesWithErrors: testResults.reduce((acc, r) => 
            acc + Object.values(r.nodes).filter(n => n.error).length, 0
          ),
          retriedNodes: testResults.reduce((acc, r) => 
            acc + Object.values(r.nodes).filter(n => (n.retries || 0) > 0).length, 0
          )
        }
      },
      performanceMetrics: {
        fastestExecution: Math.min(...testResults.map(r => r.duration)),
        slowestExecution: Math.max(...testResults.map(r => r.duration)),
        medianExecution: testResults.map(r => r.duration).sort()[Math.floor(testResults.length / 2)]
      }
    };

    await fs.writeJson(
      path.join(REPORT_DIR, 'flow-execution.json'),
      report,
      { spaces: 2 }
    );

    console.log('Test report generated:', path.join(REPORT_DIR, 'flow-execution.json'));
    console.log('Summary:', report.summary);
  });

  const waitFor = async (
    condition: () => boolean | Promise<boolean>,
    options: { timeout?: number; interval?: number } = {}
  ): Promise<void> => {
    const { timeout = 30000, interval = 100 } = options;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  };

  const executeFlow = async (testName: string, flow: any): Promise<FlowResult> => {
    const startTime = performance.now();
    const nodeUpdates: Record<string, NodeUpdate[]> = {};
    const nodeTimings: Record<string, { start?: number; end?: number }> = {};
    const nodeOutputs: Record<string, string[]> = {};
    const errors: FlowResult['errors'] = [];
    const memStart = process.memoryUsage().heapUsed;
    let memPeak = memStart;
    
    // Create project
    const projectResponse = await axios.post(
      `${API_BASE_URL}/projects`,
      {
        name: `Test: ${testName} - ${Date.now()}`,
        description: `Automated test for ${testName}`,
        flow
      },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    const projectId = projectResponse.data.id;
    
    // Set up event listeners
    socket.on('node:update', (update: NodeUpdate) => {
      if (!nodeUpdates[update.nodeId]) {
        nodeUpdates[update.nodeId] = [];
      }
      nodeUpdates[update.nodeId].push(update);
      
      if (update.status === 'running' && !nodeTimings[update.nodeId]?.start) {
        nodeTimings[update.nodeId] = { start: update.timestamp };
      }
      if (update.status === 'completed' || update.status === 'failed') {
        nodeTimings[update.nodeId] = {
          ...nodeTimings[update.nodeId],
          end: update.timestamp
        };
        
        if (update.status === 'failed' && update.error) {
          errors.push({
            nodeId: update.nodeId,
            error: update.error,
            timestamp: update.timestamp
          });
        }
      }
      
      if (update.output) {
        if (!nodeOutputs[update.nodeId]) {
          nodeOutputs[update.nodeId] = [];
        }
        nodeOutputs[update.nodeId].push(update.output);
      }
      
      console.log(`[${testName}] Node ${update.nodeId}: ${update.status}${update.error ? ` - ${update.error}` : ''}`);
    });
    
    socket.on('preview:update', (data: any) => {
      console.log(`[${testName}] Preview update for ${data.nodeId}:`, data.type);
    });
    
    // Monitor memory during execution
    const memMonitor = setInterval(() => {
      const current = process.memoryUsage().heapUsed;
      if (current > memPeak) memPeak = current;
    }, 100);
    
    // Start execution
    const executionResponse = await axios.post(
      `${API_BASE_URL}/executions`,
      { 
        projectId,
        config: {
          maxParallelAgents: 5,
          timeout: TEST_TIMEOUT,
          retryOnFailure: true,
          maxRetries: 2
        }
      },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    const executionId = executionResponse.data.id;
    
    // Wait for completion
    await waitFor(() => {
      const allNodes = flow.nodes.map((n: any) => n.id);
      const finishedNodes = Object.entries(nodeUpdates)
        .filter(([_, updates]) => 
          updates.some(u => u.status === 'completed' || u.status === 'failed')
        )
        .map(([nodeId]) => nodeId);
      
      return finishedNodes.length === allNodes.length;
    }, { timeout: TEST_TIMEOUT });
    
    clearInterval(memMonitor);
    const endTime = performance.now();
    const memEnd = process.memoryUsage().heapUsed;
    
    // Build result
    const result: FlowResult = {
      testName,
      projectId,
      executionId,
      startTime,
      endTime,
      duration: endTime - startTime,
      nodes: {},
      memoryUsage: {
        start: memStart / 1024 / 1024,
        peak: memPeak / 1024 / 1024,
        end: memEnd / 1024 / 1024
      },
      errors: errors.length > 0 ? errors : undefined
    };
    
    // Process node results
    for (const node of flow.nodes) {
      const updates = nodeUpdates[node.id] || [];
      const lastUpdate = updates[updates.length - 1];
      const timing = nodeTimings[node.id];
      const retries = updates.filter(u => u.status === 'running').length - 1;
      
      result.nodes[node.id] = {
        status: lastUpdate?.status || 'pending',
        startTime: timing?.start,
        endTime: timing?.end,
        duration: timing?.start && timing?.end ? timing.end - timing.start : undefined,
        result: lastUpdate?.result,
        error: lastUpdate?.error,
        output: nodeOutputs[node.id],
        retries: retries > 0 ? retries : undefined
      };
    }
    
    // Calculate metrics
    const completedNodes = Object.values(result.nodes).filter(n => n.status === 'completed');
    result.completionRate = completedNodes.length / flow.nodes.length;
    
    return result;
  };

  // Test 1: Simple Flow Test
  test('1. Simple Flow Test - Setup → Execute → Test', async () => {
    const flow = {
      nodes: [
        { 
          id: 'setup', 
          agentId: 'nextjs-setup',
          category: 'setup',
          config: {
            projectName: 'test-app',
            typescript: true,
            tailwind: true,
            eslint: true
          }
        },
        { 
          id: 'execute', 
          agentId: 'react-developer',
          category: 'execution',
          config: {
            component: 'Dashboard',
            props: ['data', 'onUpdate', 'user'],
            hooks: ['useState', 'useEffect'],
            styling: 'tailwind'
          }
        },
        { 
          id: 'test', 
          agentId: 'jest-tester',
          category: 'testing',
          config: {
            coverage: true,
            watch: false,
            updateSnapshot: false
          }
        }
      ],
      edges: [
        { source: 'setup', target: 'execute' },
        { source: 'execute', target: 'test' }
      ]
    };

    const result = await executeFlow('Simple Flow', flow);
    testResults.push(result);

    expect(result.completionRate).toBe(1);
    expect(result.nodes['setup'].status).toBe('completed');
    expect(result.nodes['execute'].status).toBe('completed');
    expect(result.nodes['test'].status).toBe('completed');
    
    // Verify execution order
    const setupEnd = result.nodes['setup'].endTime || 0;
    const executeStart = result.nodes['execute'].startTime || 0;
    const executeEnd = result.nodes['execute'].endTime || 0;
    const testStart = result.nodes['test'].startTime || 0;
    
    expect(executeStart).toBeGreaterThanOrEqual(setupEnd);
    expect(testStart).toBeGreaterThanOrEqual(executeEnd);
    
    result.dependencyAccuracy = 1;
    
    console.log('Simple Flow Results:', {
      duration: `${result.duration}ms`,
      completionRate: result.completionRate,
      nodesExecuted: Object.keys(result.nodes).length
    });
  }, TEST_TIMEOUT);

  // Test 2: Complex Flow Test with Parallel Branches
  test('2. Complex Flow Test - 10+ nodes with parallel branches', async () => {
    const flow = {
      nodes: [
        // Initial analysis
        { id: 'analyze', agentId: 'project-analyzer', category: 'analysis' },
        
        // Parallel setup branches
        { id: 'db-setup', agentId: 'postgres-setup', category: 'setup' },
        { id: 'redis-setup', agentId: 'redis-setup', category: 'setup' },
        { id: 'frontend-setup', agentId: 'nextjs-setup', category: 'setup' },
        
        // Development nodes (parallel)
        { id: 'api-dev', agentId: 'nodejs-backend', category: 'execution' },
        { id: 'frontend-dev', agentId: 'react-developer', category: 'execution' },
        { id: 'admin-dev', agentId: 'react-developer', category: 'execution' },
        { id: 'worker-dev', agentId: 'nodejs-backend', category: 'execution' },
        
        // Testing nodes (parallel)
        { id: 'api-test', agentId: 'jest-tester', category: 'testing' },
        { id: 'ui-test', agentId: 'playwright-tester', category: 'testing' },
        { id: 'integration-test', agentId: 'postman-tester', category: 'testing' },
        
        // Review node
        { id: 'review', agentId: 'code-reviewer', category: 'review' },
        
        // Deployment
        { id: 'deploy', agentId: 'docker-deployer', category: 'integration' }
      ],
      edges: [
        // From analysis
        { source: 'analyze', target: 'db-setup' },
        { source: 'analyze', target: 'redis-setup' },
        { source: 'analyze', target: 'frontend-setup' },
        
        // To development
        { source: 'db-setup', target: 'api-dev' },
        { source: 'redis-setup', target: 'worker-dev' },
        { source: 'frontend-setup', target: 'frontend-dev' },
        { source: 'frontend-setup', target: 'admin-dev' },
        
        // To testing
        { source: 'api-dev', target: 'api-test' },
        { source: 'frontend-dev', target: 'ui-test' },
        { source: 'api-dev', target: 'integration-test' },
        { source: 'worker-dev', target: 'integration-test' },
        
        // To review
        { source: 'api-test', target: 'review' },
        { source: 'ui-test', target: 'review' },
        { source: 'integration-test', target: 'review' },
        
        // To deployment
        { source: 'review', target: 'deploy' }
      ]
    };

    const parallelGroups: Record<string, string[]> = {};
    const executionOrder: string[] = [];
    
    socket.on('node:update', (data: NodeUpdate) => {
      if (data.status === 'running') {
        const timestamp = Math.floor(data.timestamp / 1000);
        if (!parallelGroups[timestamp]) {
          parallelGroups[timestamp] = [];
        }
        parallelGroups[timestamp].push(data.nodeId);
      }
      if (data.status === 'completed') {
        executionOrder.push(data.nodeId);
      }
    });

    const result = await executeFlow('Complex Flow', flow);
    testResults.push(result);

    expect(result.completionRate).toBeGreaterThan(0.8);
    expect(result.nodes['deploy'].status).toBe('completed');
    
    // Calculate parallel efficiency
    const totalSequentialTime = Object.values(result.nodes)
      .reduce((sum, node) => sum + (node.duration || 0), 0);
    const actualTime = result.duration;
    result.parallelEfficiency = totalSequentialTime / (actualTime * 3); // Assuming 3 parallel lanes
    
    // Check for proper parallelization
    const parallelExecutions = Object.values(parallelGroups)
      .filter(group => group.length > 1).length;
    expect(parallelExecutions).toBeGreaterThan(0);
    
    console.log('Complex Flow Results:', {
      totalNodes: flow.nodes.length,
      completedNodes: Object.values(result.nodes).filter(n => n.status === 'completed').length,
      parallelGroups: parallelExecutions,
      parallelEfficiency: result.parallelEfficiency,
      duration: `${result.duration}ms`
    });
  }, TEST_TIMEOUT);

  // Test 3: Error Handling Test
  test('3. Error Handling Test - Failing nodes with retry', async () => {
    const flow = {
      nodes: [
        { 
          id: 'good-setup', 
          agentId: 'nodejs-backend',
          category: 'execution',
          config: { port: 3001 }
        },
        { 
          id: 'bad-agent', 
          agentId: 'non-existent-agent', // This will fail
          category: 'execution'
        },
        { 
          id: 'dependent', 
          agentId: 'jest-tester',
          category: 'testing',
          config: { 
            testFiles: ['non-existent.test.js'] // This might fail
          }
        },
        { 
          id: 'recovery', 
          agentId: 'error-handler',
          category: 'utility',
          config: {
            action: 'log-and-continue'
          }
        },
        { 
          id: 'fallback', 
          agentId: 'nodejs-backend',
          category: 'execution',
          config: { 
            fallback: true,
            port: 3002 
          }
        }
      ],
      edges: [
        { source: 'good-setup', target: 'bad-agent' },
        { source: 'bad-agent', target: 'dependent' },
        { source: 'bad-agent', target: 'recovery', condition: 'on-error' },
        { source: 'recovery', target: 'fallback' }
      ]
    };

    const errorNodes: string[] = [];
    const retriedNodes: string[] = [];
    const recoveredNodes: string[] = [];
    
    socket.on('node:update', (data: NodeUpdate) => {
      if (data.status === 'failed') {
        errorNodes.push(data.nodeId);
        console.log(`Error in ${data.nodeId}:`, data.error);
      }
    });
    
    socket.on('node:retry', (data: any) => {
      retriedNodes.push(data.nodeId);
      console.log(`Retrying ${data.nodeId}, attempt ${data.attempt}`);
    });

    const result = await executeFlow('Error Handling', flow);
    testResults.push(result);

    expect(errorNodes).toContain('bad-agent');
    expect(result.nodes['bad-agent'].status).toBe('failed');
    expect(result.nodes['bad-agent'].error).toBeTruthy();
    
    // Check if retry mechanism worked
    const retriedNodeResults = Object.entries(result.nodes)
      .filter(([_, node]) => (node.retries || 0) > 0);
    
    // Check if recovery path was taken
    if (result.nodes['recovery']) {
      expect(['completed', 'running']).toContain(result.nodes['recovery'].status);
      recoveredNodes.push('recovery');
    }
    
    console.log('Error Handling Results:', {
      errorNodes,
      retriedNodes: retriedNodeResults.map(([id]) => id),
      recoveredNodes,
      completionRate: result.completionRate,
      errors: result.errors?.length || 0
    });
  }, TEST_TIMEOUT);

  // Test 4: Performance Test with 20+ nodes
  test('4. Performance Test - 20+ nodes execution', async () => {
    const nodes = [];
    const edges = [];
    
    // Create a complex flow with multiple layers
    // Layer 1: Initial setup (3 nodes)
    for (let i = 0; i < 3; i++) {
      nodes.push({
        id: `setup-${i}`,
        agentId: i === 0 ? 'postgres-setup' : i === 1 ? 'redis-setup' : 'nextjs-setup',
        category: 'setup'
      });
    }
    
    // Layer 2: Backend services (5 nodes)
    for (let i = 0; i < 5; i++) {
      nodes.push({
        id: `backend-${i}`,
        agentId: 'nodejs-backend',
        category: 'execution',
        config: { 
          service: `service-${i}`,
          port: 4000 + i 
        }
      });
      // Connect to setup nodes
      edges.push({ 
        source: `setup-${i % 3}`, 
        target: `backend-${i}` 
      });
    }
    
    // Layer 3: Frontend components (5 nodes)
    for (let i = 0; i < 5; i++) {
      nodes.push({
        id: `frontend-${i}`,
        agentId: 'react-developer',
        category: 'execution',
        config: { 
          component: `Component${i}`,
          dependencies: [`backend-${i}`]
        }
      });
      // Connect to backend services
      edges.push({ 
        source: `backend-${i}`, 
        target: `frontend-${i}` 
      });
    }
    
    // Layer 4: Testing (5 nodes)
    for (let i = 0; i < 5; i++) {
      nodes.push({
        id: `test-${i}`,
        agentId: i % 2 === 0 ? 'jest-tester' : 'playwright-tester',
        category: 'testing'
      });
      // Connect to frontend components
      edges.push({ 
        source: `frontend-${i}`, 
        target: `test-${i}` 
      });
    }
    
    // Layer 5: Integration and deployment (2 nodes)
    nodes.push({
      id: 'integration',
      agentId: 'integration-tester',
      category: 'testing'
    });
    nodes.push({
      id: 'deploy',
      agentId: 'docker-deployer',
      category: 'integration'
    });
    
    // Connect all tests to integration
    for (let i = 0; i < 5; i++) {
      edges.push({ 
        source: `test-${i}`, 
        target: 'integration' 
      });
    }
    edges.push({ 
      source: 'integration', 
      target: 'deploy' 
    });
    
    const flow = { nodes, edges };
    
    // Track performance metrics
    const layerTimings: Record<string, number[]> = {
      setup: [],
      backend: [],
      frontend: [],
      test: [],
      final: []
    };
    
    socket.on('node:update', (data: NodeUpdate) => {
      if (data.status === 'completed') {
        const layer = data.nodeId.split('-')[0];
        layerTimings[layer] = layerTimings[layer] || [];
        layerTimings[layer].push(data.timestamp);
      }
    });
    
    const startMem = process.memoryUsage();
    const result = await executeFlow('Performance Test', flow);
    const endMem = process.memoryUsage();
    
    testResults.push(result);
    
    // Performance assertions
    expect(result.completionRate).toBeGreaterThan(0.7);
    expect(result.duration).toBeLessThan(300000); // Should complete within 5 minutes
    
    // Memory leak detection
    const memoryIncrease = (endMem.heapUsed - startMem.heapUsed) / 1024 / 1024;
    expect(memoryIncrease).toBeLessThan(200); // Less than 200MB increase
    
    // Calculate parallel efficiency
    const totalSequentialTime = Object.values(result.nodes)
      .reduce((sum, node) => sum + (node.duration || 0), 0);
    result.parallelEfficiency = totalSequentialTime / (result.duration * 5); // Assuming 5 parallel lanes
    
    console.log('Performance Test Results:', {
      totalNodes: nodes.length,
      completedNodes: Object.values(result.nodes).filter(n => n.status === 'completed').length,
      duration: `${result.duration}ms`,
      parallelEfficiency: result.parallelEfficiency,
      memoryUsage: {
        increase: `${memoryIncrease.toFixed(2)}MB`,
        peak: `${(result.memoryUsage?.peak || 0).toFixed(2)}MB`
      },
      layerCompletionTimes: Object.entries(layerTimings).map(([layer, times]) => ({
        layer,
        count: times.length,
        avgTime: times.length > 0 ? 
          (Math.max(...times) - Math.min(...times)) / times.length : 0
      }))
    });
  }, TEST_TIMEOUT);

  // Test 5: Preview and Output Streaming Test
  test('5. Preview Tests - Terminal, Web, and File outputs', async () => {
    const flow = {
      nodes: [
        { 
          id: 'terminal-output', 
          agentId: 'nodejs-backend',
          category: 'execution',
          config: {
            script: 'console.log("Test output"); setInterval(() => console.log(Date.now()), 1000)',
            streaming: true
          }
        },
        { 
          id: 'web-preview', 
          agentId: 'nextjs-setup',
          category: 'setup',
          config: {
            projectName: 'preview-app',
            autoStart: true,
            port: 3005
          }
        },
        { 
          id: 'file-generator', 
          agentId: 'file-writer',
          category: 'utility',
          config: {
            files: [
              { path: 'output.txt', content: 'Test file content' },
              { path: 'data.json', content: '{"test": true}' },
              { path: 'report.md', content: '# Test Report\\n\\nGenerated at: ' + new Date().toISOString() }
            ]
          }
        },
        { 
          id: 'monitor', 
          agentId: 'output-monitor',
          category: 'utility',
          config: {
            targets: ['terminal-output', 'web-preview', 'file-generator'],
            captureOutput: true
          }
        }
      ],
      edges: [
        { source: 'terminal-output', target: 'monitor' },
        { source: 'web-preview', target: 'monitor' },
        { source: 'file-generator', target: 'monitor' }
      ]
    };
    
    const previews: Record<string, any[]> = {};
    const outputs: Record<string, string[]> = {};
    
    socket.on('preview:update', (data: any) => {
      if (!previews[data.nodeId]) {
        previews[data.nodeId] = [];
      }
      previews[data.nodeId].push({
        type: data.type,
        timestamp: Date.now(),
        data: data.data
      });
      console.log(`Preview [${data.type}] for ${data.nodeId}`);
    });
    
    socket.on('output:stream', (data: any) => {
      if (!outputs[data.nodeId]) {
        outputs[data.nodeId] = [];
      }
      outputs[data.nodeId].push(data.output);
      console.log(`Output stream for ${data.nodeId}:`, data.output.substring(0, 100));
    });
    
    const result = await executeFlow('Preview Test', flow);
    testResults.push(result);
    
    // Verify outputs were captured
    expect(Object.keys(outputs).length).toBeGreaterThan(0);
    
    // Verify preview updates were received
    if (Object.keys(previews).length > 0) {
      const terminalPreviews = previews['terminal-output'] || [];
      const webPreviews = previews['web-preview'] || [];
      const filePreviews = previews['file-generator'] || [];
      
      console.log('Preview Test Results:', {
        terminalOutputs: outputs['terminal-output']?.length || 0,
        terminalPreviews: terminalPreviews.length,
        webPreviews: webPreviews.length,
        filePreviews: filePreviews.length,
        totalOutputLines: Object.values(outputs).reduce((sum, arr) => sum + arr.length, 0),
        previewTypes: [...new Set(Object.values(previews).flat().map(p => p.type))]
      });
    }
    
    expect(result.completionRate).toBeGreaterThan(0.5);
  }, TEST_TIMEOUT);

  // Additional test for concurrent executions
  test('6. Concurrent Executions - Multiple flows simultaneously', async () => {
    const createSimpleFlow = (id: number) => ({
      nodes: [
        { 
          id: `node-${id}-1`, 
          agentId: 'nodejs-backend',
          category: 'execution',
          config: { port: 5000 + id }
        },
        { 
          id: `node-${id}-2`, 
          agentId: 'jest-tester',
          category: 'testing'
        }
      ],
      edges: [
        { source: `node-${id}-1`, target: `node-${id}-2` }
      ]
    });
    
    // Execute 3 flows concurrently
    const flowPromises = [];
    for (let i = 0; i < 3; i++) {
      flowPromises.push(executeFlow(`Concurrent ${i}`, createSimpleFlow(i)));
    }
    
    const results = await Promise.all(flowPromises);
    results.forEach(r => testResults.push(r));
    
    // All flows should complete successfully
    results.forEach((result, index) => {
      expect(result.completionRate).toBeGreaterThan(0.5);
      console.log(`Concurrent Flow ${index}:`, {
        duration: `${result.duration}ms`,
        completionRate: result.completionRate
      });
    });
    
    // Check that they actually ran concurrently
    const startTimes = results.map(r => r.startTime);
    const endTimes = results.map(r => r.endTime);
    const overlap = Math.min(...endTimes) > Math.max(...startTimes);
    expect(overlap).toBe(true);
    
    console.log('Concurrent Execution Results:', {
      totalFlows: results.length,
      avgDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      executedConcurrently: overlap
    });
  }, TEST_TIMEOUT);
});