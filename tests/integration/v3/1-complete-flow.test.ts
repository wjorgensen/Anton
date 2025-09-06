import { test, expect } from '@playwright/test';
import { WebSocket } from 'ws';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3002';
const WS_URL = 'ws://localhost:3002';

test.describe('Complete Flow Test', () => {
  test('should execute end-to-end flow from project creation to completion', async ({ page }) => {
    const testId = uuidv4();
    const projectName = `test-project-${testId}`;
    const testResults = {
      testId,
      testName: 'Complete Flow Test',
      startTime: new Date().toISOString(),
      steps: [] as any[],
      metrics: {} as any
    };

    try {
      // Step 1: Navigate to UI and create project
      const step1Start = Date.now();
      await page.goto(BASE_URL);
      await page.waitForSelector('[data-testid="create-project-btn"]', { timeout: 10000 });
      await page.click('[data-testid="create-project-btn"]');
      
      await page.fill('[data-testid="project-name-input"]', projectName);
      await page.fill('[data-testid="project-description"]', 'Integration test project for complete flow');
      await page.selectOption('[data-testid="project-type"]', 'nextjs');
      await page.click('[data-testid="submit-project-btn"]');
      
      // Wait for project creation
      await page.waitForSelector('[data-testid="project-dashboard"]', { timeout: 30000 });
      const projectId = await page.getAttribute('[data-testid="project-id"]', 'data-project-id');
      
      testResults.steps.push({
        name: 'Project Creation',
        duration: Date.now() - step1Start,
        success: true,
        projectId
      });

      // Step 2: Generate flow with planning service
      const step2Start = Date.now();
      await page.click('[data-testid="generate-flow-btn"]');
      await page.fill('[data-testid="requirements-input"]', `
        Create a Next.js application with:
        - Home page with welcome message
        - About page with company info
        - Contact form with email validation
        - Responsive navbar
        - Unit tests for all components
        - End-to-end tests
      `);
      await page.click('[data-testid="submit-requirements-btn"]');
      
      // Wait for flow generation
      await page.waitForSelector('[data-testid="flow-canvas"]', { timeout: 60000 });
      const nodeCount = await page.locator('[data-testid^="flow-node-"]').count();
      expect(nodeCount).toBeGreaterThan(5);
      
      testResults.steps.push({
        name: 'Flow Generation',
        duration: Date.now() - step2Start,
        success: true,
        nodeCount
      });

      // Step 3: Execute flow with real Claude Code instances
      const step3Start = Date.now();
      
      // Connect WebSocket for monitoring
      const ws = new WebSocket(`${WS_URL}/execution`);
      const wsEvents: any[] = [];
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({ 
            type: 'subscribe', 
            projectId,
            clientId: testId 
          }));
          resolve(undefined);
        });
      });

      ws.on('message', (data) => {
        const event = JSON.parse(data.toString());
        wsEvents.push({
          timestamp: new Date().toISOString(),
          ...event
        });
      });

      // Start execution
      await page.click('[data-testid="execute-flow-btn"]');
      
      // Monitor execution progress
      const executionStarted = await page.waitForSelector('[data-testid="execution-status-running"]', { timeout: 10000 });
      expect(executionStarted).toBeTruthy();
      
      // Track node executions
      const executedNodes = new Set();
      let lastEventCount = 0;
      
      for (let i = 0; i < 300; i++) { // 5 minute timeout
        await page.waitForTimeout(1000);
        
        // Check for completed nodes
        const completedNodes = await page.locator('[data-testid^="node-status-completed-"]').all();
        for (const node of completedNodes) {
          const nodeId = await node.getAttribute('data-node-id');
          if (nodeId) executedNodes.add(nodeId);
        }
        
        // Check if execution completed
        const isComplete = await page.locator('[data-testid="execution-status-completed"]').isVisible();
        if (isComplete) break;
        
        // Check for errors
        const hasError = await page.locator('[data-testid="execution-status-error"]').isVisible();
        if (hasError) {
          throw new Error('Execution failed with error');
        }
        
        // Log progress every 10 seconds
        if (i % 10 === 0) {
          console.log(`Execution progress: ${executedNodes.size} nodes completed, ${wsEvents.length} WebSocket events`);
        }
      }
      
      testResults.steps.push({
        name: 'Flow Execution',
        duration: Date.now() - step3Start,
        success: true,
        executedNodes: executedNodes.size,
        wsEvents: wsEvents.length
      });

      // Step 4: Monitor via WebSocket
      const step4Start = Date.now();
      
      // Verify WebSocket events
      expect(wsEvents.length).toBeGreaterThan(10);
      
      // Check event types
      const eventTypes = new Set(wsEvents.map(e => e.type));
      expect(eventTypes.has('node:started')).toBe(true);
      expect(eventTypes.has('node:completed')).toBe(true);
      expect(eventTypes.has('output:stream')).toBe(true);
      
      // Verify output streaming
      const outputEvents = wsEvents.filter(e => e.type === 'output:stream');
      expect(outputEvents.length).toBeGreaterThan(0);
      
      testResults.steps.push({
        name: 'WebSocket Monitoring',
        duration: Date.now() - step4Start,
        success: true,
        eventTypes: Array.from(eventTypes),
        outputStreamCount: outputEvents.length
      });

      // Step 5: Verify completion
      const step5Start = Date.now();
      
      // Check final status
      const finalStatus = await page.locator('[data-testid="execution-status-completed"]').isVisible();
      expect(finalStatus).toBe(true);
      
      // Verify artifacts created
      const artifactsResponse = await axios.get(`${API_URL}/api/projects/${projectId}/artifacts`);
      expect(artifactsResponse.data.artifacts).toBeDefined();
      expect(artifactsResponse.data.artifacts.length).toBeGreaterThan(0);
      
      // Check for generated files
      const files = artifactsResponse.data.artifacts;
      const hasPages = files.some((f: any) => f.path.includes('pages/') || f.path.includes('app/'));
      const hasTests = files.some((f: any) => f.path.includes('.test.') || f.path.includes('.spec.'));
      
      expect(hasPages).toBe(true);
      expect(hasTests).toBe(true);
      
      // Verify execution logs
      const logsResponse = await axios.get(`${API_URL}/api/executions/${projectId}/logs`);
      expect(logsResponse.data.logs).toBeDefined();
      expect(logsResponse.data.logs.length).toBeGreaterThan(0);
      
      testResults.steps.push({
        name: 'Completion Verification',
        duration: Date.now() - step5Start,
        success: true,
        artifactCount: files.length,
        logEntries: logsResponse.data.logs.length
      });

      // Calculate metrics
      testResults.metrics = {
        totalDuration: testResults.steps.reduce((sum, step) => sum + step.duration, 0),
        nodeExecutions: executedNodes.size,
        wsEvents: wsEvents.length,
        artifacts: files.length,
        successRate: '100%'
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
      await saveTestResults('complete-flow', testResults);
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