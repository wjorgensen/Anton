import { HookHandler } from '../src/hooks/HookHandler';
import { PrismaClient } from '../src/generated/prisma';
import { FlowExecutor } from '../src/core/FlowExecutor';
import { EventEmitter } from 'events';

// Mock Prisma
jest.mock('../src/generated/prisma');

describe('HookHandler', () => {
  let handler: HookHandler;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockExecutor: jest.Mocked<FlowExecutor>;

  beforeEach(() => {
    mockPrisma = {
      nodeExecution: {
        createMany: jest.fn().mockResolvedValue(undefined),
        findFirst: jest.fn().mockResolvedValue({ id: 'test-execution-id' }),
        update: jest.fn().mockResolvedValue(undefined),
      }
    } as any;
    
    mockExecutor = {
      handleHookEvent: jest.fn().mockResolvedValue(undefined),
      getState: jest.fn().mockReturnValue({
        nodes: new Map([['test-node', {}]])
      }),
      emit: jest.fn()
    } as any;
    
    handler = new HookHandler(mockPrisma);
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('executor registration', () => {
    test('registers executor successfully', () => {
      handler.registerExecutor('flow-123', mockExecutor);
      
      expect(mockExecutor.getState).toHaveBeenCalled();
    });

    test('unregisters executor successfully', () => {
      handler.registerExecutor('flow-123', mockExecutor);
      handler.unregisterExecutor('flow-123');
      
      // Should not throw
    });
  });

  describe('execution registration', () => {
    test('registers execution with node IDs', async () => {
      const executionId = 'exec-123';
      const nodeIds = ['node1', 'node2'];
      const agentTypes = { 'node1': 'setup', 'node2': 'test' };
      
      await handler.registerExecution(executionId, nodeIds, agentTypes);
      
      expect(mockPrisma.nodeExecution.createMany).toHaveBeenCalledWith({
        data: [
          {
            executionId: 'exec-123',
            nodeId: 'node1',
            agentType: 'setup',
            status: 'pending'
          },
          {
            executionId: 'exec-123',
            nodeId: 'node2',
            agentType: 'test',
            status: 'pending'
          }
        ]
      });
    });
  });

  describe('HTTP endpoints', () => {
    test('handles stop hook successfully', async () => {
      const mockReq = {
        body: {
          nodeId: 'test-node',
          status: 'success',
          output: { message: 'Task completed' },
          timestamp: Date.now()
        }
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      handler.registerExecutor('flow-123', mockExecutor);
      
      await (handler as any).handleStopHook(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    test('handles file change hook successfully', async () => {
      const mockReq = {
        body: {
          nodeId: 'test-node',
          files: ['file1.js', 'file2.js'],
          timestamp: Date.now()
        }
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      await (handler as any).handleFileChange(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    test('handles error hook successfully', async () => {
      const mockReq = {
        body: {
          nodeId: 'test-node',
          error: 'Something went wrong',
          timestamp: Date.now()
        }
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      await (handler as any).handleError(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('router access', () => {
    test('provides router instance', () => {
      const router = handler.getRouter();
      expect(router).toBeTruthy();
    });
  });

  describe('history management', () => {
    test('clears hook history', () => {
      handler.clearHistory();
      // Should not throw
    });
  });

  describe('statistics', () => {
    test('returns handler statistics', () => {
      const stats = handler.getStats();
      
      expect(stats).toEqual({
        activeFlows: 0,
        totalNodes: 0,
        hookEvents: 0
      });
    });

    test('returns updated statistics after registration', () => {
      handler.registerExecutor('flow-123', mockExecutor);
      
      const stats = handler.getStats();
      expect(stats.activeFlows).toBe(1);
    });
  });

  describe('event emission', () => {
    test('emits events on hook processing', async () => {
      let emittedEvent: any = null;
      handler.on('hook:stop', (event) => {
        emittedEvent = event;
      });
      
      const mockReq = {
        body: {
          nodeId: 'test-node',
          status: 'success',
          output: { message: 'Task completed' },
          timestamp: Date.now()
        }
      } as any;
      
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      
      await (handler as any).handleStopHook(mockReq, mockRes);
      
      expect(emittedEvent).toBeTruthy();
      expect(emittedEvent.nodeId).toBe('test-node');
    });
  });
});