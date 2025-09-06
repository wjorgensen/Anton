import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { FlowExecutor } from '../../orchestration/src/core/FlowExecutor';
import { ClaudeCodeManager } from '../../orchestration/src/core/ClaudeCodeManager';
import { HookHandler } from '../../orchestration/src/hooks/HookHandler';
import { WebSocketService } from '../../orchestration/src/services/WebSocketService';
import { DatabaseService } from '../../orchestration/src/services/DatabaseService';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

jest.setTimeout(60000);

describe('Complete Flow Execution Integration Tests', () => {
  let flowExecutor: FlowExecutor;
  let claudeManager: ClaudeCodeManager;
  let hookHandler: HookHandler;
  let wsService: WebSocketService;
  let dbService: DatabaseService;
  let testProjectPath: string;

  beforeAll(async () => {
    testProjectPath = path.join(process.cwd(), 'test-project-flow');
    await fs.mkdir(testProjectPath, { recursive: true });

    dbService = new DatabaseService();
    await dbService.initialize();

    wsService = new WebSocketService();
    hookHandler = new HookHandler();
    claudeManager = new ClaudeCodeManager();

    flowExecutor = new FlowExecutor(
      claudeManager,
      hookHandler,
      wsService,
      dbService
    );
  });

  afterAll(async () => {
    await fs.rm(testProjectPath, { recursive: true, force: true });
    await dbService.disconnect();
  });

  describe('Simple REST API Flow', () => {
    it('should execute complete flow from planning to completion', async () => {
      const flowConfig = {
        project: 'simple-rest-api',
        nodes: [
          {
            id: 'setup',
            agent: 'express-setup',
            status: 'pending',
            config: {
              port: 3000,
              cors: true,
              middleware: ['json', 'urlencoded']
            }
          },
          {
            id: 'api',
            agent: 'nodejs-backend',
            dependencies: ['setup'],
            status: 'pending',
            config: {
              routes: [
                { method: 'GET', path: '/users', handler: 'getUsers' },
                { method: 'POST', path: '/users', handler: 'createUser' },
                { method: 'GET', path: '/users/:id', handler: 'getUserById' }
              ]
            }
          },
          {
            id: 'test',
            agent: 'jest-tester',
            dependencies: ['api'],
            status: 'pending',
            config: {
              coverage: true,
              testMatch: ['**/*.test.js']
            }
          }
        ],
        edges: [
          { source: 'setup', target: 'api' },
          { source: 'api', target: 'test' }
        ]
      };

      const mockClaudeSpawn = jest.spyOn(claudeManager, 'spawnProcess').mockImplementation((args: any) => {
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => callback(0), Math.random() * 10000);
            }
          }),
          kill: jest.fn()
        } as any;

        return mockProcess;
      });

      const executionStart = Date.now();
      const execution = await flowExecutor.execute(flowConfig);

      expect(execution.status).toBe('running');
      expect(execution.nodes).toHaveLength(3);

      await new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
          const status = await flowExecutor.getStatus(execution.id);
          
          if (status.status === 'completed') {
            clearInterval(checkInterval);
            resolve(status);
          } else if (status.status === 'failed') {
            clearInterval(checkInterval);
            throw new Error(`Flow failed: ${status.error}`);
          }
        }, 1000);
      });

      const executionTime = Date.now() - executionStart;
      const finalStatus = await flowExecutor.getStatus(execution.id);

      expect(finalStatus.status).toBe('completed');
      expect(finalStatus.nodes.find(n => n.id === 'setup')?.status).toBe('completed');
      expect(finalStatus.nodes.find(n => n.id === 'api')?.status).toBe('completed');
      expect(finalStatus.nodes.find(n => n.id === 'test')?.status).toBe('completed');
      expect(executionTime).toBeLessThan(45000);

      expect(mockClaudeSpawn).toHaveBeenCalledTimes(3);
      expect(mockClaudeSpawn).toHaveBeenCalledWith(expect.objectContaining({
        agent: 'express-setup'
      }));
      expect(mockClaudeSpawn).toHaveBeenCalledWith(expect.objectContaining({
        agent: 'nodejs-backend'
      }));
      expect(mockClaudeSpawn).toHaveBeenCalledWith(expect.objectContaining({
        agent: 'jest-tester'
      }));
    });

    it('should handle hook callbacks correctly', async () => {
      const flowConfig = {
        project: 'hook-test',
        nodes: [
          {
            id: 'node1',
            agent: 'nodejs-backend',
            status: 'pending',
            hooks: {
              pre: 'echo "Starting node1"',
              post: 'echo "Completed node1"'
            }
          }
        ],
        edges: []
      };

      const hookCallbacks: string[] = [];
      const mockHookExecute = jest.spyOn(hookHandler, 'execute').mockImplementation(async (hook: string) => {
        hookCallbacks.push(hook);
        return { success: true, output: `Executed: ${hook}` };
      });

      await flowExecutor.execute(flowConfig);
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(hookCallbacks).toContain('echo "Starting node1"');
      expect(hookCallbacks).toContain('echo "Completed node1"');
      expect(mockHookExecute).toHaveBeenCalledTimes(2);
    });
  });

  describe('Parallel Execution', () => {
    it('should execute parallel branches simultaneously', async () => {
      const flowConfig = {
        project: 'parallel-test',
        nodes: [
          {
            id: 'setup',
            agent: 'express-setup',
            status: 'pending'
          },
          {
            id: 'frontend',
            agent: 'react-developer',
            dependencies: ['setup'],
            status: 'pending'
          },
          {
            id: 'backend',
            agent: 'nodejs-backend',
            dependencies: ['setup'],
            status: 'pending'
          },
          {
            id: 'database',
            agent: 'database-developer',
            dependencies: ['setup'],
            status: 'pending'
          },
          {
            id: 'integration',
            agent: 'api-integrator',
            dependencies: ['frontend', 'backend', 'database'],
            status: 'pending'
          }
        ],
        edges: [
          { source: 'setup', target: 'frontend' },
          { source: 'setup', target: 'backend' },
          { source: 'setup', target: 'database' },
          { source: 'frontend', target: 'integration' },
          { source: 'backend', target: 'integration' },
          { source: 'database', target: 'integration' }
        ]
      };

      const executionTimes: Record<string, number> = {};
      const mockClaudeSpawn = jest.spyOn(claudeManager, 'spawnProcess').mockImplementation((args: any) => {
        const startTime = Date.now();
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => {
                executionTimes[args.nodeId] = Date.now() - startTime;
                callback(0);
              }, Math.random() * 5000);
            }
          }),
          kill: jest.fn()
        } as any;

        return mockProcess;
      });

      const execution = await flowExecutor.execute(flowConfig);

      await new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
          const status = await flowExecutor.getStatus(execution.id);
          
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(checkInterval);
            resolve(status);
          }
        }, 500);
      });

      const finalStatus = await flowExecutor.getStatus(execution.id);
      expect(finalStatus.status).toBe('completed');

      const parallelNodes = ['frontend', 'backend', 'database'];
      const parallelStartTimes = parallelNodes.map(id => executionTimes[id]);
      const maxDifference = Math.max(...parallelStartTimes) - Math.min(...parallelStartTimes);
      
      expect(maxDifference).toBeLessThan(1000);

      const integrationNode = finalStatus.nodes.find(n => n.id === 'integration');
      expect(integrationNode?.status).toBe('completed');
    });

    it('should respect resource limits', async () => {
      const originalMaxConcurrent = (flowExecutor as any).maxConcurrentAgents;
      (flowExecutor as any).maxConcurrentAgents = 2;

      const flowConfig = {
        project: 'resource-limit-test',
        nodes: [
          { id: 'node1', agent: 'nodejs-backend', status: 'pending' },
          { id: 'node2', agent: 'react-developer', status: 'pending' },
          { id: 'node3', agent: 'database-developer', status: 'pending' },
          { id: 'node4', agent: 'api-integrator', status: 'pending' }
        ],
        edges: []
      };

      const concurrentExecutions: number[] = [];
      let currentlyRunning = 0;

      const mockClaudeSpawn = jest.spyOn(claudeManager, 'spawnProcess').mockImplementation((args: any) => {
        currentlyRunning++;
        concurrentExecutions.push(currentlyRunning);
        
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => {
                currentlyRunning--;
                callback(0);
              }, 1000);
            }
          }),
          kill: jest.fn()
        } as any;

        return mockProcess;
      });

      const execution = await flowExecutor.execute(flowConfig);

      await new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
          const status = await flowExecutor.getStatus(execution.id);
          
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(checkInterval);
            resolve(status);
          }
        }, 500);
      });

      expect(Math.max(...concurrentExecutions)).toBeLessThanOrEqual(2);

      (flowExecutor as any).maxConcurrentAgents = originalMaxConcurrent;
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed nodes with context', async () => {
      const flowConfig = {
        project: 'error-recovery-test',
        nodes: [
          {
            id: 'flaky-node',
            agent: 'nodejs-backend',
            status: 'pending',
            retry: {
              maxAttempts: 3,
              backoff: 1000
            }
          }
        ],
        edges: []
      };

      let attemptCount = 0;
      const mockClaudeSpawn = jest.spyOn(claudeManager, 'spawnProcess').mockImplementation((args: any) => {
        attemptCount++;
        
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => {
                if (attemptCount < 2) {
                  callback(1);
                } else {
                  callback(0);
                }
              }, 500);
            }
          }),
          kill: jest.fn()
        } as any;

        return mockProcess;
      });

      const execution = await flowExecutor.execute(flowConfig);

      await new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
          const status = await flowExecutor.getStatus(execution.id);
          
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(checkInterval);
            resolve(status);
          }
        }, 500);
      });

      const finalStatus = await flowExecutor.getStatus(execution.id);
      expect(finalStatus.status).toBe('completed');
      expect(attemptCount).toBe(2);
    });

    it('should handle manual intervention', async () => {
      const flowConfig = {
        project: 'manual-intervention-test',
        nodes: [
          {
            id: 'review-node',
            agent: 'manual-review',
            status: 'pending',
            requiresApproval: true
          },
          {
            id: 'next-node',
            agent: 'nodejs-backend',
            dependencies: ['review-node'],
            status: 'pending'
          }
        ],
        edges: [
          { source: 'review-node', target: 'next-node' }
        ]
      };

      const mockClaudeSpawn = jest.spyOn(claudeManager, 'spawnProcess').mockImplementation((args: any) => {
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'exit') {
              if (args.agent === 'manual-review') {
                setTimeout(() => callback(0), 1000);
              } else {
                setTimeout(() => callback(0), 500);
              }
            }
          }),
          kill: jest.fn()
        } as any;

        return mockProcess;
      });

      const execution = await flowExecutor.execute(flowConfig);

      await new Promise(resolve => setTimeout(resolve, 500));

      let status = await flowExecutor.getStatus(execution.id);
      const reviewNode = status.nodes.find(n => n.id === 'review-node');
      expect(reviewNode?.status).toBe('awaiting_approval');

      await flowExecutor.approveNode(execution.id, 'review-node', {
        approved: true,
        comments: 'Looks good'
      });

      await new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
          const status = await flowExecutor.getStatus(execution.id);
          
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(checkInterval);
            resolve(status);
          }
        }, 500);
      });

      const finalStatus = await flowExecutor.getStatus(execution.id);
      expect(finalStatus.status).toBe('completed');
      expect(finalStatus.nodes.find(n => n.id === 'next-node')?.status).toBe('completed');
    });

    it('should handle partial recovery', async () => {
      const flowConfig = {
        project: 'partial-recovery-test',
        nodes: [
          {
            id: 'node1',
            agent: 'nodejs-backend',
            status: 'pending'
          },
          {
            id: 'node2',
            agent: 'react-developer',
            dependencies: ['node1'],
            status: 'pending'
          },
          {
            id: 'node3',
            agent: 'database-developer',
            dependencies: ['node1'],
            status: 'pending'
          },
          {
            id: 'node4',
            agent: 'api-integrator',
            dependencies: ['node2', 'node3'],
            status: 'pending'
          }
        ],
        edges: [
          { source: 'node1', target: 'node2' },
          { source: 'node1', target: 'node3' },
          { source: 'node2', target: 'node4' },
          { source: 'node3', target: 'node4' }
        ]
      };

      const failedNodes = new Set(['node2']);
      const mockClaudeSpawn = jest.spyOn(claudeManager, 'spawnProcess').mockImplementation((args: any) => {
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'exit') {
              setTimeout(() => {
                if (failedNodes.has(args.nodeId)) {
                  callback(1);
                } else {
                  callback(0);
                }
              }, 500);
            }
          }),
          kill: jest.fn()
        } as any;

        return mockProcess;
      });

      const execution = await flowExecutor.execute(flowConfig);

      await new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
          const status = await flowExecutor.getStatus(execution.id);
          const node2Status = status.nodes.find(n => n.id === 'node2')?.status;
          
          if (node2Status === 'failed') {
            clearInterval(checkInterval);
            resolve(status);
          }
        }, 500);
      });

      let status = await flowExecutor.getStatus(execution.id);
      expect(status.nodes.find(n => n.id === 'node1')?.status).toBe('completed');
      expect(status.nodes.find(n => n.id === 'node2')?.status).toBe('failed');
      expect(status.nodes.find(n => n.id === 'node3')?.status).toBe('completed');
      expect(status.nodes.find(n => n.id === 'node4')?.status).toBe('pending');

      failedNodes.delete('node2');
      await flowExecutor.retryNode(execution.id, 'node2');

      await new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
          const status = await flowExecutor.getStatus(execution.id);
          
          if (status.status === 'completed' || status.nodes.find(n => n.id === 'node4')?.status === 'completed') {
            clearInterval(checkInterval);
            resolve(status);
          }
        }, 500);
      });

      const finalStatus = await flowExecutor.getStatus(execution.id);
      expect(finalStatus.nodes.find(n => n.id === 'node2')?.status).toBe('completed');
      expect(finalStatus.nodes.find(n => n.id === 'node4')?.status).toBe('completed');
      expect(finalStatus.status).toBe('completed');
    });
  });
});