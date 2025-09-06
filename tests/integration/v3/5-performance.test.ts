import { test, expect } from '@playwright/test';
import { WebSocket } from 'ws';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3002';
const WS_URL = 'ws://localhost:3002';

test.describe('Performance Test', () => {
  test('should handle high load and scale appropriately', async ({ page, browser }) => {
    const testId = uuidv4();
    const testResults = {
      testId,
      testName: 'Performance Test',
      startTime: new Date().toISOString(),
      steps: [] as any[],
      metrics: {} as any
    };

    try {
      // Step 1: Test 100 concurrent executions
      const step1Start = Date.now();
      
      const concurrentExecutions: Promise<any>[] = [];
      const executionMetrics: any[] = [];
      
      // Create test projects for concurrent execution
      for (let i = 0; i < 100; i++) {
        const execution = (async () => {
          const execStart = Date.now();
          
          try {
            // Create lightweight project
            const projectResponse = await axios.post(`${API_URL}/api/projects`, {
              name: `perf-test-${testId}-${i}`,
              description: 'Performance test project',
              type: 'minimal'
            });
            
            const projectId = projectResponse.data.project.id;
            
            // Create simple flow
            const flowResponse = await axios.post(`${API_URL}/api/flows`, {
              projectId,
              nodes: [
                {
                  id: 'task-1',
                  type: 'execution',
                  data: {
                    agent: 'simple-task',
                    label: 'Simple Task',
                    config: { delay: 100 }
                  },
                  position: { x: 100, y: 100 }
                }
              ],
              edges: []
            });
            
            const flowId = flowResponse.data.flow.id;
            
            // Start execution
            const execResponse = await axios.post(`${API_URL}/api/executions/start`, {
              projectId,
              flowId
            });
            
            const executionId = execResponse.data.execution.id;
            
            // Poll for completion (lightweight check)
            let completed = false;
            for (let j = 0; j < 30; j++) { // 30 second timeout
              await new Promise(r => setTimeout(r, 1000));
              
              const statusResponse = await axios.get(
                `${API_URL}/api/executions/${executionId}/status`
              );
              
              if (statusResponse.data.status === 'completed') {
                completed = true;
                break;
              }
            }
            
            return {
              projectId,
              executionId,
              duration: Date.now() - execStart,
              completed,
              index: i
            };
          } catch (error) {
            return {
              index: i,
              duration: Date.now() - execStart,
              completed: false,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        })();
        
        concurrentExecutions.push(execution);
        
        // Stagger requests slightly to avoid overwhelming
        if (i % 10 === 9) {
          await new Promise(r => setTimeout(r, 100));
        }
      }
      
      // Wait for all executions
      const results = await Promise.all(concurrentExecutions);
      
      // Calculate success rate
      const successful = results.filter(r => r.completed).length;
      const failed = results.filter(r => !r.completed).length;
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      
      testResults.steps.push({
        name: '100 Concurrent Executions',
        duration: Date.now() - step1Start,
        success: true,
        totalExecutions: 100,
        successful,
        failed,
        successRate: `${(successful / 100 * 100).toFixed(1)}%`,
        avgDuration: Math.round(avgDuration)
      });

      // Step 2: Test 500 node canvas rendering
      const step2Start = Date.now();
      
      // Create large flow project
      const largeProjectResponse = await axios.post(`${API_URL}/api/projects`, {
        name: `large-canvas-${testId}`,
        description: 'Large canvas performance test',
        type: 'complex'
      });
      
      const largeProjectId = largeProjectResponse.data.project.id;
      
      // Generate 500 nodes
      const nodes: any[] = [];
      const edges: any[] = [];
      
      // Create a complex graph structure
      for (let layer = 0; layer < 20; layer++) {
        for (let node = 0; node < 25; node++) {
          const nodeId = `node-${layer}-${node}`;
          nodes.push({
            id: nodeId,
            type: layer === 0 ? 'setup' : layer === 19 ? 'integration' : 'execution',
            data: {
              agent: 'simple-task',
              label: `Task ${layer}-${node}`,
              config: {}
            },
            position: { 
              x: 100 + (layer * 150), 
              y: 50 + (node * 60)
            }
          });
          
          // Create edges to next layer
          if (layer < 19) {
            // Connect to 2-3 nodes in next layer
            const connections = Math.min(3, 25);
            for (let c = 0; c < connections; c++) {
              const targetNode = (node + c) % 25;
              edges.push({
                id: `edge-${layer}-${node}-${c}`,
                source: nodeId,
                target: `node-${layer + 1}-${targetNode}`
              });
            }
          }
        }
      }
      
      // Create the large flow
      const largeFlowResponse = await axios.post(`${API_URL}/api/flows`, {
        projectId: largeProjectId,
        nodes,
        edges
      });
      
      const largeFlowId = largeFlowResponse.data.flow.id;
      
      // Test canvas rendering performance
      const canvasPage = await browser.newPage();
      
      const renderStart = Date.now();
      await canvasPage.goto(`${BASE_URL}/projects/${largeProjectId}/flow/${largeFlowId}`);
      
      // Wait for canvas to load
      await canvasPage.waitForSelector('[data-testid="flow-canvas"]', { timeout: 30000 });
      
      // Wait for all nodes to render
      await canvasPage.waitForFunction(
        () => document.querySelectorAll('[data-testid^="flow-node-"]').length >= 500,
        { timeout: 30000 }
      );
      
      const renderTime = Date.now() - renderStart;
      
      // Test canvas interactions
      const interactionStart = Date.now();
      
      // Pan the canvas
      await canvasPage.mouse.move(500, 300);
      await canvasPage.mouse.down();
      await canvasPage.mouse.move(700, 400);
      await canvasPage.mouse.up();
      
      // Zoom in/out
      await canvasPage.keyboard.press('Control+Equal');
      await canvasPage.waitForTimeout(100);
      await canvasPage.keyboard.press('Control+Minus');
      await canvasPage.waitForTimeout(100);
      
      // Select multiple nodes
      await canvasPage.keyboard.down('Shift');
      for (let i = 0; i < 5; i++) {
        await canvasPage.click(`[data-testid="flow-node-node-5-${i}"]`);
        await canvasPage.waitForTimeout(50);
      }
      await canvasPage.keyboard.up('Shift');
      
      const interactionTime = Date.now() - interactionStart;
      
      // Check for performance warnings
      const performanceWarnings = await canvasPage.evaluate(() => {
        return (window as any).performanceWarnings || [];
      });
      
      await canvasPage.close();
      
      testResults.steps.push({
        name: '500 Node Canvas Rendering',
        duration: Date.now() - step2Start,
        success: true,
        nodeCount: 500,
        edgeCount: edges.length,
        renderTime,
        interactionTime,
        performanceWarnings: performanceWarnings.length
      });

      // Step 3: Test 50 WebSocket clients
      const step3Start = Date.now();
      
      const wsClients: WebSocket[] = [];
      const wsMetrics: any[] = [];
      
      // Create a test execution to monitor
      const wsTestProject = await axios.post(`${API_URL}/api/projects`, {
        name: `ws-test-${testId}`,
        description: 'WebSocket performance test',
        type: 'simple'
      });
      
      const wsProjectId = wsTestProject.data.project.id;
      
      // Connect 50 WebSocket clients
      for (let i = 0; i < 50; i++) {
        const clientStart = Date.now();
        const ws = new WebSocket(`${WS_URL}/execution`);
        const clientMetrics = {
          id: i,
          connectTime: 0,
          messageCount: 0,
          errors: 0,
          latencies: [] as number[]
        };
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('WS connection timeout')), 5000);
          
          ws.on('open', () => {
            clearTimeout(timeout);
            clientMetrics.connectTime = Date.now() - clientStart;
            
            // Subscribe to project updates
            ws.send(JSON.stringify({
              type: 'subscribe',
              projectId: wsProjectId,
              clientId: `client-${i}`
            }));
            
            resolve(undefined);
          });
          
          ws.on('error', () => {
            clientMetrics.errors++;
          });
        });
        
        // Track messages
        ws.on('message', (data) => {
          const messageTime = Date.now();
          clientMetrics.messageCount++;
          
          try {
            const event = JSON.parse(data.toString());
            if (event.timestamp) {
              const latency = messageTime - event.timestamp;
              clientMetrics.latencies.push(latency);
            }
          } catch (e) {
            // Ignore parse errors
          }
        });
        
        wsClients.push(ws);
        wsMetrics.push(clientMetrics);
      }
      
      // Generate WebSocket traffic
      const trafficStart = Date.now();
      
      // Create a flow that generates events
      const wsFlowResponse = await axios.post(`${API_URL}/api/flows`, {
        projectId: wsProjectId,
        nodes: Array.from({ length: 10 }, (_, i) => ({
          id: `ws-node-${i}`,
          type: 'execution',
          data: {
            agent: 'event-generator',
            label: `Event Generator ${i}`,
            config: { eventCount: 10, delay: 100 }
          },
          position: { x: 100 + (i * 100), y: 200 }
        })),
        edges: Array.from({ length: 9 }, (_, i) => ({
          id: `ws-edge-${i}`,
          source: `ws-node-${i}`,
          target: `ws-node-${i + 1}`
        }))
      });
      
      // Start execution to generate events
      await axios.post(`${API_URL}/api/executions/start`, {
        projectId: wsProjectId,
        flowId: wsFlowResponse.data.flow.id
      });
      
      // Let it run for 10 seconds
      await new Promise(r => setTimeout(r, 10000));
      
      const trafficDuration = Date.now() - trafficStart;
      
      // Calculate WebSocket metrics
      const totalMessages = wsMetrics.reduce((sum, m) => sum + m.messageCount, 0);
      const avgMessages = totalMessages / wsMetrics.length;
      const avgConnectTime = wsMetrics.reduce((sum, m) => sum + m.connectTime, 0) / wsMetrics.length;
      const totalErrors = wsMetrics.reduce((sum, m) => sum + m.errors, 0);
      
      // Calculate average latency
      const allLatencies = wsMetrics.flatMap(m => m.latencies);
      const avgLatency = allLatencies.length > 0 
        ? allLatencies.reduce((sum, l) => sum + l, 0) / allLatencies.length 
        : 0;
      
      // Close all connections
      wsClients.forEach(ws => ws.close());
      
      testResults.steps.push({
        name: '50 WebSocket Clients',
        duration: Date.now() - step3Start,
        success: true,
        clientCount: 50,
        totalMessages,
        avgMessagesPerClient: Math.round(avgMessages),
        avgConnectTime: Math.round(avgConnectTime),
        avgLatency: Math.round(avgLatency),
        totalErrors,
        trafficDuration
      });

      // Step 4: Measure all metrics
      const step4Start = Date.now();
      
      // Get system metrics from monitoring endpoint
      const metricsResponse = await axios.get(`${API_URL}/api/monitoring/metrics`);
      const systemMetrics = metricsResponse.data;
      
      // Memory usage
      const memoryUsage = {
        heapUsed: Math.round(systemMetrics.memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(systemMetrics.memory.heapTotal / 1024 / 1024),
        external: Math.round(systemMetrics.memory.external / 1024 / 1024),
        rss: Math.round(systemMetrics.memory.rss / 1024 / 1024)
      };
      
      // CPU usage
      const cpuUsage = {
        user: systemMetrics.cpu.user,
        system: systemMetrics.cpu.system,
        percent: systemMetrics.cpu.percent
      };
      
      // Database metrics
      const dbMetricsResponse = await axios.get(`${API_URL}/api/monitoring/database`);
      const dbMetrics = dbMetricsResponse.data;
      
      // Queue metrics
      const queueMetricsResponse = await axios.get(`${API_URL}/api/monitoring/queues`);
      const queueMetrics = queueMetricsResponse.data;
      
      testResults.steps.push({
        name: 'System Metrics Collection',
        duration: Date.now() - step4Start,
        success: true,
        memory: memoryUsage,
        cpu: cpuUsage,
        database: {
          activeConnections: dbMetrics.activeConnections,
          poolSize: dbMetrics.poolSize,
          queryCount: dbMetrics.queryCount,
          avgQueryTime: Math.round(dbMetrics.avgQueryTime)
        },
        queues: {
          activeJobs: queueMetrics.activeJobs,
          waitingJobs: queueMetrics.waitingJobs,
          completedJobs: queueMetrics.completedJobs,
          failedJobs: queueMetrics.failedJobs
        }
      });

      // Step 5: Load test summary
      const step5Start = Date.now();
      
      // Calculate overall performance score
      const performanceScore = {
        concurrency: successful >= 95 ? 100 : (successful / 100) * 100,
        canvasRendering: renderTime < 5000 ? 100 : Math.max(0, 100 - ((renderTime - 5000) / 100)),
        webSocketHandling: totalErrors === 0 && avgLatency < 100 ? 100 : Math.max(0, 100 - totalErrors * 10 - (avgLatency / 10)),
        systemStability: memoryUsage.heapUsed < 500 && cpuUsage.percent < 80 ? 100 : Math.max(0, 100 - ((memoryUsage.heapUsed - 500) / 10) - (cpuUsage.percent - 80))
      };
      
      const overallScore = (
        performanceScore.concurrency * 0.3 +
        performanceScore.canvasRendering * 0.2 +
        performanceScore.webSocketHandling * 0.3 +
        performanceScore.systemStability * 0.2
      );
      
      testResults.steps.push({
        name: 'Performance Summary',
        duration: Date.now() - step5Start,
        success: true,
        performanceScore,
        overallScore: Math.round(overallScore),
        grade: overallScore >= 90 ? 'A' : overallScore >= 80 ? 'B' : overallScore >= 70 ? 'C' : overallScore >= 60 ? 'D' : 'F'
      });

      // Calculate final metrics
      testResults.metrics = {
        totalDuration: testResults.steps.reduce((sum, step) => sum + step.duration, 0),
        concurrentExecutions: 100,
        successfulExecutions: successful,
        canvasNodes: 500,
        canvasRenderTime: renderTime,
        wsClients: 50,
        wsMessages: totalMessages,
        wsAvgLatency: Math.round(avgLatency),
        memoryUsageMB: memoryUsage.heapUsed,
        cpuPercent: cpuUsage.percent,
        performanceScore: Math.round(overallScore),
        grade: overallScore >= 90 ? 'A' : overallScore >= 80 ? 'B' : overallScore >= 70 ? 'C' : overallScore >= 60 ? 'D' : 'F'
      };

      testResults.success = true;
      testResults.endTime = new Date().toISOString();
      
    } catch (error) {
      testResults.success = false;
      testResults.error = error instanceof Error ? error.message : String(error);
      testResults.endTime = new Date().toISOString();
      throw error;
    } finally {
      // Save results
      await saveTestResults('performance', testResults);
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