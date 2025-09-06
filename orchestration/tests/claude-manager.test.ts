import { ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ClaudeCodeManager } from '../src/core/ClaudeCodeManager';
import { AgentConfig, FlowNode } from '../types';

// Mock modules
jest.mock('child_process');
jest.mock('fs/promises');

describe('ClaudeCodeManager', () => {
  let manager: ClaudeCodeManager;
  let mockProcess: any;

  beforeEach(() => {
    manager = new ClaudeCodeManager('/tmp/test', 'http://localhost:3002');
    
    // Setup mock process
    mockProcess = {
      pid: 1234,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      stdin: { write: jest.fn(), end: jest.fn() },
      on: jest.fn(),
      once: jest.fn(),
      kill: jest.fn()
    };
    
    // Mock fs operations
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('spawnAgent', () => {
    test('spawns Claude Code agent with correct configuration', async () => {
      const node = {
        id: 'test-node',
        agentId: 'test-agent',
        label: 'Test Node',
        instructions: 'Test instructions',
        claudeMD: 'Test instructions',
        inputs: {},
        position: { x: 0, y: 0 },
        config: {
          retryOnFailure: true,
          maxRetries: 3,
          timeout: 30000,
          requiresReview: false
        },
        status: 'pending' as const
      };
      
      const agent = {
        id: 'test-agent',
        name: 'Test Agent',
        category: 'execution' as const,
        type: 'claude',
        version: '1.0.0',
        description: 'Test agent for unit testing',
        instructions: {
          base: 'You are a helpful AI assistant.',
          contextual: 'Complete the given task efficiently.'
        },
        claudeMD: 'Test instructions',
        inputs: [],
        outputs: [],
        hooks: {
          onStop: 'completion'
        },
        resources: {
          estimatedTime: 60,
          estimatedTokens: 1000,
          requiresGPU: false,
          maxRetries: 3
        },
        tags: ['test']
      };
      
      // Mock spawn to return our mock process
      const { spawn } = require('child_process');
      spawn.mockReturnValue(mockProcess);
      
      // Simulate process ready
      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          callback(Buffer.from('Ready for commands\n'));
        }
      });
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'spawn') {
          callback();
        }
        return mockProcess;
      });
      
      const instance = await manager.spawnAgent(node, agent, 'flow-123', { input: 'data' });
      
      expect(instance).toBeTruthy();
      expect(instance.nodeId).toBe('test-node');
      expect(instance.status).toBe('running');
      
      // Verify spawn was called
      expect(spawn).toHaveBeenCalled();
    });

    test('handles spawn errors gracefully', async () => {
      const node = {
        id: 'test-node',
        agentId: 'test-agent',
        label: 'Test Node',
        instructions: 'Test',
        claudeMD: 'Test instructions',
        inputs: {},
        position: { x: 0, y: 0 },
        config: {
          retryOnFailure: false,
          maxRetries: 0,
          timeout: 30000,
          requiresReview: false
        },
        status: 'pending' as const
      };
      
      const agent = {
        id: 'test-agent',
        name: 'Test Agent',
        category: 'execution' as const,
        type: 'claude',
        version: '1.0.0',
        description: 'Test agent for unit testing',
        instructions: {
          base: 'You are a helpful AI assistant.',
          contextual: 'Complete the given task efficiently.'
        },
        claudeMD: 'Test instructions',
        inputs: [],
        outputs: [],
        hooks: {
          onStop: 'completion'
        },
        resources: {
          estimatedTime: 60,
          estimatedTokens: 1000,
          requiresGPU: false,
          maxRetries: 3
        },
        tags: ['test']
      };
      
      // Simulate spawn error by making spawn itself throw
      const { spawn } = require('child_process');
      spawn.mockImplementation(() => {
        throw new Error('Failed to spawn process');
      });
      
      await expect(manager.spawnAgent(node, agent, 'flow-123'))
        .rejects.toThrow();
    });
  });

  describe('project setup', () => {
    test('creates project directory structure', async () => {
      const projectDir = '/tmp/test/flow-123/node-1';
      const node = {
        id: 'node-1',
        agentId: 'test-agent',
        label: 'Test Node 1',
        instructions: 'Test instructions',
        claudeMD: 'Test instructions',
        inputs: {},
        position: { x: 0, y: 0 },
        config: {
          retryOnFailure: false,
          maxRetries: 0,
          timeout: 30000,
          requiresReview: false
        },
        status: 'pending' as const
      };
      const agent = {
        id: 'test-agent',
        name: 'Test Agent',
        category: 'execution' as const,
        type: 'claude',
        version: '1.0.0',
        description: 'Test agent for unit testing',
        instructions: {
          base: 'You are a helpful AI assistant.',
          contextual: 'Complete the given task efficiently.'
        },
        claudeMD: 'Test instructions',
        inputs: [],
        outputs: [],
        hooks: {
          onStop: 'completion'
        },
        resources: {
          estimatedTime: 60,
          estimatedTokens: 1000,
          requiresGPU: false,
          maxRetries: 3
        },
        tags: ['test']
      };
      
      // Call internal method (would normally be private)
      await (manager as any).setupProjectDirectory(projectDir, node, agent, { test: 'data' });
      
      // Verify directories were created
      expect(fs.mkdir).toHaveBeenCalledWith(
        projectDir,
        { recursive: true }
      );
      
      // Verify instructions file was written - the actual implementation writes 3 files
      expect(fs.writeFile).toHaveBeenCalledTimes(3);
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(projectDir, 'instructions.md'),
        expect.any(String),
        'utf-8'
      );
      
      // Check that the base instruction is part of the content
      const instructionsCall = (fs.writeFile as jest.Mock).mock.calls.find(call =>
        call[0].includes('instructions.md')
      );
      expect(instructionsCall[1]).toContain('Test instructions');
    });
  });

  describe('hook configuration', () => {
    test('configures hooks with correct endpoints', async () => {
      const projectDir = '/tmp/test/flow-123/node-1';
      
      await (manager as any).configureHooks(projectDir, 'node-1');
      
      // Verify hooks config was written (implementation writes 4 files total)
      expect(fs.writeFile).toHaveBeenCalledTimes(4);
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(projectDir, '.claude', 'hooks.json'),
        expect.any(String),
        'utf-8'
      );
      
      // Check that hooks config contains expected content
      const hooksCall = (fs.writeFile as jest.Mock).mock.calls.find(call =>
        call[0].includes('hooks.json')
      );
      expect(hooksCall[1]).toContain('"Stop"');
      
      // The URL is in the shell scripts, not the JSON config
      const stopScriptCall = (fs.writeFile as jest.Mock).mock.calls.find(call =>
        call[0].includes('stop.sh')
      );
      expect(stopScriptCall[1]).toContain('http://localhost:3002');
    });
  });

  describe('instance management', () => {
    test('tracks and manages multiple instances', async () => {
      // Setup for successful spawning
      const { spawn } = require('child_process');
      spawn.mockReturnValue(mockProcess);
      
      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('Ready\n')), 0);
        }
      });
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'spawn') {
          setTimeout(() => callback(), 0);
        }
        return mockProcess;
      });
      
      const node1 = {
        id: 'node1',
        agentId: 'test-agent',
        label: 'Node 1',
        instructions: 'Task 1',
        claudeMD: 'Task 1 instructions',
        inputs: {},
        position: { x: 0, y: 0 },
        config: {
          retryOnFailure: false,
          maxRetries: 0,
          timeout: 30000,
          requiresReview: false
        },
        status: 'pending' as const
      };
      
      const node2 = {
        id: 'node2',
        agentId: 'test-agent',
        label: 'Node 2',
        instructions: 'Task 2',
        claudeMD: 'Task 2 instructions',
        inputs: {},
        position: { x: 100, y: 0 },
        config: {
          retryOnFailure: false,
          maxRetries: 0,
          timeout: 30000,
          requiresReview: false
        },
        status: 'pending' as const
      };
      
      const agent = {
        id: 'test-agent',
        name: 'Test Agent',
        category: 'execution' as const,
        type: 'claude',
        version: '1.0.0',
        description: 'Test agent for unit testing',
        instructions: {
          base: 'You are a helpful AI assistant.',
          contextual: 'Complete the given task efficiently.'
        },
        claudeMD: 'Test instructions',
        inputs: [],
        outputs: [],
        hooks: {
          onStop: 'completion'
        },
        resources: {
          estimatedTime: 60,
          estimatedTokens: 1000,
          requiresGPU: false,
          maxRetries: 3
        },
        tags: ['test']
      };
      
      const instance1 = await manager.spawnAgent(node1, agent, 'flow-123');
      const instance2 = await manager.spawnAgent(node2, agent, 'flow-123');
      
      expect(instance1.nodeId).toBe('node1');
      expect(instance2.nodeId).toBe('node2');
      
      // Get instances
      const allInstances = manager.getAllInstances();
      expect(allInstances.length).toBe(2);
    });

    test('terminates instance by ID', async () => {
      const { spawn } = require('child_process');
      spawn.mockReturnValue(mockProcess);
      
      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback(Buffer.from('Ready\n'));
      });
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'spawn') callback();
        return mockProcess;
      });
      
      // Mock once to immediately call the callback for graceful shutdown
      mockProcess.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'exit') {
          setTimeout(() => callback(0), 10); // Simulate quick exit
        }
        return mockProcess;
      });
      
      const node = {
        id: 'test-node',
        agentId: 'test-agent',
        label: 'Test Node',
        instructions: 'Test',
        claudeMD: 'Test instructions',
        inputs: {},
        position: { x: 0, y: 0 },
        config: {
          retryOnFailure: false,
          maxRetries: 0,
          timeout: 30000,
          requiresReview: false
        },
        status: 'pending' as const
      };
      
      const agent = {
        id: 'test-agent',
        name: 'Test Agent',
        category: 'execution' as const,
        type: 'claude',
        version: '1.0.0',
        description: 'Test agent for unit testing',
        instructions: {
          base: 'You are a helpful AI assistant.',
          contextual: 'Complete the given task efficiently.'
        },
        claudeMD: 'Test instructions',
        inputs: [],
        outputs: [],
        hooks: {
          onStop: 'completion'
        },
        resources: {
          estimatedTime: 60,
          estimatedTokens: 1000,
          requiresGPU: false,
          maxRetries: 3
        },
        tags: ['test']
      };
      
      const instance = await manager.spawnAgent(node, agent, 'flow-123');
      
      await manager.stopAgent(instance.id);
      
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    test('terminates all instances', async () => {
      const { spawn } = require('child_process');
      const mockProcess2 = {
        pid: 5678,
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        stdin: { write: jest.fn(), end: jest.fn() },
        on: jest.fn((event: string, callback: Function) => {
          if (event === 'spawn') callback();
          return mockProcess2;
        }),
        once: jest.fn(),
        kill: jest.fn()
      };
      
      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback(Buffer.from('Ready\n'));
      });
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'spawn') callback();
        return mockProcess;
      });
      mockProcess.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'exit') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });
      
      mockProcess2.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') callback(Buffer.from('Ready\n'));
      });
      mockProcess2.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'exit') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess2;
      });
      
      spawn.mockReturnValueOnce(mockProcess).mockReturnValueOnce(mockProcess2);
      
      const node1 = {
        id: 'node1',
        agentId: 'test-agent',
        label: 'Node 1',
        instructions: 'Task 1',
        claudeMD: 'Task 1 instructions',
        inputs: {},
        position: { x: 0, y: 0 },
        config: {
          retryOnFailure: false,
          maxRetries: 0,
          timeout: 30000,
          requiresReview: false
        },
        status: 'pending' as const
      };
      const node2 = {
        id: 'node2',
        agentId: 'test-agent',
        label: 'Node 2',
        instructions: 'Task 2',
        claudeMD: 'Task 2 instructions',
        inputs: {},
        position: { x: 100, y: 0 },
        config: {
          retryOnFailure: false,
          maxRetries: 0,
          timeout: 30000,
          requiresReview: false
        },
        status: 'pending' as const
      };
      
      const agent = {
        id: 'test-agent',
        name: 'Test Agent',
        category: 'execution' as const,
        type: 'claude',
        version: '1.0.0',
        description: 'Test agent for unit testing',
        instructions: {
          base: 'You are a helpful AI assistant.',
          contextual: 'Complete the given task efficiently.'
        },
        claudeMD: 'Test instructions',
        inputs: [],
        outputs: [],
        hooks: {
          onStop: 'completion'
        },
        resources: {
          estimatedTime: 60,
          estimatedTokens: 1000,
          requiresGPU: false,
          maxRetries: 3
        },
        tags: ['test']
      };
      
      await manager.spawnAgent(node1, agent, 'flow-123');
      await manager.spawnAgent(node2, agent, 'flow-123');
      
      await manager.stopAllAgents();
      
      expect(mockProcess.kill).toHaveBeenCalled();
      expect(mockProcess2.kill).toHaveBeenCalled();
      
      // Check that instances are stopped (not necessarily removed from map)
      const instances = manager.getAllInstances();
      expect(instances.every(i => i.status === 'stopped')).toBe(true);
    });
  });

  describe('output handling', () => {
    let stdoutHandler: Function, stderrHandler: Function;

    beforeEach(async () => {
      const { spawn } = require('child_process');
      spawn.mockReturnValue(mockProcess);
      
      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          stdoutHandler = callback;
          callback(Buffer.from('Ready\n'));
        }
      });
      mockProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          stderrHandler = callback;
        }
      });
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'spawn') callback();
        return mockProcess;
      });
    });

    test('collects instance output', async () => {
      const node = {
        id: 'test-node',
        agentId: 'test-agent',
        label: 'Test Node',
        instructions: 'Test',
        claudeMD: 'Test instructions',
        inputs: {},
        position: { x: 0, y: 0 },
        config: {
          retryOnFailure: false,
          maxRetries: 0,
          timeout: 30000,
          requiresReview: false
        },
        status: 'pending' as const
      };
      
      const agent = {
        id: 'test-agent',
        name: 'Test Agent',
        category: 'execution' as const,
        type: 'claude',
        version: '1.0.0',
        description: 'Test agent for unit testing',
        instructions: {
          base: 'You are a helpful AI assistant.',
          contextual: 'Complete the given task efficiently.'
        },
        claudeMD: 'Test instructions',
        inputs: [],
        outputs: [],
        hooks: {
          onStop: 'completion'
        },
        resources: {
          estimatedTime: 60,
          estimatedTokens: 1000,
          requiresGPU: false,
          maxRetries: 3
        },
        tags: ['test']
      };
      
      const instance = await manager.spawnAgent(node, agent, 'flow-123');
      
      // Simulate output
      stdoutHandler(Buffer.from('Test stdout\n'));
      stderrHandler(Buffer.from('Test stderr\n'));
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updatedInstance = manager.getInstance(instance.id);
      expect(updatedInstance?.logs).toContainEqual(
        expect.stringContaining('Test stdout')
      );
    });
  });

  describe('process lifecycle', () => {
    test('handles process exit', async () => {
      let exitHandler: Function;
      const { spawn } = require('child_process');
      spawn.mockReturnValue(mockProcess);
      
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'exit') {
          exitHandler = callback;
        } else if (event === 'spawn') {
          callback();
        }
        return mockProcess;
      });
      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          callback(Buffer.from('Ready\n'));
        }
      });
      
      const node = {
        id: 'test-node',
        agentId: 'test-agent',
        label: 'Test Node',
        instructions: 'Test',
        claudeMD: 'Test instructions',
        inputs: {},
        position: { x: 0, y: 0 },
        config: {
          retryOnFailure: false,
          maxRetries: 0,
          timeout: 30000,
          requiresReview: false
        },
        status: 'pending' as const
      };
      
      const agent = {
        id: 'test-agent',
        name: 'Test Agent',
        category: 'execution' as const,
        type: 'claude',
        version: '1.0.0',
        description: 'Test agent for unit testing',
        instructions: {
          base: 'You are a helpful AI assistant.',
          contextual: 'Complete the given task efficiently.'
        },
        claudeMD: 'Test instructions',
        inputs: [],
        outputs: [],
        hooks: {
          onStop: 'completion'
        },
        resources: {
          estimatedTime: 60,
          estimatedTokens: 1000,
          requiresGPU: false,
          maxRetries: 3
        },
        tags: ['test']
      };
      
      const instance = await manager.spawnAgent(node, agent, 'flow-123');
      
      expect(manager.getInstance(instance.id)).toBeTruthy();
      
      // Simulate process exit
      exitHandler!(0, null);
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updatedInstance = manager.getInstance(instance.id);
      expect(updatedInstance?.status).toBe('stopped');
    });
  });
});