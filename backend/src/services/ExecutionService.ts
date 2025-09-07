import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger';
import { ExecutionRequest, ExecutionResult, NodeExecution, ClaudeMessage, Plan } from '../types';

export class ExecutionService extends EventEmitter {
  private activeExecutions: Map<string, ExecutionContext> = new Map();
  private executionDir: string;

  constructor() {
    super();
    this.executionDir = process.env.EXECUTION_OUTPUT_DIR || path.join(process.cwd(), 'execution-outputs');
    this.ensureExecutionDir();
  }

  private async ensureExecutionDir() {
    try {
      await fs.mkdir(this.executionDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create execution directory:', error);
    }
  }

  async executePlan(request: ExecutionRequest): Promise<ExecutionResult> {
    const executionId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const executionPath = path.join(this.executionDir, `exec-${timestamp}-${executionId}`);
    
    try {
      // Create execution directory
      await fs.mkdir(executionPath, { recursive: true });
      
      // Load plan
      const plan = await this.loadPlan(request.planPath || request.plan);
      
      // Initialize execution context
      const context: ExecutionContext = {
        executionId,
        plan,
        executionPath,
        activeNodes: new Map(),
        completedNodes: new Set(),
        nodeExecutions: new Map(),
        status: 'running',
        startTime: Date.now()
      };
      
      this.activeExecutions.set(executionId, context);
      
      // Start execution based on mode
      if (request.mode === 'full') {
        await this.executeFullPlan(context);
      } else {
        await this.executeSelectedNodes(context, request.selectedNodes || []);
      }
      
      return {
        executionId,
        status: context.status,
        nodeExecutions: Array.from(context.nodeExecutions.values()),
        completedNodes: Array.from(context.completedNodes),
        duration: Date.now() - context.startTime,
        success: context.status === 'completed'
      };
      
    } catch (error) {
      logger.error('Plan execution failed:', error);
      throw error;
    }
  }

  private async executeFullPlan(context: ExecutionContext) {
    const { plan, executionId } = context;
    
    // Parse execution flow and execute nodes in order
    await this.executeFlow(context, plan.executionFlow);
    
    context.status = 'completed';
    this.emit('execution-complete', { executionId });
  }

  private async executeFlow(context: ExecutionContext, flow: any): Promise<void> {
    if (!flow) return;
    
    switch (flow.type) {
      case 'sequential':
        // Execute children one by one
        for (const child of flow.children || []) {
          await this.executeFlow(context, child);
        }
        break;
        
      case 'parallel':
        // Execute children in parallel
        const promises = (flow.children || []).map((child: any) => 
          this.executeFlow(context, child)
        );
        await Promise.all(promises);
        break;
        
      case 'node':
        // Execute a single node
        const nodeId = typeof flow.children === 'string' ? flow.children : flow.nodeId;
        if (nodeId) {
          await this.executeNode(context, nodeId);
        }
        break;
    }
  }

  private async executeNode(context: ExecutionContext, nodeId: string): Promise<void> {
    const { plan, executionId, executionPath } = context;
    const node = plan.nodes.find(n => n.id === nodeId);
    
    if (!node) {
      logger.error(`Node ${nodeId} not found in plan`);
      return;
    }
    
    // Check if node is already completed or running
    if (context.completedNodes.has(nodeId) || context.activeNodes.has(nodeId)) {
      return;
    }
    
    // Check dependencies
    for (const dep of node.dependencies || []) {
      if (!context.completedNodes.has(dep)) {
        logger.info(`Waiting for dependency ${dep} before executing ${nodeId}`);
        await this.waitForNode(context, dep);
      }
    }
    
    const nodeExecution: NodeExecution = {
      nodeId,
      status: 'running',
      startTime: Date.now(),
      messages: []
    };
    
    context.nodeExecutions.set(nodeId, nodeExecution);
    context.activeNodes.set(nodeId, nodeExecution);
    
    this.emit('node-started', { executionId, nodeId, node });
    
    try {
      // Create node execution directory
      const nodeDir = path.join(executionPath, nodeId);
      await fs.mkdir(nodeDir, { recursive: true });
      
      // Get agent configuration
      const agentConfig = await this.getAgentConfig(node.agent);
      
      // Prepare Claude instructions
      const instructions = this.prepareNodeInstructions(node, plan);
      
      // Execute with Claude
      await this.executeWithClaude(nodeDir, instructions, agentConfig, nodeExecution);
      
      // Handle testing loop if configured
      if (node.testingLoop) {
        await this.handleTestingLoop(context, node, nodeExecution);
      }
      
      nodeExecution.status = 'completed';
      nodeExecution.endTime = Date.now();
      
      context.completedNodes.add(nodeId);
      context.activeNodes.delete(nodeId);
      
      this.emit('node-completed', { executionId, nodeId, node, execution: nodeExecution });
      
    } catch (error) {
      nodeExecution.status = 'failed';
      nodeExecution.error = error instanceof Error ? error.message : String(error);
      nodeExecution.endTime = Date.now();
      
      context.activeNodes.delete(nodeId);
      
      this.emit('node-failed', { executionId, nodeId, node, error });
      
      // Depending on configuration, might want to continue or fail entire execution
      if (context.failFast) {
        context.status = 'failed';
        throw error;
      }
    }
  }

  private async executeWithClaude(
    workDir: string,
    instructions: string,
    agentConfig: any,
    nodeExecution: NodeExecution
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-p', instructions,
        '--output-format', 'stream-json',
        '--permission-mode', 'acceptEdits',
        '--verbose'
      ];
      
      // Add agent-specific system prompt if available
      if (agentConfig?.claudeMD) {
        const systemPromptPath = path.join(workDir, 'agent-system.md');
        fs.writeFile(systemPromptPath, agentConfig.claudeMD).then(() => {
          args.push('--append-system-prompt', systemPromptPath);
        });
      }
      
      args.push('--cwd', workDir);
      
      logger.info(`Executing node with Claude`, { nodeId: nodeExecution.nodeId, workDir });
      
      const claudeProcess = spawn('claude', args, {
        cwd: workDir,
        env: { ...process.env }
      });
      
      let outputBuffer = '';
      
      claudeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        outputBuffer += chunk;
        
        const lines = outputBuffer.split('\n');
        outputBuffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              nodeExecution.messages.push(message);
              this.emit('node-message', { 
                nodeId: nodeExecution.nodeId, 
                message 
              });
            } catch (err) {
              // Continue buffering
            }
          }
        }
      });
      
      claudeProcess.stderr.on('data', (data) => {
        logger.error(`Claude stderr for ${nodeExecution.nodeId}:`, data.toString());
      });
      
      claudeProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Claude process exited with code ${code}`));
        }
      });
      
      claudeProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async handleTestingLoop(
    context: ExecutionContext,
    node: any,
    nodeExecution: NodeExecution
  ): Promise<void> {
    const { testNode, fixNode } = node.testingLoop;
    let testPassed = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!testPassed && attempts < maxAttempts) {
      attempts++;
      
      // Execute test node
      await this.executeNode(context, testNode);
      const testExecution = context.nodeExecutions.get(testNode);
      
      // Check if test passed (simplified - would need actual test result parsing)
      testPassed = testExecution?.status === 'completed';
      
      if (!testPassed && fixNode) {
        // Execute fix node
        await this.executeNode(context, fixNode);
      }
    }
    
    if (!testPassed) {
      throw new Error(`Testing loop failed after ${maxAttempts} attempts`);
    }
  }

  private prepareNodeInstructions(node: any, plan: Plan): string {
    return `# Task: ${node.label}

