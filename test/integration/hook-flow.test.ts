import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

const execAsync = promisify(exec);
const ORCHESTRATOR_URL = 'http://localhost:3003';
const TEST_PROJECT_DIR = path.join(process.cwd(), 'test-project');

interface TestNode {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'review-required';
  output?: any;
  error?: string;
}

interface WorkflowState {
  nodes: Record<string, TestNode>;
  currentNode: string | null;
  retryCount: number;
}

describe('Hook Flow Integration Tests', () => {
  let initialState: WorkflowState;

  beforeAll(async () => {
    // Ensure test directories exist
    await fs.mkdir(path.join(TEST_PROJECT_DIR, 'node-1'), { recursive: true });
    await fs.mkdir(path.join(TEST_PROJECT_DIR, 'node-2'), { recursive: true });
    
    // Initialize workflow state
    initialState = {
      nodes: {
        'node-1': { id: 'node-1', status: 'pending' },
        'node-2': { id: 'node-2', status: 'pending' }
      },
      currentNode: null,
      retryCount: 0
    };

    // Set initial state in orchestrator
    await axios.post(`${ORCHESTRATOR_URL}/api/workflow/init`, initialState);
  });

  beforeEach(async () => {
    // Reset workflow state before each test
    await axios.post(`${ORCHESTRATOR_URL}/api/workflow/reset`, initialState);
  });

  describe('Successful Completion Flow', () => {
    it('should handle successful agent completion and trigger next node', async () => {
      // Create test output file
      const outputData = {
        result: 'Task completed',
        data: { processed: true, timestamp: new Date().toISOString() }
      };
      
      await fs.writeFile(
        path.join(TEST_PROJECT_DIR, 'node-1', 'output.json'),
        JSON.stringify(outputData, null, 2)
      );

      // Execute stop hook
      const { stdout, stderr } = await execAsync(
        'NODE_ID=node-1 bash test-project/node-1/.claude/hooks/stop.sh'
      );

      expect(stderr).toBe('');
      expect(stdout).toContain('Sending completion callback');

      // Verify orchestrator state
      const response = await axios.get(`${ORCHESTRATOR_URL}/api/workflow/state`);
      const state = response.data;

      expect(state.nodes['node-1'].status).toBe('completed');
      expect(state.nodes['node-1'].output).toEqual(outputData);
      expect(state.currentNode).toBe('node-2');

      // Verify input file was created for next node
      const inputFile = path.join(TEST_PROJECT_DIR, 'node-2', 'input.json');
      const inputExists = await fs.access(inputFile).then(() => true).catch(() => false);
      expect(inputExists).toBe(true);

      if (inputExists) {
        const inputData = JSON.parse(await fs.readFile(inputFile, 'utf-8'));
        expect(inputData.previousNodeOutput).toEqual(outputData);
      }
    });

    it('should handle completion without output file', async () => {
      // Remove any existing output file
      const outputFile = path.join(TEST_PROJECT_DIR, 'node-1', 'output.json');
      await fs.unlink(outputFile).catch(() => {});

      // Execute stop hook
      const { stdout } = await execAsync(
        'NODE_ID=node-1 bash test-project/node-1/.claude/hooks/stop.sh'
      );

      expect(stdout).toContain('Task completed successfully');

      // Verify default output was sent
      const response = await axios.get(`${ORCHESTRATOR_URL}/api/workflow/state`);
      expect(response.data.nodes['node-1'].output.message).toBe('Task completed successfully');
    });
  });

  describe('Error Handling and Retry', () => {
    it('should handle agent error and trigger retry', async () => {
      // Execute error hook
      const { stdout } = await execAsync(
        'NODE_ID=node-1 ERROR_MESSAGE="Connection timeout" bash test-project/node-1/.claude/hooks/error.sh'
      );

      expect(stdout).toContain('Reporting error to orchestrator');

      // Verify error state
      const response = await axios.get(`${ORCHESTRATOR_URL}/api/workflow/state`);
      const state = response.data;

      expect(state.nodes['node-1'].status).toBe('error');
      expect(state.nodes['node-1'].error).toBe('Connection timeout');
      expect(state.retryCount).toBeGreaterThan(0);
    });

    it('should respect retry limit', async () => {
      // Simulate multiple failures
      for (let i = 0; i < 4; i++) {
        await execAsync(
          `NODE_ID=node-1 ERROR_MESSAGE="Attempt ${i + 1} failed" bash test-project/node-1/.claude/hooks/error.sh`
        );
      }

      const response = await axios.get(`${ORCHESTRATOR_URL}/api/workflow/state`);
      expect(response.data.nodes['node-1'].status).toBe('error');
      expect(response.data.retryCount).toBeLessThanOrEqual(3); // Max retry limit
    });

    it('should pass enhanced context on retry', async () => {
      // First attempt - fail with context
      await execAsync(
        'NODE_ID=node-1 ERROR_MESSAGE="Missing configuration" bash test-project/node-1/.claude/hooks/error.sh'
      );

      // Check if retry context was created
      const contextFile = path.join(TEST_PROJECT_DIR, 'node-1', 'retry-context.json');
      const contextExists = await fs.access(contextFile).then(() => true).catch(() => false);
      
      if (contextExists) {
        const context = JSON.parse(await fs.readFile(contextFile, 'utf-8'));
        expect(context.previousError).toBe('Missing configuration');
        expect(context.retryAttempt).toBeGreaterThan(0);
      }
    });
  });

  describe('Review Checkpoint Flow', () => {
    it('should pause execution at review checkpoint', async () => {
      const reviewData = {
        reviewPoint: 'Code generation complete',
        files: ['src/main.ts', 'src/utils.ts'],
        changes: 150
      };

      // Execute review hook
      await execAsync(
        `NODE_ID=node-1 REVIEW_DATA='${JSON.stringify(reviewData)}' bash test-project/node-1/.claude/hooks/review.sh`
      );

      // Verify review state
      const response = await axios.get(`${ORCHESTRATOR_URL}/api/workflow/state`);
      const state = response.data;

      expect(state.nodes['node-1'].status).toBe('review-required');
      expect(state.currentNode).toBe('node-1'); // Should not advance
    });

    it('should resume after review approval', async () => {
      // First trigger review
      await execAsync(
        'NODE_ID=node-1 bash test-project/node-1/.claude/hooks/review.sh'
      );

      // Approve review
      const approvalResponse = await axios.post(`${ORCHESTRATOR_URL}/api/workflow/review/approve`, {
        nodeId: 'node-1',
        feedback: 'Looks good, proceed',
        approved: true
      });

      expect(approvalResponse.data.success).toBe(true);

      // Verify state after approval
      const stateResponse = await axios.get(`${ORCHESTRATOR_URL}/api/workflow/state`);
      expect(stateResponse.data.nodes['node-1'].status).toBe('completed');
    });

    it('should handle review rejection with feedback', async () => {
      // Trigger review
      await execAsync(
        'NODE_ID=node-1 bash test-project/node-1/.claude/hooks/review.sh'
      );

      // Reject with feedback
      const rejectionResponse = await axios.post(`${ORCHESTRATOR_URL}/api/workflow/review/approve`, {
        nodeId: 'node-1',
        feedback: 'Please refactor the validation logic',
        approved: false
      });

      expect(rejectionResponse.data.success).toBe(true);

      // Check feedback file was created
      const feedbackFile = path.join(TEST_PROJECT_DIR, 'node-1', 'review-feedback.json');
      const feedbackExists = await fs.access(feedbackFile).then(() => true).catch(() => false);
      
      if (feedbackExists) {
        const feedback = JSON.parse(await fs.readFile(feedbackFile, 'utf-8'));
        expect(feedback.feedback).toContain('refactor the validation logic');
        expect(feedback.approved).toBe(false);
      }
    });
  });

  describe('Data Flow Validation', () => {
    it('should correctly transform and pass data between nodes', async () => {
      // Node 1 output
      const node1Output = {
        analysis: {
          files: ['app.ts', 'config.ts'],
          complexity: 'medium',
          recommendations: ['Add error handling', 'Improve logging']
        },
        metadata: {
          processedAt: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      await fs.writeFile(
        path.join(TEST_PROJECT_DIR, 'node-1', 'output.json'),
        JSON.stringify(node1Output, null, 2)
      );

      // Complete node 1
      await execAsync('NODE_ID=node-1 bash test-project/node-1/.claude/hooks/stop.sh');

      // Verify node 2 input
      const node2Input = JSON.parse(
        await fs.readFile(path.join(TEST_PROJECT_DIR, 'node-2', 'input.json'), 'utf-8')
      );

      expect(node2Input.previousNodeOutput).toEqual(node1Output);
      expect(node2Input.nodeId).toBe('node-2');
      expect(node2Input.workflowContext).toBeDefined();
    });

    it('should handle complex nested data structures', async () => {
      const complexOutput = {
        results: [
          { id: 1, data: { nested: { deep: 'value1' } } },
          { id: 2, data: { nested: { deep: 'value2' } } }
        ],
        transforms: {
          applied: ['normalize', 'validate', 'enrich'],
          stats: { processed: 100, failed: 2 }
        }
      };

      await fs.writeFile(
        path.join(TEST_PROJECT_DIR, 'node-1', 'output.json'),
        JSON.stringify(complexOutput, null, 2)
      );

      await execAsync('NODE_ID=node-1 bash test-project/node-1/.claude/hooks/stop.sh');

      const node2Input = JSON.parse(
        await fs.readFile(path.join(TEST_PROJECT_DIR, 'node-2', 'input.json'), 'utf-8')
      );

      expect(node2Input.previousNodeOutput).toEqual(complexOutput);
    });
  });

  describe('Concurrent Node Execution', () => {
    it('should handle parallel node completions', async () => {
      // Set up parallel workflow
      await axios.post(`${ORCHESTRATOR_URL}/api/workflow/init`, {
        nodes: {
          'parallel-1': { id: 'parallel-1', status: 'running' },
          'parallel-2': { id: 'parallel-2', status: 'running' },
          'merge-node': { id: 'merge-node', status: 'pending', dependencies: ['parallel-1', 'parallel-2'] }
        },
        currentNode: null,
        retryCount: 0
      });

      // Complete both parallel nodes
      const [result1, result2] = await Promise.all([
        execAsync('NODE_ID=parallel-1 bash test-project/node-1/.claude/hooks/stop.sh'),
        execAsync('NODE_ID=parallel-2 bash test-project/node-1/.claude/hooks/stop.sh')
      ]);

      expect(result1.stderr).toBe('');
      expect(result2.stderr).toBe('');

      // Verify merge node is triggered
      const response = await axios.get(`${ORCHESTRATOR_URL}/api/workflow/state`);
      expect(response.data.nodes['merge-node'].status).toBe('pending'); // Ready to run
    });
  });

  afterAll(async () => {
    // Cleanup test files
    await fs.rm(TEST_PROJECT_DIR, { recursive: true, force: true });
  });
});