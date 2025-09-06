import { test, expect } from '@playwright/test';
import { WebSocket } from 'ws';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3002';
const WS_URL = 'ws://localhost:3002';

test.describe('Failure Recovery Test', () => {
  test('should handle agent failures and recover gracefully', async ({ page }) => {
    const testId = uuidv4();
    const projectName = `failure-recovery-${testId}`;
    const testResults = {
      testId,
      testName: 'Failure Recovery Test',
      startTime: new Date().toISOString(),
      steps: [] as any[],
      metrics: {} as any
    };

    try {
      // Step 1: Create flow with failure injection points
      const step1Start = Date.now();
      
      // Create project
      const projectResponse = await axios.post(`${API_URL}/api/projects`, {
        name: projectName,
        description: 'Failure recovery test project',
        type: 'nodejs',
        config: {
          enableRetries: true,
          maxRetries: 3,
          retryDelay: 1000,
          enableRollback: true
        }
      });
      
      const projectId = projectResponse.data.project.id;
      
      // Create flow with nodes that will fail
      const flowResponse = await axios.post(`${API_URL}/api/flows`, {
        projectId,
        nodes: [
          {
            id: 'setup',
            type: 'setup',
            data: {
              agent: 'nodejs-setup',
              label: 'Setup Node.js Project',
              config: {}
            },
            position: { x: 100, y: 200 }
          },
          {
            id: 'fail-node-1',
            type: 'execution',
            data: {
              agent: 'nodejs-developer',
              label: 'Node with Injected Failure',
              config: {
                instructions: 'Create server.js',
                failureInjection: {
                  enabled: true,
                  failOnAttempt: 1,
                  errorType: 'timeout',
                  errorMessage: 'Simulated timeout error'
                }
              }
            },
            position: { x: 300, y: 100 }
          },
          {
            id: 'normal-node',
            type: 'execution',
            data: {
              agent: 'nodejs-developer',
              label: 'Normal Execution Node',
              config: {
                instructions: 'Create utils.js'
              }
            },
            position: { x: 300, y: 300 }
          },
          {
            id: 'fail-node-2',
            type: 'testing',
            data: {
              agent: 'jest-runner',
              label: 'Test with Failure',
              config: {
                failureInjection: {
                  enabled: true,
                  failOnAttempt: [1, 2],
                  errorType: 'assertion',
                  errorMessage: 'Test failed: Expected value not found'
                }
              }
            },
            position: { x: 500, y: 100 }
          },
          {
            id: 'critical-node',
            type: 'execution',
            data: {
              agent: 'nodejs-developer',
              label: 'Critical Node with Rollback',
              config: {
                instructions: 'Modify critical config',
                critical: true,
                rollbackEnabled: true,
                failureInjection: {
                  enabled: true,
                  failOnAttempt: 1,
                  errorType: 'fatal',
                  errorMessage: 'Critical operation failed'
                }
              }
            },
            position: { x: 500, y: 300 }
          },
          {
            id: 'integration',
            type: 'integration',
            data: {
              agent: 'integration-tester',
              label: 'Integration Point',
              config: {}
            },
            position: { x: 700, y: 200 }
          }
        ],
        edges: [
          { id: 'e1', source: 'setup', target: 'fail-node-1' },
          { id: 'e2', source: 'setup', target: 'normal-node' },
          { id: 'e3', source: 'fail-node-1', target: 'fail-node-2' },
          { id: 'e4', source: 'normal-node', target: 'critical-node' },
          { id: 'e5', source: 'fail-node-2', target: 'integration' },
          { id: 'e6', source: 'critical-node', target: 'integration' }
        ]
      });
      
      const flowId = flowResponse.data.flow.id;
      
      testResults.steps.push({
        name: 'Flow Setup with Failure Points',
        duration: Date.now() - step1Start,
        success: true,
        projectId,
        flowId,
        failureNodes: 3
      });

      // Step 2: Execute and monitor failures
      const step2Start = Date.now();
      
      // Navigate to flow
      await page.goto(`${BASE_URL}/projects/${projectId}/flow/${flowId}`);
      await page.waitForSelector('[data-testid="flow-canvas"]', { timeout: 10000 });
      
      // Connect WebSocket
      const ws = new WebSocket(`${WS_URL}/execution`);
      const wsEvents: any[] = [];
      const failures: any[] = [];
      const retries: any[] = [];
      const rollbacks: any[] = [];
      
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
        wsEvents.push(event);
        
        // Track failures
        if (event.type === 'node:failed') {
          failures.push({
            nodeId: event.nodeId,
            timestamp: Date.now(),
            error: event.error,
            attempt: event.attempt
          });
        }
        
        // Track retries
        if (event.type === 'node:retry') {
          retries.push({
            nodeId: event.nodeId,
            timestamp: Date.now(),
            attempt: event.attempt,
            reason: event.reason
          });
        }
        
        // Track rollbacks
        if (event.type === 'node:rollback') {
          rollbacks.push({
            nodeId: event.nodeId,
            timestamp: Date.now(),
            reason: event.reason
          });
        }
      });

      // Start execution
      await page.click('[data-testid="execute-flow-btn"]');
      
      // Wait for initial failures
      await page.waitForTimeout(5000);
      
      testResults.steps.push({
        name: 'Initial Execution with Failures',
        duration: Date.now() - step2Start,
        success: true,
        initialFailures: failures.length,
        wsEventsCollected: wsEvents.length
      });

      // Step 3: Test retry mechanisms
      const step3Start = Date.now();
      
      // Monitor retries
      let retryCompleted = false;
      for (let i = 0; i < 60; i++) { // 1 minute timeout
        await page.waitForTimeout(1000);
        
        // Check for successful retries
        const failNode1Status = await page.locator('[data-testid="node-status-fail-node-1"]').getAttribute('data-status');
        const failNode2Status = await page.locator('[data-testid="node-status-fail-node-2"]').getAttribute('data-status');
        
        if (failNode1Status === 'completed') {
          console.log('fail-node-1 recovered after retry');
          retryCompleted = true;
        }
        
        // fail-node-2 should fail twice then succeed on third attempt
        if (retries.filter(r => r.nodeId === 'fail-node-2').length >= 2) {
          if (failNode2Status === 'completed') {
            console.log('fail-node-2 recovered after multiple retries');
          }
        }
        
        if (retries.length >= 3) break;
      }
      
      // Verify retry behavior
      expect(retries.length).toBeGreaterThan(0);
      
      // Check fail-node-1 (fails once, succeeds on retry)
      const node1Retries = retries.filter(r => r.nodeId === 'fail-node-1');
      expect(node1Retries.length).toBeGreaterThanOrEqual(1);
      
      // Check fail-node-2 (fails twice, succeeds on third)
      const node2Retries = retries.filter(r => r.nodeId === 'fail-node-2');
      expect(node2Retries.length).toBeGreaterThanOrEqual(2);
      
      testResults.steps.push({
        name: 'Retry Mechanism Verification',
        duration: Date.now() - step3Start,
        success: true,
        totalRetries: retries.length,
        retriesByNode: {
          'fail-node-1': node1Retries.length,
          'fail-node-2': node2Retries.length
        }
      });

      // Step 4: Verify error handling
      const step4Start = Date.now();
      
      // Check error notifications
      const errorNotifications = await page.locator('[data-testid^="error-notification-"]').all();
      expect(errorNotifications.length).toBeGreaterThan(0);
      
      // Verify error details are displayed
      for (const notification of errorNotifications) {
        const errorText = await notification.textContent();
        expect(errorText).toBeTruthy();
      }
      
      // Check error logs via API
      const errorLogsResponse = await axios.get(
        `${API_URL}/api/executions/${projectId}/errors`
      );
      
      const errorLogs = errorLogsResponse.data.errors;
      expect(errorLogs).toBeDefined();
      expect(errorLogs.length).toBeGreaterThan(0);
      
      // Verify error categorization
      const errorTypes = new Set(errorLogs.map((e: any) => e.type));
      expect(errorTypes.has('timeout')).toBe(true);
      expect(errorTypes.has('assertion')).toBe(true);
      
      testResults.steps.push({
        name: 'Error Handling Verification',
        duration: Date.now() - step4Start,
        success: true,
        errorNotifications: errorNotifications.length,
        errorLogCount: errorLogs.length,
        errorTypes: Array.from(errorTypes)
      });

      // Step 5: Test rollback capabilities
      const step5Start = Date.now();
      
      // Critical node should trigger rollback on failure
      await page.waitForTimeout(5000);
      
      // Check for rollback events
      expect(rollbacks.length).toBeGreaterThan(0);
      
      const criticalRollback = rollbacks.find(r => r.nodeId === 'critical-node');
      expect(criticalRollback).toBeDefined();
      
      // Verify rollback status in UI
      const rollbackIndicator = await page.locator('[data-testid="rollback-indicator-critical-node"]').isVisible();
      expect(rollbackIndicator).toBe(true);
      
      // Check rollback details via API
      const rollbackResponse = await axios.get(
        `${API_URL}/api/executions/${projectId}/rollbacks`
      );
      
      const rollbackData = rollbackResponse.data.rollbacks;
      expect(rollbackData).toBeDefined();
      expect(rollbackData.length).toBeGreaterThan(0);
      
      // Verify rollback restored previous state
      const criticalRollbackData = rollbackData.find((r: any) => r.nodeId === 'critical-node');
      expect(criticalRollbackData).toBeDefined();
      expect(criticalRollbackData.status).toBe('completed');
      expect(criticalRollbackData.restoredState).toBeDefined();
      
      testResults.steps.push({
        name: 'Rollback Capabilities',
        duration: Date.now() - step5Start,
        success: true,
        rollbackCount: rollbacks.length,
        criticalRollbackSuccess: true,
        stateRestored: true
      });

      // Step 6: Verify recovery completion
      const step6Start = Date.now();
      
      // Wait for execution to complete or stabilize
      let executionComplete = false;
      for (let i = 0; i < 120; i++) { // 2 minute timeout
        await page.waitForTimeout(1000);
        
        const status = await page.locator('[data-testid="execution-status"]').getAttribute('data-status');
        
        if (status === 'completed' || status === 'completed-with-errors') {
          executionComplete = true;
          break;
        }
        
        if (status === 'failed' && i > 60) {
          // After 1 minute, if still failed, check if unrecoverable
          break;
        }
      }
      
      // Get final execution report
      const reportResponse = await axios.get(
        `${API_URL}/api/executions/${projectId}/report`
      );
      
      const report = reportResponse.data.report;
      
      // Verify recovery statistics
      expect(report.totalNodes).toBe(6);
      expect(report.completedNodes).toBeGreaterThanOrEqual(4); // At least normal nodes completed
      expect(report.failedNodes).toBeLessThanOrEqual(2); // Some may remain failed
      expect(report.retriedNodes).toBeGreaterThanOrEqual(2);
      expect(report.rolledBackNodes).toBeGreaterThanOrEqual(1);
      
      // Check recovery rate
      const recoveryRate = (report.completedNodes / report.totalNodes) * 100;
      
      testResults.steps.push({
        name: 'Recovery Completion',
        duration: Date.now() - step6Start,
        success: true,
        executionComplete,
        finalStatus: report.status,
        completedNodes: report.completedNodes,
        recoveryRate: `${recoveryRate.toFixed(1)}%`
      });

      // Step 7: Verify audit trail
      const step7Start = Date.now();
      
      // Get complete audit trail
      const auditResponse = await axios.get(
        `${API_URL}/api/executions/${projectId}/audit`
      );
      
      const auditTrail = auditResponse.data.audit;
      
      // Verify all events are logged
      const auditEventTypes = new Set(auditTrail.map((a: any) => a.eventType));
      
      expect(auditEventTypes.has('execution:started')).toBe(true);
      expect(auditEventTypes.has('node:failed')).toBe(true);
      expect(auditEventTypes.has('node:retry')).toBe(true);
      expect(auditEventTypes.has('node:rollback')).toBe(true);
      expect(auditEventTypes.has('node:completed')).toBe(true);
      
      // Verify event sequence
      const failureEvents = auditTrail.filter((a: any) => a.eventType === 'node:failed');
      const retryEvents = auditTrail.filter((a: any) => a.eventType === 'node:retry');
      
      // Each failure should have corresponding retry (except unrecoverable)
      expect(retryEvents.length).toBeGreaterThanOrEqual(failureEvents.length - 1);
      
      testResults.steps.push({
        name: 'Audit Trail Verification',
        duration: Date.now() - step7Start,
        success: true,
        auditEventCount: auditTrail.length,
        eventTypes: Array.from(auditEventTypes),
        failureEventsLogged: failureEvents.length,
        retryEventsLogged: retryEvents.length
      });

      // Calculate final metrics
      testResults.metrics = {
        totalDuration: testResults.steps.reduce((sum, step) => sum + step.duration, 0),
        totalFailures: failures.length,
        totalRetries: retries.length,
        totalRollbacks: rollbacks.length,
        recoveryRate: `${recoveryRate.toFixed(1)}%`,
        wsEvents: wsEvents.length,
        auditEvents: auditTrail.length,
        successfulRecoveries: report.completedNodes - (6 - failures.length)
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
      await saveTestResults('failure-recovery', testResults);
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