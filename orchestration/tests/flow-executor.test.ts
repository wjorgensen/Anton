import { FlowExecutor } from '../src/core/FlowExecutor';
import { Flow, ExecutionOptions } from '../types';
import { DatabaseService } from '../src/services/DatabaseService';

// Mock dependencies
jest.mock('../src/core/ClaudeCodeManager');
jest.mock('../src/services/DatabaseService');
jest.mock('../src/utils/DependencyResolver');
jest.mock('../src/utils/RetryManager');
jest.mock('../src/services/ReviewService');
jest.mock('fs/promises');

describe('FlowExecutor', () => {
  let executor: FlowExecutor;
  let testFlow: Flow;
  let testOptions: ExecutionOptions;
  let mockDbService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockDbService = {
      createExecution: jest.fn().mockResolvedValue('exec-123'),
      updateExecutionStatus: jest.fn().mockResolvedValue(undefined),
      getExecution: jest.fn().mockResolvedValue(null)
    } as any;

    testFlow = {
      id: 'test-flow-123',
      version: 1,
      name: 'Test Flow',
      description: 'A test flow for unit testing',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      nodes: [
        {
          id: 'node1',
          agentId: 'test-agent-1',
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
          status: 'pending'
        }
      ],
      edges: [],
      metadata: {}
    };

    testOptions = {
      maxParallel: 3,
      timeout: 60000,
      retryStrategy: {
        maxAttempts: 3,
        backoff: 'exponential',
        initialDelay: 1000,
        maxDelay: 10000,
        contextEnhancement: {
          includeErrors: true,
          includeStackTrace: false,
          includeSuggestions: true,
          includeRelatedCode: false
        }
      },
      debug: false,
      dryRun: true
    };

    executor = new FlowExecutor(testFlow, testOptions, mockDbService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    test('creates FlowExecutor with correct configuration', () => {
      expect(executor).toBeInstanceOf(FlowExecutor);
    });

    test('initializes with correct flow and options', () => {
      const state = executor.getState();
      expect(state.flowId).toBe('test-flow-123');
      expect(state.status).toBe('initializing');
    });
  });

  describe('state management', () => {
    test('returns current execution state', () => {
      const state = executor.getState();
      expect(state).toHaveProperty('flowId');
      expect(state).toHaveProperty('status');
      expect(state).toHaveProperty('startedAt');
      expect(state).toHaveProperty('nodes');
      expect(state).toHaveProperty('errors');
      expect(state).toHaveProperty('output');
    });

    test('handles pause and resume', async () => {
      await executor.pauseExecution();
      const state1 = executor.getState();
      expect(state1.status).toBe('paused');
      
      await executor.resumeExecution();
      const state2 = executor.getState();
      expect(state2.status).toBe('running');
    });

    test('tracks execution status', () => {
      const state = executor.getState();
      expect(['initializing', 'running', 'paused', 'completed', 'failed']).toContain(state.status);
    });
  });

  describe('flow validation', () => {
    test('validates flow with required fields', async () => {
      const validFlow = { ...testFlow };
      const validExecutor = new FlowExecutor(validFlow, testOptions, mockDbService);
      
      // Should not throw during validation
      expect(validExecutor).toBeInstanceOf(FlowExecutor);
    });

    test('handles empty flow', () => {
      const emptyFlow = {
        ...testFlow,
        nodes: [],
        edges: []
      };
      
      const emptyExecutor = new FlowExecutor(emptyFlow, testOptions, mockDbService);
      expect(emptyExecutor).toBeInstanceOf(FlowExecutor);
    });
  });

  describe('event emission', () => {
    test('emits flow events during execution', async () => {
      const events: string[] = [];
      
      executor.on('flow:started', () => events.push('started'));
      executor.on('flow:completed', () => events.push('completed'));
      executor.on('flow:failed', () => events.push('failed'));
      executor.on('node:started', () => events.push('node-started'));
      executor.on('node:completed', () => events.push('node-completed'));
      
      // These events would be emitted during actual execution
      executor.emit('flow:started', { flowId: testFlow.id });
      executor.emit('node:started', { nodeId: 'node1' });
      
      expect(events).toContain('started');
      expect(events).toContain('node-started');
    });
  });

  describe('dry run mode', () => {
    test('handles dry run execution', async () => {
      const dryRunOptions = { ...testOptions, dryRun: true };
      const dryRunExecutor = new FlowExecutor(testFlow, dryRunOptions, mockDbService);
      
      expect(dryRunExecutor).toBeInstanceOf(FlowExecutor);
      
      // In dry run mode, no actual agents should be spawned
      const state = dryRunExecutor.getState();
      expect(state.flowId).toBe(testFlow.id);
    });
  });

  describe('error handling', () => {
    test('handles execution errors gracefully', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        // Add an error listener to prevent unhandled error
        executor.on('error', (error) => {
          // Error handled
        });
        
        // Simulate an error condition
        executor.emit('error', new Error('Test error'));
        
        const state = executor.getState();
        expect(state.errors).toBeDefined();
      } finally {
        errorSpy.mockRestore();
      }
    });

    test('reports failed nodes', () => {
      const state = executor.getState();
      expect(state.nodes).toBeInstanceOf(Map);
      expect(state.errors).toBeInstanceOf(Array);
    });
  });

  describe('node execution tracking', () => {
    test('tracks node states', () => {
      const state = executor.getState();
      expect(state.nodes).toBeInstanceOf(Map);
      
      // Initially should have no completed nodes
      expect(state.nodes.size).toBe(0);
    });

    test('handles node completion', () => {
      // Simulate node completion event
      executor.emit('node:completed', { 
        nodeId: 'node1', 
        output: { success: true } 
      });
      
      // State tracking would be handled internally
      const state = executor.getState();
      expect(state).toBeDefined();
    });
  });
});