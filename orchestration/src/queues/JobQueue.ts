import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { Flow, FlowNode, ExecutionOptions } from '../../types';
import { FlowExecutor } from '../core/FlowExecutor';
import { HookHandler } from '../hooks/HookHandler';
import { WebSocketService } from '../services/WebSocketService';

export interface FlowJob {
  flowId: string;
  flow: Flow;
  options: ExecutionOptions;
  priority?: number;
  delay?: number;
}

export interface NodeJob {
  nodeId: string;
  flowId: string;
  node: FlowNode;
  inputData?: any;
  attempt: number;
  maxAttempts: number;
}

export class JobQueueManager extends EventEmitter {
  private redis: Redis;
  private flowQueue: Queue<FlowJob>;
  private nodeQueue: Queue<NodeJob>;
  private flowWorker: Worker<FlowJob> | null = null;
  private nodeWorker: Worker<NodeJob> | null = null;
  private flowEvents: QueueEvents;
  private nodeEvents: QueueEvents;
  private executors: Map<string, FlowExecutor> = new Map();
  private hookHandler: HookHandler;
  private wsService: WebSocketService | null = null;

  constructor(
    redisConfig: {
      host: string;
      port: number;
      password?: string;
    },
    hookHandler: HookHandler
  ) {
    super();
    
    this.redis = new Redis({
      ...redisConfig,
      maxRetriesPerRequest: null
    });
    this.hookHandler = hookHandler;

    this.flowQueue = new Queue('flow-execution', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    this.nodeQueue = new Queue('node-execution', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    });

    this.flowEvents = new QueueEvents('flow-execution', {
      connection: this.redis
    });

    this.nodeEvents = new QueueEvents('node-execution', {
      connection: this.redis
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.flowEvents.on('completed', ({ jobId, returnvalue }) => {
      this.emit('flow:completed', { jobId, result: returnvalue });
    });

    this.flowEvents.on('failed', ({ jobId, failedReason }) => {
      this.emit('flow:failed', { jobId, reason: failedReason });
    });

    this.flowEvents.on('progress', ({ jobId, data }) => {
      this.emit('flow:progress', { jobId, progress: data });
    });

    this.nodeEvents.on('completed', ({ jobId, returnvalue }) => {
      this.emit('node:completed', { jobId, result: returnvalue });
    });

    this.nodeEvents.on('failed', ({ jobId, failedReason }) => {
      this.emit('node:failed', { jobId, reason: failedReason });
    });

    this.nodeEvents.on('active', ({ jobId }) => {
      this.emit('node:active', { jobId });
    });
  }

  setWebSocketService(wsService: WebSocketService): void {
    this.wsService = wsService;
  }

  async startWorkers(concurrency: number = 5): Promise<void> {
    this.flowWorker = new Worker<FlowJob>(
      'flow-execution',
      async (job) => await this.processFlowJob(job),
      {
        connection: this.redis,
        concurrency: Math.max(1, Math.floor(concurrency / 2))
      }
    );

    this.nodeWorker = new Worker<NodeJob>(
      'node-execution',
      async (job) => await this.processNodeJob(job),
      {
        connection: this.redis,
        concurrency
      }
    );

    this.flowWorker.on('completed', (job) => {
      console.log(`Flow job ${job.id} completed`);
      const executor = this.executors.get(job.data.flowId);
      if (executor) {
        this.hookHandler.unregisterExecutor(job.data.flowId);
        this.executors.delete(job.data.flowId);
      }
    });

    this.flowWorker.on('failed', (job, err) => {
      console.error(`Flow job ${job?.id} failed:`, err);
    });

    this.nodeWorker.on('completed', (job) => {
      console.log(`Node job ${job.id} completed`);
    });

    this.nodeWorker.on('failed', (job, err) => {
      console.error(`Node job ${job?.id} failed:`, err);
    });

    console.log('Queue workers started');
  }

  async stopWorkers(): Promise<void> {
    if (this.flowWorker) {
      await this.flowWorker.close();
      this.flowWorker = null;
    }

    if (this.nodeWorker) {
      await this.nodeWorker.close();
      this.nodeWorker = null;
    }

    console.log('Queue workers stopped');
  }

  async addFlowJob(flowJob: FlowJob): Promise<Job<FlowJob>> {
    const job = await this.flowQueue.add(
      `flow-${flowJob.flowId}`,
      flowJob,
      {
        priority: flowJob.priority || 0,
        delay: flowJob.delay || 0
      }
    );

    this.emit('flow:queued', { jobId: job.id, flowId: flowJob.flowId });
    return job;
  }

  async addNodeJob(nodeJob: NodeJob): Promise<Job<NodeJob>> {
    const job = await this.nodeQueue.add(
      `node-${nodeJob.nodeId}`,
      nodeJob,
      {
        priority: 10,
        attempts: nodeJob.maxAttempts
      }
    );

    this.emit('node:queued', { jobId: job.id, nodeId: nodeJob.nodeId });
    return job;
  }

  private async processFlowJob(job: Job<FlowJob>): Promise<any> {
    const { flow, options } = job.data;
    
    await job.updateProgress({ status: 'initializing', percentage: 0 });

    const executor = new FlowExecutor(flow, options);
    this.executors.set(flow.id, executor);
    this.hookHandler.registerExecutor(flow.id, executor);

    // Connect WebSocketService to FlowExecutor for real-time updates
    if (this.wsService) {
      this.wsService.attachToExecutor(executor, flow.id);
    }

    executor.on('flow:started', () => {
      job.updateProgress({ status: 'started', percentage: 10 });
    });

    executor.on('node:started', ({ nodeId }) => {
      const progress = this.calculateFlowProgress(executor);
      job.updateProgress({ 
        status: 'running', 
        node: nodeId, 
        percentage: progress 
      });
    });

    executor.on('node:completed', ({ nodeId }) => {
      const progress = this.calculateFlowProgress(executor);
      job.updateProgress({ 
        status: 'running', 
        node: nodeId, 
        percentage: progress 
      });
    });

    executor.on('node:failed', ({ nodeId, error }) => {
      job.log(`Node ${nodeId} failed: ${error.message}`);
    });

    executor.on('node:retry', ({ nodeId, attempt }) => {
      job.log(`Retrying node ${nodeId}, attempt ${attempt}`);
    });

    try {
      const result = await executor.executeFlow();
      
      await job.updateProgress({ status: 'completed', percentage: 100 });
      
      return result;
    } catch (error) {
      await job.updateProgress({ 
        status: 'failed', 
        error: (error as Error).message,
        percentage: this.calculateFlowProgress(executor)
      });
      
      throw error;
    }
  }

  private async processNodeJob(job: Job<NodeJob>): Promise<any> {
    const { node, flowId, inputData, attempt } = job.data;
    
    job.log(`Processing node ${node.id} (attempt ${attempt})`);

    try {
      const executor = this.executors.get(flowId);
      if (!executor) {
        throw new Error(`No executor found for flow ${flowId}`);
      }

      return { success: true, nodeId: node.id };
    } catch (error) {
      job.log(`Error: ${(error as Error).message}`);
      throw error;
    }
  }

  private calculateFlowProgress(executor: FlowExecutor): number {
    const state = executor.getState();
    const totalNodes = state.nodes.size;
    
    if (totalNodes === 0) return 0;

    let completedNodes = 0;
    let runningNodes = 0;
    
    state.nodes.forEach(nodeState => {
      if (nodeState.status === 'completed') {
        completedNodes++;
      } else if (nodeState.status === 'running') {
        runningNodes++;
      }
    });

    const baseProgress = (completedNodes / totalNodes) * 90;
    const runningProgress = (runningNodes / totalNodes) * 5;
    
    return Math.round(10 + baseProgress + runningProgress);
  }

  async getQueueStats(): Promise<{
    flows: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
    nodes: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
  }> {
    const [
      flowWaiting,
      flowActive,
      flowCompleted,
      flowFailed,
      nodeWaiting,
      nodeActive,
      nodeCompleted,
      nodeFailed
    ] = await Promise.all([
      this.flowQueue.getWaitingCount(),
      this.flowQueue.getActiveCount(),
      this.flowQueue.getCompletedCount(),
      this.flowQueue.getFailedCount(),
      this.nodeQueue.getWaitingCount(),
      this.nodeQueue.getActiveCount(),
      this.nodeQueue.getCompletedCount(),
      this.nodeQueue.getFailedCount()
    ]);

    return {
      flows: {
        waiting: flowWaiting,
        active: flowActive,
        completed: flowCompleted,
        failed: flowFailed
      },
      nodes: {
        waiting: nodeWaiting,
        active: nodeActive,
        completed: nodeCompleted,
        failed: nodeFailed
      }
    };
  }

  async clearQueues(): Promise<void> {
    await this.flowQueue.obliterate({ force: true });
    await this.nodeQueue.obliterate({ force: true });
  }

  async pauseQueues(): Promise<void> {
    await this.flowQueue.pause();
    await this.nodeQueue.pause();
  }

  async resumeQueues(): Promise<void> {
    await this.flowQueue.resume();
    await this.nodeQueue.resume();
  }

  async getJob(queueName: 'flow' | 'node', jobId: string): Promise<Job | undefined> {
    const queue = queueName === 'flow' ? this.flowQueue : this.nodeQueue;
    return await queue.getJob(jobId);
  }

  async retryJob(queueName: 'flow' | 'node', jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job && job.failedReason) {
      await job.retry();
    }
  }

  async removeJob(queueName: 'flow' | 'node', jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.remove();
    }
  }

  async cleanup(): Promise<void> {
    await this.stopWorkers();
    await this.flowQueue.close();
    await this.nodeQueue.close();
    await this.flowEvents.close();
    await this.nodeEvents.close();
    this.redis.disconnect();
  }
}