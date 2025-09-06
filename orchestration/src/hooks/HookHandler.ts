import express, { Request, Response, Router } from 'express';
import { EventEmitter } from 'events';
import { HookEvent } from '../../types';
import { FlowExecutor } from '../core/FlowExecutor';
import { WebSocketService } from '../services/WebSocketService';
import { PrismaClient } from '../generated/prisma';

interface StopHookPayload {
  nodeId: string;
  status: string;
  output: any;
  timestamp: number;
}

interface FileChangePayload {
  nodeId: string;
  files: string[];
  timestamp: number;
}

interface ErrorPayload {
  nodeId: string;
  error: string;
  timestamp: number;
}

interface CheckpointPayload {
  nodeId: string;
  name: string;
  data: any;
  timestamp: number;
}

export class HookHandler extends EventEmitter {
  private router: Router;
  private executors: Map<string, FlowExecutor> = new Map();
  private nodeFlowMap: Map<string, string> = new Map();
  private nodeExecutionMap: Map<string, string> = new Map();
  private hookHistory: HookEvent[] = [];
  private maxHistorySize: number = 1000;
  private wsService: WebSocketService | null = null;
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    super();
    this.router = express.Router();
    this.prisma = prisma || new PrismaClient();
    this.setupRoutes();
  }

  setWebSocketService(wsService: WebSocketService): void {
    this.wsService = wsService;
  }

  private setupRoutes(): void {
    this.router.use(express.json({ limit: '50mb' }));

    this.router.post('/api/agent-complete', this.handleStopHook.bind(this));
    
    this.router.post('/api/file-changed', this.handleFileChange.bind(this));
    
    this.router.post('/api/agent-error', this.handleError.bind(this));
    
    this.router.post('/api/checkpoint', this.handleCheckpoint.bind(this));
    
    this.router.post('/api/subagent-complete', this.handleSubagentComplete.bind(this));
    
    this.router.get('/api/hook-history/:nodeId', this.getHookHistory.bind(this));
    
    this.router.get('/api/status/:flowId', this.getFlowStatus.bind(this));
    
    this.router.post('/api/review/:nodeId', this.handleReviewResponse.bind(this));
  }

  registerExecutor(flowId: string, executor: FlowExecutor): void {
    this.executors.set(flowId, executor);
    
    const flow = executor.getState();
    flow.nodes.forEach((_, nodeId) => {
      this.nodeFlowMap.set(nodeId, flowId);
    });
  }

  async registerExecution(executionId: string, nodeIds: string[], agentTypes: { [nodeId: string]: string }): Promise<void> {
    nodeIds.forEach(nodeId => {
      this.nodeExecutionMap.set(nodeId, executionId);
    });

    // Create node execution records in database
    try {
      const nodeExecutionData = nodeIds.map(nodeId => ({
        executionId,
        nodeId,
        agentType: agentTypes[nodeId] || 'unknown',
        status: 'pending',
      }));

      await this.prisma.nodeExecution.createMany({
        data: nodeExecutionData,
      });
    } catch (error) {
      console.error('Error creating node execution records:', error);
    }
  }

  unregisterExecutor(flowId: string): void {
    const executor = this.executors.get(flowId);
    if (executor) {
      const flow = executor.getState();
      flow.nodes.forEach((_, nodeId) => {
        this.nodeFlowMap.delete(nodeId);
        this.nodeExecutionMap.delete(nodeId);
      });
      this.executors.delete(flowId);
    }
  }

  private async handleStopHook(req: Request, res: Response): Promise<void> {
    try {
      const payload: StopHookPayload = req.body;
      
      const validation = await this.validateOutput(payload.nodeId, payload.output);
      if (!validation.valid) {
        res.status(400).json({ 
          error: 'Invalid output', 
          details: validation.errors 
        });
        return;
      }

      await this.updateNodeStatus(payload.nodeId, {
        status: 'completed',
        output: payload.output,
        completedAt: new Date()
      });

      const hookEvent: HookEvent = {
        event: 'stop',
        nodeId: payload.nodeId,
        agentId: await this.getAgentId(payload.nodeId),
        timestamp: payload.timestamp,
        status: {
          code: 200,
          message: payload.status
        },
        output: {
          data: payload.output,
          logs: [],
          metrics: {
            duration: 0,
            tokensUsed: 0,
            filesModified: []
          }
        },
        next: {
          action: 'continue'
        }
      };

      this.addToHistory(hookEvent);
      
      const flowId = this.nodeFlowMap.get(payload.nodeId);
      const executionId = this.nodeExecutionMap.get(payload.nodeId) || flowId;
      const executor = flowId ? this.executors.get(flowId) : null;
      
      if (executor) {
        await executor.handleHookEvent(hookEvent);
      }

      if (this.wsService && executionId) {
        this.wsService.emitNodeUpdate(executionId, payload.nodeId, {
          status: 'completed',
          output: payload.output,
          timestamp: payload.timestamp
        });
        
        if (payload.output) {
          this.wsService.emitPreviewData(executionId, payload.nodeId, {
            type: 'terminal',
            data: payload.output
          });
        }
      }

      const dependents = await this.getDependentNodes(payload.nodeId);
      for (const node of dependents) {
        if (await this.canExecute(node)) {
          await this.spawnAgent(node, payload.output);
        }
      }

      if (await this.requiresReview(payload.nodeId)) {
        await this.pauseForReview(payload.nodeId);
      }

      res.status(200).json({ success: true });
      
      this.emit('hook:stop', hookEvent);
      
    } catch (error) {
      console.error('Error handling stop hook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleFileChange(req: Request, res: Response): Promise<void> {
    try {
      const payload: FileChangePayload = req.body;

      this.emit('hook:fileChange', {
        nodeId: payload.nodeId,
        files: payload.files,
        timestamp: payload.timestamp
      });

      const flowId = this.nodeFlowMap.get(payload.nodeId);
      const executionId = this.nodeExecutionMap.get(payload.nodeId) || flowId;
      
      if (flowId) {
        this.emit(`flow:${flowId}:fileChange`, {
          nodeId: payload.nodeId,
          files: payload.files
        });
      }

      if (this.wsService && executionId) {
        this.wsService.emitPreviewData(executionId, payload.nodeId, {
          type: 'file',
          data: { files: payload.files }
        });
      }

      res.status(200).json({ success: true });
      
    } catch (error) {
      console.error('Error handling file change:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleError(req: Request, res: Response): Promise<void> {
    try {
      const payload: ErrorPayload = req.body;

      const hookEvent: HookEvent = {
        event: 'error',
        nodeId: payload.nodeId,
        agentId: await this.getAgentId(payload.nodeId),
        timestamp: payload.timestamp,
        status: {
          code: 500,
          message: payload.error
        },
        output: {
          data: {},
          logs: [payload.error],
          metrics: {
            duration: 0,
            tokensUsed: 0,
            filesModified: []
          }
        },
        next: {
          action: 'retry'
        }
      };

      this.addToHistory(hookEvent);

      const flowId = this.nodeFlowMap.get(payload.nodeId);
      const executor = flowId ? this.executors.get(flowId) : null;
      
      if (executor) {
        await executor.handleHookEvent(hookEvent);
      }

      this.emit('hook:error', hookEvent);

      res.status(200).json({ success: true });
      
    } catch (error) {
      console.error('Error handling error hook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleCheckpoint(req: Request, res: Response): Promise<void> {
    try {
      const payload: CheckpointPayload = req.body;

      const hookEvent: HookEvent = {
        event: 'checkpoint',
        nodeId: payload.nodeId,
        agentId: await this.getAgentId(payload.nodeId),
        timestamp: payload.timestamp,
        status: {
          code: 200,
          message: `Checkpoint: ${payload.name}`
        },
        output: {
          data: payload.data,
          logs: [],
          metrics: {
            duration: 0,
            tokensUsed: 0,
            filesModified: []
          }
        },
        next: {
          action: 'continue'
        }
      };

      this.addToHistory(hookEvent);

      this.emit('hook:checkpoint', {
        nodeId: payload.nodeId,
        name: payload.name,
        data: payload.data
      });

      res.status(200).json({ success: true });
      
    } catch (error) {
      console.error('Error handling checkpoint:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleSubagentComplete(req: Request, res: Response): Promise<void> {
    try {
      const { parentNodeId, subagentId, output } = req.body;

      this.emit('hook:subagentComplete', {
        parentNodeId,
        subagentId,
        output
      });

      res.status(200).json({ success: true });
      
    } catch (error) {
      console.error('Error handling subagent complete:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleReviewResponse(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const { action, feedback, modifications } = req.body;

      const flowId = this.nodeFlowMap.get(nodeId);
      const executor = flowId ? this.executors.get(flowId) : null;

      if (executor) {
        executor.emit(`review:${nodeId}:complete`, {
          action,
          feedback,
          modifications
        });
      }

      this.emit('hook:reviewComplete', {
        nodeId,
        action,
        feedback,
        modifications
      });

      res.status(200).json({ success: true });
      
    } catch (error) {
      console.error('Error handling review response:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private getHookHistory(req: Request, res: Response): void {
    const { nodeId } = req.params;
    const history = this.hookHistory.filter(event => event.nodeId === nodeId);
    res.json(history);
  }

  private getFlowStatus(req: Request, res: Response): void {
    const { flowId } = req.params;
    const executor = this.executors.get(flowId);
    
    if (executor) {
      res.json(executor.getState());
    } else {
      res.status(404).json({ error: 'Flow not found' });
    }
  }

  private async validateOutput(nodeId: string, output: any): Promise<{ valid: boolean; errors?: string[] }> {
    if (typeof output !== 'object' || output === null) {
      return { valid: false, errors: ['Output must be an object'] };
    }

    return { valid: true };
  }

  private async updateNodeStatus(nodeId: string, update: any): Promise<void> {
    try {
      const executionId = this.nodeExecutionMap.get(nodeId);
      if (executionId) {
        // Update database
        const nodeExecution = await this.prisma.nodeExecution.findFirst({
          where: {
            executionId,
            nodeId,
          },
        });

        if (nodeExecution) {
          await this.prisma.nodeExecution.update({
            where: { id: nodeExecution.id },
            data: {
              status: update.status,
              output: update.output,
              completedAt: update.completedAt,
            },
          });
        }
      }

      // Emit event for real-time updates
      const flowId = this.nodeFlowMap.get(nodeId);
      if (flowId) {
        this.emit(`flow:${flowId}:nodeUpdate`, { nodeId, update });
      }
    } catch (error) {
      console.error('Error updating node status in database:', error);
      // Still emit event for real-time updates even if DB update fails
      const flowId = this.nodeFlowMap.get(nodeId);
      if (flowId) {
        this.emit(`flow:${flowId}:nodeUpdate`, { nodeId, update });
      }
    }
  }

  private async getDependentNodes(nodeId: string): Promise<string[]> {
    const flowId = this.nodeFlowMap.get(nodeId);
    if (!flowId) return [];

    const executor = this.executors.get(flowId);
    if (!executor) return [];

    return [];
  }

  private async canExecute(nodeId: string): Promise<boolean> {
    return true;
  }

  private async spawnAgent(nodeId: string, inputData: any): Promise<void> {
    const flowId = this.nodeFlowMap.get(nodeId);
    if (!flowId) return;

    const executor = this.executors.get(flowId);
    if (executor) {
      this.emit(`flow:${flowId}:spawnAgent`, { nodeId, inputData });
    }
  }

  private async requiresReview(nodeId: string): Promise<boolean> {
    return false;
  }

  private async pauseForReview(nodeId: string): Promise<void> {
    const flowId = this.nodeFlowMap.get(nodeId);
    if (flowId) {
      this.emit(`flow:${flowId}:pauseForReview`, { nodeId });
    }
  }

  private async getAgentId(nodeId: string): Promise<string> {
    return 'unknown';
  }

  private addToHistory(event: HookEvent): void {
    this.hookHistory.push(event);
    
    if (this.hookHistory.length > this.maxHistorySize) {
      this.hookHistory.shift();
    }
  }

  getRouter(): Router {
    return this.router;
  }

  clearHistory(): void {
    this.hookHistory = [];
  }

  getStats(): {
    activeFlows: number;
    totalNodes: number;
    hookEvents: number;
  } {
    return {
      activeFlows: this.executors.size,
      totalNodes: this.nodeFlowMap.size,
      hookEvents: this.hookHistory.length
    };
  }
}