## Project Context
${plan.plan.description}

## Your Specific Task
${node.instructions}

## Type of Task
This is a ${node.type} task.

Please complete the task according to the instructions provided.`;
  }

  private async getAgentConfig(agentId: string): Promise<any> {
    // Load agent configuration from agents library
    try {
      const agentPath = path.join(process.cwd(), 'agents', 'library', `${agentId}.json`);
      const agentData = await fs.readFile(agentPath, 'utf-8');
      return JSON.parse(agentData);
    } catch (error) {
      logger.warn(`Agent config not found for ${agentId}, using defaults`);
      return {};
    }
  }

  private async loadPlan(planSource: string | any): Promise<Plan> {
    if (typeof planSource === 'object') {
      return planSource;
    }
    
    const planData = await fs.readFile(planSource, 'utf-8');
    return JSON.parse(planData);
  }

  private async waitForNode(context: ExecutionContext, nodeId: string): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (context.completedNodes.has(nodeId)) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  }

  private async executeSelectedNodes(
    context: ExecutionContext,
    selectedNodes: string[]
  ): Promise<void> {
    for (const nodeId of selectedNodes) {
      await this.executeNode(context, nodeId);
    }
    context.status = 'completed';
  }

  pauseExecution(executionId: string): boolean {
    const context = this.activeExecutions.get(executionId);
    if (context) {
      context.status = 'paused';
      // Kill active Claude processes
      for (const [nodeId, execution] of context.activeNodes) {
        // Implementation would track and kill processes
      }
      return true;
    }
    return false;
  }

  resumeExecution(executionId: string): boolean {
    const context = this.activeExecutions.get(executionId);
    if (context && context.status === 'paused') {
      context.status = 'running';
      // Resume execution logic
      return true;
    }
    return false;
  }

  cancelExecution(executionId: string): boolean {
    const context = this.activeExecutions.get(executionId);
    if (context) {
      context.status = 'cancelled';
      // Kill all active processes
      this.activeExecutions.delete(executionId);
      return true;
    }
    return false;
  }
}

interface ExecutionContext {
  executionId: string;
  plan: Plan;
  executionPath: string;
  activeNodes: Map<string, NodeExecution>;
  completedNodes: Set<string>;
  nodeExecutions: Map<string, NodeExecution>;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  failFast?: boolean;
}