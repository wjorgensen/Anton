import { test, expect } from '@playwright/test';
import { WebSocket } from 'ws';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3002';
const WS_URL = 'ws://localhost:3002';

test.describe('Multi-Agent Test', () => {
  test('should coordinate multiple parallel agents with dependencies', async ({ page }) => {
    const testId = uuidv4();
    const projectName = `multi-agent-test-${testId}`;
    const testResults = {
      testId,
      testName: 'Multi-Agent Test',
      startTime: new Date().toISOString(),
      steps: [] as any[],
      metrics: {} as any
    };

    try {
      // Step 1: Create complex multi-agent flow
      const step1Start = Date.now();
      
      // Create project via API for speed
      const projectResponse = await axios.post(`${API_URL}/api/projects`, {
        name: projectName,
        description: 'Multi-agent coordination test',
        type: 'fullstack',
        config: {
          enableParallelExecution: true,
          maxConcurrentAgents: 10
        }
      });
      
      const projectId = projectResponse.data.project.id;
      
      // Create complex flow with parallel branches
      const flowResponse = await axios.post(`${API_URL}/api/flows`, {
        projectId,
        nodes: [
          // Initial setup
          {
            id: 'setup-main',
            type: 'setup',
            data: {
              agent: 'monorepo-setup',
              label: 'Setup Monorepo',
              config: { packages: ['frontend', 'backend', 'shared', 'docs', 'testing'] }
            },
            position: { x: 100, y: 300 }
          },
          
          // Parallel frontend branch
          {
            id: 'frontend-setup',
            type: 'setup',
            data: {
              agent: 'nextjs-setup',
              label: 'Setup Next.js Frontend',
              config: { directory: 'packages/frontend' }
            },
            position: { x: 300, y: 100 }
          },
          {
            id: 'frontend-dev',
            type: 'execution',
            data: {
              agent: 'react-developer',
              label: 'Develop Frontend Components',
              config: { components: ['Layout', 'Dashboard', 'UserProfile'] }
            },
            position: { x: 500, y: 100 }
          },
          {
            id: 'frontend-test',
            type: 'testing',
            data: {
              agent: 'jest-runner',
              label: 'Test Frontend',
              config: { directory: 'packages/frontend' }
            },
            position: { x: 700, y: 100 }
          },
          
          // Parallel backend branch
          {
            id: 'backend-setup',
            type: 'setup',
            data: {
              agent: 'express-setup',
              label: 'Setup Express Backend',
              config: { directory: 'packages/backend' }
            },
            position: { x: 300, y: 250 }
          },
          {
            id: 'backend-dev',
            type: 'execution',
            data: {
              agent: 'nodejs-developer',
              label: 'Develop API Endpoints',
              config: { endpoints: ['/users', '/projects', '/analytics'] }
            },
            position: { x: 500, y: 250 }
          },
          {
            id: 'backend-test',
            type: 'testing',
            data: {
              agent: 'jest-runner',
              label: 'Test Backend',
              config: { directory: 'packages/backend' }
            },
            position: { x: 700, y: 250 }
          },
          
          // Parallel shared library branch
          {
            id: 'shared-dev',
            type: 'execution',
            data: {
              agent: 'typescript-developer',
              label: 'Develop Shared Types',
              config: { directory: 'packages/shared' }
            },
            position: { x: 300, y: 400 }
          },
          
          // Parallel documentation branch
          {
            id: 'docs-gen',
            type: 'utility',
            data: {
              agent: 'documentation-writer',
              label: 'Generate Documentation',
              config: { format: 'markdown' }
            },
            position: { x: 300, y: 500 }
          },
          
          // Integration point - depends on all branches
          {
            id: 'integration',
            type: 'integration',
            data: {
              agent: 'integration-tester',
              label: 'Integration Tests',
              config: { testType: 'api-ui-integration' }
            },
            position: { x: 900, y: 300 }
          },
          
          // E2E testing - depends on integration
          {
            id: 'e2e-test',
            type: 'testing',
            data: {
              agent: 'playwright-runner',
              label: 'E2E Tests',
              config: { browsers: ['chromium', 'firefox'] }
            },
            position: { x: 1100, y: 300 }
          },
          
          // Final deployment
          {
            id: 'deploy',
            type: 'utility',
            data: {
              agent: 'deployment-manager',
              label: 'Deploy to Staging',
              config: { environment: 'staging' }
            },
            position: { x: 1300, y: 300 }
          }
        ],
        edges: [
          // From setup to parallel branches
          { id: 'e1', source: 'setup-main', target: 'frontend-setup' },
          { id: 'e2', source: 'setup-main', target: 'backend-setup' },
          { id: 'e3', source: 'setup-main', target: 'shared-dev' },
          { id: 'e4', source: 'setup-main', target: 'docs-gen' },
          
          // Frontend branch
          { id: 'e5', source: 'frontend-setup', target: 'frontend-dev' },
          { id: 'e6', source: 'frontend-dev', target: 'frontend-test' },
          
          // Backend branch
          { id: 'e7', source: 'backend-setup', target: 'backend-dev' },
          { id: 'e8', source: 'backend-dev', target: 'backend-test' },
          
          // Convergence to integration
          { id: 'e9', source: 'frontend-test', target: 'integration' },
          { id: 'e10', source: 'backend-test', target: 'integration' },
          { id: 'e11', source: 'shared-dev', target: 'integration' },
          { id: 'e12', source: 'docs-gen', target: 'integration' },
          
          // Final steps
          { id: 'e13', source: 'integration', target: 'e2e-test' },
          { id: 'e14', source: 'e2e-test', target: 'deploy' }
        ]
      });
      
      const flowId = flowResponse.data.flow.id;
      
      testResults.steps.push({
        name: 'Multi-Agent Flow Setup',
        duration: Date.now() - step1Start,
        success: true,
        projectId,
        flowId,
        nodeCount: 12,
        parallelBranches: 4
      });

      // Step 2: Execute flow and monitor parallel execution
      const step2Start = Date.now();
      
      // Navigate to flow
      await page.goto(`${BASE_URL}/projects/${projectId}/flow/${flowId}`);
      await page.waitForSelector('[data-testid="flow-canvas"]', { timeout: 10000 });
      
      // Connect WebSocket
      const ws = new WebSocket(`${WS_URL}/execution`);
      const wsEvents: any[] = [];
      const nodeExecutions = new Map<string, any>();
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({ 
            type: 'subscribe', 
            projectId,
            flowId,
            clientId: testId 
          }));
          resolve(undefined);
        });
      });

      ws.on('message', (data) => {
        const event = JSON.parse(data.toString());
        wsEvents.push({
          ...event,
          timestamp: Date.now()
        });
        
        // Track node execution times
        if (event.type === 'node:started') {
          nodeExecutions.set(event.nodeId, {
            startTime: Date.now(),
            status: 'running'
          });
        } else if (event.type === 'node:completed' || event.type === 'node:failed') {
          const exec = nodeExecutions.get(event.nodeId);
          if (exec) {
            exec.endTime = Date.now();
            exec.duration = exec.endTime - exec.startTime;
            exec.status = event.type === 'node:completed' ? 'completed' : 'failed';
          }
        }
      });

      // Start execution
      const executionResponse = await axios.post(`${API_URL}/api/executions/start`, {
        projectId,
        flowId,
        config: {
          parallel: true,
          maxConcurrency: 10
        }
      });
      
      const executionId = executionResponse.data.execution.id;
      
      testResults.steps.push({
        name: 'Execution Started',
        duration: Date.now() - step2Start,
        success: true,
        executionId
      });

      // Step 3: Verify parallel execution
      const step3Start = Date.now();
      
      // Monitor for parallel execution
      let maxConcurrent = 0;
      let parallelVerified = false;
      
      for (let i = 0; i < 180; i++) { // 3 minute timeout
        await page.waitForTimeout(1000);
        
        // Count currently running nodes
        const runningNodes = Array.from(nodeExecutions.values())
          .filter(n => n.status === 'running').length;
        
        maxConcurrent = Math.max(maxConcurrent, runningNodes);
        
        // Check if we've seen parallel execution (at least 3 concurrent)
        if (runningNodes >= 3 && !parallelVerified) {
          parallelVerified = true;
          console.log(`Parallel execution verified: ${runningNodes} agents running concurrently`);
        }
        
        // Check completion
        const completedNodes = Array.from(nodeExecutions.values())
          .filter(n => n.status === 'completed').length;
        
        if (completedNodes === 12) {
          console.log('All nodes completed');
          break;
        }
        
        // Log progress every 10 seconds
        if (i % 10 === 0) {
          console.log(`Progress: ${completedNodes}/12 nodes completed, ${runningNodes} running`);
        }
      }
      
      expect(parallelVerified).toBe(true);
      expect(maxConcurrent).toBeGreaterThanOrEqual(3);
      
      testResults.steps.push({
        name: 'Parallel Execution Verified',
        duration: Date.now() - step3Start,
        success: true,
        maxConcurrentAgents: maxConcurrent,
        parallelVerified
      });

      // Step 4: Test dependency resolution
      const step4Start = Date.now();
      
      // Analyze execution order from events
      const executionOrder: string[] = [];
      const startEvents = wsEvents
        .filter(e => e.type === 'node:started')
        .sort((a, b) => a.timestamp - b.timestamp);
      
      for (const event of startEvents) {
        executionOrder.push(event.nodeId);
      }
      
      // Verify dependencies were respected
      // setup-main should start first
      expect(executionOrder[0]).toBe('setup-main');
      
      // Parallel branches should start after setup
      const setupIndex = executionOrder.indexOf('setup-main');
      const frontendSetupIndex = executionOrder.indexOf('frontend-setup');
      const backendSetupIndex = executionOrder.indexOf('backend-setup');
      const sharedIndex = executionOrder.indexOf('shared-dev');
      
      expect(frontendSetupIndex).toBeGreaterThan(setupIndex);
      expect(backendSetupIndex).toBeGreaterThan(setupIndex);
      expect(sharedIndex).toBeGreaterThan(setupIndex);
      
      // Integration should start after all dependencies
      const integrationIndex = executionOrder.indexOf('integration');
      const frontendTestIndex = executionOrder.indexOf('frontend-test');
      const backendTestIndex = executionOrder.indexOf('backend-test');
      
      expect(integrationIndex).toBeGreaterThan(frontendTestIndex);
      expect(integrationIndex).toBeGreaterThan(backendTestIndex);
      expect(integrationIndex).toBeGreaterThan(sharedIndex);
      
      // E2E should be after integration
      const e2eIndex = executionOrder.indexOf('e2e-test');
      expect(e2eIndex).toBeGreaterThan(integrationIndex);
      
      // Deploy should be last
      const deployIndex = executionOrder.indexOf('deploy');
      expect(deployIndex).toBe(executionOrder.length - 1);
      
      testResults.steps.push({
        name: 'Dependency Resolution',
        duration: Date.now() - step4Start,
        success: true,
        executionOrder: executionOrder.join(' -> ')
      });

      // Step 5: Check output passing between agents
      const step5Start = Date.now();
      
      // Get execution details
      const execDetailsResponse = await axios.get(
        `${API_URL}/api/executions/${executionId}/details`
      );
      
      const nodeOutputs = execDetailsResponse.data.nodeOutputs;
      
      // Verify outputs were passed correctly
      // Frontend should have received shared types
      const frontendNode = nodeOutputs.find((n: any) => n.nodeId === 'frontend-dev');
      expect(frontendNode).toBeDefined();
      expect(frontendNode.inputs).toBeDefined();
      
      // Integration should have received outputs from all branches
      const integrationNode = nodeOutputs.find((n: any) => n.nodeId === 'integration');
      expect(integrationNode).toBeDefined();
      expect(integrationNode.inputs).toBeDefined();
      expect(Object.keys(integrationNode.inputs).length).toBeGreaterThanOrEqual(4);
      
      // E2E should have integration results
      const e2eNode = nodeOutputs.find((n: any) => n.nodeId === 'e2e-test');
      expect(e2eNode).toBeDefined();
      expect(e2eNode.inputs?.integration).toBeDefined();
      
      testResults.steps.push({
        name: 'Output Passing Verification',
        duration: Date.now() - step5Start,
        success: true,
        outputsPassed: true,
        nodeWithInputs: Object.keys(integrationNode.inputs).length
      });

      // Step 6: Verify coordination metrics
      const step6Start = Date.now();
      
      // Calculate coordination metrics
      const completedExecutions = Array.from(nodeExecutions.values())
        .filter(n => n.status === 'completed');
      
      const totalExecutionTime = Math.max(...completedExecutions.map(n => n.endTime || 0)) -
                                Math.min(...completedExecutions.map(n => n.startTime || 0));
      
      const sequentialTime = completedExecutions.reduce((sum, n) => sum + (n.duration || 0), 0);
      const parallelizationEfficiency = sequentialTime / totalExecutionTime;
      
      // Check resource utilization
      const resourceEvents = wsEvents.filter(e => e.type === 'resource:usage');
      const avgCpu = resourceEvents.reduce((sum, e) => sum + (e.data?.cpu || 0), 0) / 
                     Math.max(resourceEvents.length, 1);
      const avgMemory = resourceEvents.reduce((sum, e) => sum + (e.data?.memory || 0), 0) / 
                        Math.max(resourceEvents.length, 1);
      
      testResults.steps.push({
        name: 'Coordination Metrics',
        duration: Date.now() - step6Start,
        success: true,
        totalExecutionTime,
        sequentialTime,
        parallelizationEfficiency,
        avgCpu,
        avgMemory
      });

      // Calculate final metrics
      testResults.metrics = {
        totalDuration: testResults.steps.reduce((sum, step) => sum + step.duration, 0),
        nodeCount: 12,
        maxConcurrentAgents: maxConcurrent,
        parallelizationEfficiency: parallelizationEfficiency.toFixed(2),
        wsEvents: wsEvents.length,
        successRate: '100%',
        executionOrder: executionOrder.length,
        dependenciesRespected: true
      };

      testResults.success = true;
      testResults.endTime = new Date().toISOString();
      
      // Cleanup
      ws.close();
      
    } catch (error) {
      testResults.success = false;
      testResults.error = error instanceof Error ? error.message : String(error);
      testResults.endTime = new Date().toISOString();
      throw error;
    } finally {
      // Save results
      await saveTestResults('multi-agent', testResults);
    }
  });
});

async function saveTestResults(testName: string, results: any) {
  const fs = require('fs').promises;
  const path = require('path');
  const reportPath = path.join(process.cwd(), 'test-reports', 'integration-v3.json');
  
  let report: any = { tests: {}, summary: {} };
  
  try {
    const existing = await fs.readFile(reportPath, 'utf-8');
    report = JSON.parse(existing);
  } catch (e) {
    // File doesn't exist yet
  }
  
  report.tests[testName] = results;
  
  // Update summary
  const allTests = Object.values(report.tests) as any[];
  report.summary = {
    totalTests: allTests.length,
    passed: allTests.filter(t => t.success).length,
    failed: allTests.filter(t => !t.success).length,
    totalDuration: allTests.reduce((sum, t) => sum + (t.metrics?.totalDuration || 0), 0),
    timestamp: new Date().toISOString()
  };
  
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
}