import { test, expect } from '@playwright/test';
import { WebSocket } from 'ws';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3002';
const WS_URL = 'ws://localhost:3002';

test.describe('Review System Test', () => {
  test('should handle review checkpoints with feedback and retry', async ({ page, context }) => {
    const testId = uuidv4();
    const projectName = `review-test-${testId}`;
    const testResults = {
      testId,
      testName: 'Review System Test',
      startTime: new Date().toISOString(),
      steps: [] as any[],
      metrics: {} as any
    };

    try {
      // Step 1: Create project with review checkpoint
      const step1Start = Date.now();
      await page.goto(BASE_URL);
      await page.waitForSelector('[data-testid="create-project-btn"]', { timeout: 10000 });
      await page.click('[data-testid="create-project-btn"]');
      
      await page.fill('[data-testid="project-name-input"]', projectName);
      await page.fill('[data-testid="project-description"]', 'Test project with review checkpoints');
      await page.selectOption('[data-testid="project-type"]', 'react');
      await page.click('[data-testid="enable-review-checkpoints"]');
      await page.click('[data-testid="submit-project-btn"]');
      
      await page.waitForSelector('[data-testid="project-dashboard"]', { timeout: 30000 });
      const projectId = await page.getAttribute('[data-testid="project-id"]', 'data-project-id');
      
      testResults.steps.push({
        name: 'Project Setup with Review',
        duration: Date.now() - step1Start,
        success: true,
        projectId
      });

      // Step 2: Create flow with review nodes
      const step2Start = Date.now();
      
      // Use API to create specific flow with review nodes
      const flowResponse = await axios.post(`${API_URL}/api/flows`, {
        projectId,
        nodes: [
          {
            id: 'setup-1',
            type: 'setup',
            data: {
              agent: 'react-setup',
              label: 'Setup React Project',
              config: { framework: 'react', typescript: true }
            },
            position: { x: 100, y: 100 }
          },
          {
            id: 'dev-1',
            type: 'execution',
            data: {
              agent: 'react-developer',
              label: 'Develop Components',
              config: { 
                instructions: 'Create Header, Footer, and HomePage components'
              }
            },
            position: { x: 300, y: 100 }
          },
          {
            id: 'review-1',
            type: 'review',
            data: {
              agent: 'manual-review',
              label: 'Code Review Checkpoint',
              config: {
                reviewType: 'manual',
                requiredApprovals: 1,
                reviewCriteria: [
                  'Code follows React best practices',
                  'Components are properly typed',
                  'No console errors'
                ]
              }
            },
            position: { x: 500, y: 100 }
          },
          {
            id: 'test-1',
            type: 'testing',
            data: {
              agent: 'jest-runner',
              label: 'Run Tests',
              config: { coverage: true }
            },
            position: { x: 700, y: 100 }
          }
        ],
        edges: [
          { id: 'e1', source: 'setup-1', target: 'dev-1' },
          { id: 'e2', source: 'dev-1', target: 'review-1' },
          { id: 'e3', source: 'review-1', target: 'test-1' }
        ]
      });
      
      expect(flowResponse.data.flow).toBeDefined();
      const flowId = flowResponse.data.flow.id;
      
      // Navigate to flow
      await page.goto(`${BASE_URL}/projects/${projectId}/flow/${flowId}`);
      await page.waitForSelector('[data-testid="flow-canvas"]', { timeout: 10000 });
      
      testResults.steps.push({
        name: 'Flow Creation with Review',
        duration: Date.now() - step2Start,
        success: true,
        flowId,
        nodeCount: 4
      });

      // Step 3: Execute flow and reach review checkpoint
      const step3Start = Date.now();
      
      // Connect WebSocket
      const ws = new WebSocket(`${WS_URL}/execution`);
      const wsEvents: any[] = [];
      
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
      });

      // Start execution
      await page.click('[data-testid="execute-flow-btn"]');
      
      // Wait for review checkpoint
      let reviewReached = false;
      for (let i = 0; i < 120; i++) { // 2 minute timeout
        await page.waitForTimeout(1000);
        
        const reviewPending = await page.locator('[data-testid="review-pending-banner"]').isVisible();
        if (reviewPending) {
          reviewReached = true;
          break;
        }
        
        // Check if review node is active
        const reviewNodeActive = await page.locator('[data-testid="node-status-pending-review-1"]').isVisible();
        if (reviewNodeActive) {
          reviewReached = true;
          break;
        }
      }
      
      expect(reviewReached).toBe(true);
      
      // Verify execution paused
      const executionStatus = await page.locator('[data-testid="execution-status"]').textContent();
      expect(executionStatus).toContain('Review');
      
      testResults.steps.push({
        name: 'Execution Paused at Review',
        duration: Date.now() - step3Start,
        success: true,
        wsEventsAtPause: wsEvents.length
      });

      // Step 4: Submit feedback and request changes
      const step4Start = Date.now();
      
      // Open review panel
      await page.click('[data-testid="open-review-panel-btn"]');
      await page.waitForSelector('[data-testid="review-panel"]', { timeout: 5000 });
      
      // Check review criteria
      const criteria = await page.locator('[data-testid^="review-criterion-"]').all();
      expect(criteria.length).toBe(3);
      
      // Submit feedback with requested changes
      await page.fill('[data-testid="review-feedback-input"]', `
        Please make the following changes:
        1. Add PropTypes validation to all components
        2. Include aria-labels for accessibility
        3. Add error boundaries
      `);
      
      // Select "Request Changes" action
      await page.selectOption('[data-testid="review-action"]', 'request-changes');
      await page.click('[data-testid="submit-review-btn"]');
      
      // Verify feedback recorded
      await page.waitForSelector('[data-testid="review-submitted-notice"]', { timeout: 5000 });
      
      // Check that execution will retry with context
      const retryNotice = await page.locator('[data-testid="retry-with-feedback-notice"]').isVisible();
      expect(retryNotice).toBe(true);
      
      testResults.steps.push({
        name: 'Feedback Submission',
        duration: Date.now() - step4Start,
        success: true,
        feedbackSubmitted: true,
        action: 'request-changes'
      });

      // Step 5: Verify retry with context
      const step5Start = Date.now();
      
      // Track retry execution
      const preRetryEventCount = wsEvents.length;
      
      // Wait for retry to start
      await page.waitForSelector('[data-testid="node-status-running-dev-1"]', { timeout: 10000 });
      
      // Monitor retry execution
      let retryCompleted = false;
      for (let i = 0; i < 120; i++) { // 2 minute timeout
        await page.waitForTimeout(1000);
        
        // Check if dev node completed again
        const devCompleted = await page.locator('[data-testid="node-status-completed-dev-1"]').isVisible();
        if (devCompleted) {
          // Check if review node is active again
          const reviewActive = await page.locator('[data-testid="node-status-pending-review-1"]').isVisible();
          if (reviewActive) {
            retryCompleted = true;
            break;
          }
        }
      }
      
      expect(retryCompleted).toBe(true);
      
      // Verify feedback was included in retry
      const retryEvents = wsEvents.slice(preRetryEventCount);
      const contextEvents = retryEvents.filter(e => 
        e.type === 'node:context' && e.data?.feedback
      );
      expect(contextEvents.length).toBeGreaterThan(0);
      
      testResults.steps.push({
        name: 'Retry with Context',
        duration: Date.now() - step5Start,
        success: true,
        retryEventCount: retryEvents.length,
        contextIncluded: contextEvents.length > 0
      });

      // Step 6: Approve and complete
      const step6Start = Date.now();
      
      // Approve the review this time
      await page.fill('[data-testid="review-feedback-input"]', 'Looks good now! All requested changes have been implemented.');
      await page.selectOption('[data-testid="review-action"]', 'approve');
      
      // Check all criteria
      for (const criterion of criteria) {
        const checkbox = criterion.locator('input[type="checkbox"]');
        await checkbox.check();
      }
      
      await page.click('[data-testid="submit-review-btn"]');
      
      // Wait for flow to continue
      await page.waitForSelector('[data-testid="node-status-completed-review-1"]', { timeout: 10000 });
      
      // Wait for test node to complete
      await page.waitForSelector('[data-testid="node-status-completed-test-1"]', { timeout: 60000 });
      
      // Verify entire flow completed
      const flowCompleted = await page.locator('[data-testid="execution-status-completed"]').isVisible();
      expect(flowCompleted).toBe(true);
      
      testResults.steps.push({
        name: 'Approval and Completion',
        duration: Date.now() - step6Start,
        success: true,
        approved: true,
        flowCompleted: true
      });

      // Step 7: Verify audit trail
      const step7Start = Date.now();
      
      // Get review history via API
      const historyResponse = await axios.get(`${API_URL}/api/executions/${projectId}/reviews`);
      const reviews = historyResponse.data.reviews;
      
      expect(reviews).toBeDefined();
      expect(reviews.length).toBeGreaterThanOrEqual(2); // At least 2 review submissions
      
      // Verify first review was "request changes"
      const firstReview = reviews.find((r: any) => r.action === 'request-changes');
      expect(firstReview).toBeDefined();
      expect(firstReview.feedback).toContain('PropTypes');
      
      // Verify second review was "approve"
      const secondReview = reviews.find((r: any) => r.action === 'approve');
      expect(secondReview).toBeDefined();
      expect(secondReview.feedback).toContain('Looks good');
      
      // Check all criteria were met
      expect(secondReview.criteriaChecked).toBe(true);
      
      testResults.steps.push({
        name: 'Audit Trail Verification',
        duration: Date.now() - step7Start,
        success: true,
        reviewCount: reviews.length,
        actionsRecorded: ['request-changes', 'approve']
      });

      // Calculate metrics
      testResults.metrics = {
        totalDuration: testResults.steps.reduce((sum, step) => sum + step.duration, 0),
        reviewIterations: 2,
        wsEvents: wsEvents.length,
        feedbackCycles: 1,
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
      await saveTestResults('review-system', testResults);
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