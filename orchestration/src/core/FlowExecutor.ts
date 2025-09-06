import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  Flow,
  FlowNode,
  ExecutionState,
  NodeExecutionState,
  ExecutionOptions,
  ExecutionResult,
  AgentConfig,
  HookEvent
} from '../../types';
import { ClaudeCodeManager } from './ClaudeCodeManager';
import { DependencyResolver } from '../utils/DependencyResolver';
import { RetryManager } from '../utils/RetryManager';
import { ReviewService, ReviewRequest, ReviewResult } from '../services/ReviewService';
import { DatabaseService } from '../services/DatabaseService';

export class FlowExecutor extends EventEmitter {
  private claudeManager: ClaudeCodeManager;
  private state: ExecutionState;
  private flow: Flow;
  private options: ExecutionOptions;
  private dependencyResolver: DependencyResolver;
  private retryManager: RetryManager;
  private reviewService: ReviewService;
  private runningNodes: Set<string> = new Set();
  private completedNodes: Set<string> = new Set();
  private nodeOutputs: Map<string, any> = new Map();
  private agentLibrary: Map<string, AgentConfig> = new Map();
  private pausedNodes: Set<string> = new Set();
  private dbService: DatabaseService;
  private executionId: string | null = null;

  constructor(
    flow: Flow,
    options: ExecutionOptions,
    dbService?: DatabaseService,
    agentLibraryPath: string = './agents/library'
  ) {
    super();
    this.flow = flow;
    this.options = options;
    this.claudeManager = new ClaudeCodeManager();
    this.dependencyResolver = new DependencyResolver(flow);
    this.retryManager = new RetryManager(options.retryStrategy);
    this.reviewService = new ReviewService();
    this.dbService = dbService || new DatabaseService();
    
    this.state = {
      flowId: flow.id,
      status: 'initializing',
      startedAt: new Date(),
      nodes: new Map(),
      errors: [],
      output: {}
    };

    this.setupEventListeners();
    this.setupReviewListeners();
  }

  async loadAgentLibrary(libraryPath: string): Promise<void> {
    const categories = await fs.readdir(libraryPath);
    
    for (const category of categories) {
      const categoryPath = path.join(libraryPath, category);
      const stat = await fs.stat(categoryPath);
      
      if (stat.isDirectory()) {
        const files = await fs.readdir(categoryPath);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const agentPath = path.join(categoryPath, file);
            const agentConfig = JSON.parse(await fs.readFile(agentPath, 'utf-8'));
            this.agentLibrary.set(agentConfig.id, agentConfig);
          }
        }
      }
    }
  }

  async executeFlow(): Promise<ExecutionResult> {
    try {
      await this.validateFlow();
      
      await this.loadAgentLibrary(this.options.dryRun ? '' : './agents/library');
      
      this.state.status = 'running';
      this.emit('flow:started', { flowId: this.flow.id });

      const executionPlan = this.dependencyResolver.createExecutionPlan();
      
      for (const layer of executionPlan) {
        await this.executeLayer(layer);
      }

      await this.waitForCompletion();

      this.state.status = 'completed';
      this.state.completedAt = new Date();
      
      return this.buildExecutionResult();
    } catch (error) {
      this.state.status = 'failed';
      this.state.errors.push(error as Error);
      this.emit('flow:failed', { flowId: this.flow.id, error });
      
      await this.claudeManager.stopAllAgents();
      
      throw error;
    }
  }

  private async validateFlow(): Promise<void> {
    for (const node of this.flow.nodes) {
      const nodeState: NodeExecutionState = {
        nodeId: node.id,
        status: 'pending',
        attempts: 0
      };
      this.state.nodes.set(node.id, nodeState);
    }
    
    const hasCycles = this.dependencyResolver.hasCycles();
    if (hasCycles) {
      throw new Error('Flow contains circular dependencies');
    }

    const orphans = this.dependencyResolver.findOrphanNodes();
    if (orphans.length > 0) {
      console.warn(`Found orphan nodes: ${orphans.join(', ')}`);
    }
  }

  private async executeLayer(nodeIds: string[]): Promise<void> {
    while (this.runningNodes.size >= this.options.maxParallel) {
      await this.waitForSlot();
    }

    const promises = nodeIds.map(nodeId => this.executeNode(nodeId));
    await Promise.all(promises);
  }

  private async executeNode(nodeId: string): Promise<void> {
    const node = this.flow.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found in flow`);
    }

    const nodeState = this.state.nodes.get(nodeId)!;
    
    if (!(await this.checkDependencies(nodeId))) {
      return;
    }

    try {
      this.runningNodes.add(nodeId);
      nodeState.status = 'running';
      nodeState.startedAt = new Date();
      nodeState.attempts++;
      
      this.emit('node:started', { nodeId, attempt: nodeState.attempts });

      const inputData = this.gatherInputData(node);
      
      const agent = this.agentLibrary.get(node.agentId);
      if (!agent) {
        throw new Error(`Agent ${node.agentId} not found in library`);
      }

      const instance = await this.claudeManager.spawnAgent(
        node,
        agent,
        this.flow.id,
        inputData
      );
      
      nodeState.instanceId = instance.id;

      const timeout = node.config.timeout || this.options.timeout;
      const output = await this.waitForNodeCompletion(nodeId, timeout);
      
      this.nodeOutputs.set(nodeId, output);
      nodeState.output = output;
      nodeState.status = 'completed';
      nodeState.completedAt = new Date();
      
      this.runningNodes.delete(nodeId);
      this.completedNodes.add(nodeId);
      
      this.emit('node:completed', { nodeId, output });

      if (node.config.requiresReview) {
        await this.handleReview(nodeId);
      }

      await this.triggerDependentNodes(nodeId);
      
    } catch (error) {
      this.runningNodes.delete(nodeId);
      nodeState.status = 'failed';
      nodeState.lastError = error as Error;
      
      this.emit('node:failed', { nodeId, error, attempt: nodeState.attempts });

      if (node.config.retryOnFailure && nodeState.attempts < node.config.maxRetries) {
        const delay = this.retryManager.getDelay(nodeState.attempts);
        this.emit('node:retry', { nodeId, attempt: nodeState.attempts + 1, delay });
        
        setTimeout(() => {
          this.executeNode(nodeId);
        }, delay);
      } else {
        this.state.errors.push(error as Error);
        await this.handleNodeFailure(nodeId);
      }
    }
  }

  private async checkDependencies(nodeId: string): Promise<boolean> {
    const dependencies = this.dependencyResolver.getNodeDependencies(nodeId);
    
    for (const depId of dependencies) {
      if (!this.completedNodes.has(depId)) {
        const depState = this.state.nodes.get(depId);
        if (depState?.status === 'failed') {
          this.emit('node:skipped', { nodeId, reason: `Dependency ${depId} failed` });
          return false;
        }
      }
    }
    
    return true;
  }

  private gatherInputData(node: FlowNode): any {
    const inputData: Record<string, any> = {};
    
    const incomingEdges = this.flow.edges.filter(e => e.target === node.id);
    
    for (const edge of incomingEdges) {
      const sourceOutput = this.nodeOutputs.get(edge.source);
      if (sourceOutput) {
        const outputValue = edge.sourceHandle ? sourceOutput[edge.sourceHandle] : sourceOutput;
        
        if (edge.targetHandle) {
          inputData[edge.targetHandle] = outputValue;
        } else {
          Object.assign(inputData, outputValue);
        }
      }
    }
    
    Object.assign(inputData, node.inputs);
    
    return inputData;
  }

  private async waitForNodeCompletion(nodeId: string, timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Node ${nodeId} timed out after ${timeout}ms`));
      }, timeout);

      const checkOutput = async () => {
        const instance = this.claudeManager.getNodeInstance(nodeId);
        if (instance) {
          try {
            const outputPath = path.join(instance.projectDir, 'output.json');
            const outputExists = await fs.access(outputPath).then(() => true).catch(() => false);
            
            if (outputExists) {
              const output = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
              clearTimeout(timer);
              resolve(output);
              return;
            }
          } catch (error) {
            // Continue checking
          }
        }
        
        if (instance?.status === 'stopped' || instance?.status === 'error') {
          clearTimeout(timer);
          
          if (instance.status === 'error') {
            reject(new Error(`Node ${nodeId} execution failed`));
          } else {
            resolve(instance.output || {});
          }
        } else {
          setTimeout(checkOutput, 1000);
        }
      };

      checkOutput();
    });
  }

  private async handleReview(nodeId: string): Promise<void> {
    const node = this.flow.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const nodeState = this.state.nodes.get(nodeId)!;
    
    // Pause the node execution
    this.pausedNodes.add(nodeId);
    nodeState.status = 'reviewing' as any;
    
    // Get files modified by this node
    const instance = this.claudeManager.getNodeInstance(nodeId);
    const modifiedFiles = instance?.filesModified || [];
    
    // Create review request
    const reviewRequest: ReviewRequest = {
      nodeId,
      flowId: this.flow.id,
      reviewScope: node.config.reviewScope || 'changes',
      files: modifiedFiles,
      criteria: node.config.reviewCriteria,
      timeout: node.config.reviewTimeout,
      requiresApproval: node.config.requiresReview || false,
      metadata: {
        agentType: node.agentId,
        nodeLabel: node.label,
        nodeOutput: this.nodeOutputs.get(nodeId)
      }
    };
    
    this.emit('node:review', { nodeId, request: reviewRequest });
    
    // Request review and wait for result
    const reviewResult = await this.reviewService.requestReview(reviewRequest);
    
    // Handle review result
    if (reviewResult.status === 'approved') {
      this.pausedNodes.delete(nodeId);
      nodeState.status = 'completed';
      this.emit('node:reviewed', { nodeId, result: reviewResult });
      
    } else if (reviewResult.status === 'changes-requested' && reviewResult.finalDecision === 'retry') {
      // Retry the node with modified instructions
      this.pausedNodes.delete(nodeId);
      nodeState.status = 'pending';
      
      // Update node instructions with review feedback
      if (reviewResult.modifiedInstructions) {
        node.instructions = (node.instructions || '') + '\n\n' + reviewResult.modifiedInstructions;
      }
      
      // Add retry context to node inputs
      if (reviewResult.retryContext) {
        node.inputs = {
          ...node.inputs,
          reviewFeedback: reviewResult.retryContext
        };
      }
      
      // Decrease running count to allow retry
      this.runningNodes.delete(nodeId);
      
      // Retry the node
      setTimeout(() => {
        this.executeNode(nodeId);
      }, 1000);
      
    } else if (reviewResult.status === 'rejected' || reviewResult.finalDecision === 'abort') {
      // Mark node as failed
      this.pausedNodes.delete(nodeId);
      nodeState.status = 'failed';
      nodeState.lastError = new Error(`Review rejected: ${reviewResult.feedback.map(f => f.comments).join(', ')}`);
      
      this.emit('node:reviewed', { nodeId, result: reviewResult });
      await this.handleNodeFailure(nodeId);
    }
  }

  private async triggerDependentNodes(nodeId: string): Promise<void> {
    const dependents = this.dependencyResolver.getDependentNodes(nodeId);
    
    for (const depId of dependents) {
      if (!this.runningNodes.has(depId) && !this.completedNodes.has(depId)) {
        const canExecute = await this.checkDependencies(depId);
        if (canExecute) {
          this.executeNode(depId).catch(error => {
            console.error(`Failed to execute dependent node ${depId}:`, error);
          });
        }
      }
    }
  }

  private async handleNodeFailure(nodeId: string): Promise<void> {
    const dependents = this.dependencyResolver.getDependentNodes(nodeId);
    
    for (const depId of dependents) {
      const depState = this.state.nodes.get(depId);
      if (depState && depState.status === 'pending') {
        depState.status = 'failed';
        this.emit('node:skipped', { nodeId: depId, reason: `Parent ${nodeId} failed` });
      }
    }
  }

  private async waitForSlot(): Promise<void> {
    return new Promise((resolve) => {
      const checkSlot = () => {
        if (this.runningNodes.size < this.options.maxParallel) {
          resolve();
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      checkSlot();
    });
  }

  private async waitForCompletion(): Promise<void> {
    return new Promise((resolve) => {
      const checkCompletion = () => {
        const allNodes = this.flow.nodes.length;
        const completed = this.completedNodes.size;
        const failed = Array.from(this.state.nodes.values()).filter(n => n.status === 'failed').length;
        
        if (completed + failed >= allNodes) {
          resolve();
        } else {
          setTimeout(checkCompletion, 100);
        }
      };
      checkCompletion();
    });
  }

  private buildExecutionResult(): ExecutionResult {
    const duration = this.state.completedAt ? 
      this.state.completedAt.getTime() - this.state.startedAt.getTime() : 0;
    
    const completedNodes = Array.from(this.state.nodes.values())
      .filter(n => n.status === 'completed').length;
    
    const failedNodes = Array.from(this.state.nodes.values())
      .filter(n => n.status === 'failed').length;

    const output: Record<string, any> = {};
    this.nodeOutputs.forEach((value, key) => {
      output[key] = value;
    });

    return {
      flowId: this.flow.id,
      success: failedNodes === 0,
      duration,
      completedNodes,
      failedNodes,
      output,
      errors: this.state.errors
    };
  }

  private setupEventListeners(): void {
    this.claudeManager.on('agent:output', (data) => {
      this.emit('agent:output', data);
    });

    this.claudeManager.on('agent:stopped', (data) => {
      this.emit('agent:stopped', data);
    });

    this.claudeManager.on('agent:error', (data) => {
      this.emit('agent:error', data);
    });
  }

  private setupReviewListeners(): void {
    this.reviewService.on('review:requested', (data) => {
      this.emit('review:requested', data);
    });

    this.reviewService.on('review:feedback', (feedback) => {
      this.emit('review:feedback', feedback);
    });

    this.reviewService.on('review:cancelled', (data) => {
      this.emit('review:cancelled', data);
    });
  }

  async handleHookEvent(event: HookEvent): Promise<void> {
    const nodeState = this.state.nodes.get(event.nodeId);
    if (!nodeState) return;

    switch (event.event) {
      case 'stop':
        this.nodeOutputs.set(event.nodeId, event.output.data);
        nodeState.output = event.output.data;
        break;
      
      case 'error':
        nodeState.lastError = new Error(event.status.message);
        break;
      
      case 'checkpoint':
        this.emit('node:checkpoint', { nodeId: event.nodeId, data: event.output.data });
        break;
    }
  }

  getState(): ExecutionState {
    return this.state;
  }

  async pauseExecution(): Promise<void> {
    this.state.status = 'paused';
    await this.claudeManager.stopAllAgents();
  }

  async resumeExecution(): Promise<void> {
    if (this.state.status !== 'paused') return;
    
    this.state.status = 'running';
    
    for (const [nodeId, nodeState] of this.state.nodes) {
      if (nodeState.status === 'running') {
        await this.executeNode(nodeId);
      }
    }
  }

  async abortExecution(): Promise<void> {
    this.state.status = 'failed';
    await this.claudeManager.stopAllAgents();
    await this.claudeManager.cleanup(this.flow.id);
  }

  async submitReviewFeedback(feedback: any): Promise<void> {
    await this.reviewService.submitFeedback(feedback);
  }

  getActiveReviews(): any[] {
    return this.reviewService.getActiveReviews();
  }

  async getReviewHistory(nodeId: string): Promise<any[]> {
    return this.reviewService.getReviewHistory(nodeId);
  }
}