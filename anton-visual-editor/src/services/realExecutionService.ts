// Real execution service that connects to the backend API or uses native Claude CLI
import { projectApi, executionApi } from '@/lib/rest-api';

export class RealExecutionService {
  private useNativeClaude: boolean;
  private projectId?: string;
  private executionId?: string;

  constructor(useNativeClaude: boolean = true, projectId?: string) {
    this.useNativeClaude = useNativeClaude;
    this.projectId = projectId;
  }

  async executeNode(node: {
    id: string;
    type: string;
    label: string;
    description?: string;
    agent?: string;
  }, projectContext?: string): Promise<{
    success: boolean;
    output: string;
    duration: number;
    logs: string[];
  }> {
    const startTime = Date.now();
    
    try {
      if (this.useNativeClaude) {
        // Use the native Claude CLI endpoint
        const response = await fetch('/api/execute-node-native', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            node: {
              ...node,
              agent: node.agent || node.type || 'setup'
            },
            projectContext: projectContext || `Executing ${node.label}`,
            workingDirectory: `/tmp/anton-${this.projectId || 'temp'}-${node.id}`
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to execute node: ${response.statusText}`);
        }

        const result = await response.json();
        const duration = Date.now() - startTime;

        return {
          success: result.status === 'completed',
          output: result.output || 'No output generated',
          duration,
          logs: [
            `[START] ${new Date().toISOString()} - ${node.label}`,
            `[INFO] Using native Claude CLI`,
            `[INFO] Working directory: ${result.workingDirectory}`,
            '',
            result.output,
            '',
            `[${result.status.toUpperCase()}] Execution finished in ${(duration / 1000).toFixed(2)}s`
          ],
        };
      } else {
        // Use the backend API for orchestrated execution
        if (!this.projectId) {
          throw new Error('Project ID is required for backend execution');
        }

        // Start execution through backend
        const execution = await executionApi.startExecution(this.projectId, {
          nodeId: node.id,
          agent: node.agent || node.type,
        });

        this.executionId = execution.id;

        // Poll for completion (in production, would use WebSocket)
        let attempts = 0;
        const maxAttempts = 60; // 60 seconds timeout
        
        while (attempts < maxAttempts) {
          const status = await executionApi.getExecution(execution.id);
          
          if (status.status === 'completed' || status.status === 'failed') {
            const duration = Date.now() - startTime;
            
            return {
              success: status.status === 'completed',
              output: status.output || 'No output generated',
              duration,
              logs: status.logs || [`Execution ${status.status}`],
            };
          }
          
          // Wait 1 second before polling again
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
        
        throw new Error('Execution timeout');
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        output: `Error: ${errorMessage}`,
        duration,
        logs: [
          `[ERROR] Failed to execute node: ${errorMessage}`,
          `[FAILED] Execution stopped after ${(duration / 1000).toFixed(2)}s`
        ],
      };
    }
  }

  async executeFlow(flow: {
    nodes: Array<{
      id: string;
      type: string;
      label: string;
      description?: string;
      agent?: string;
    }>;
    edges: Array<{
      source: string;
      target: string;
    }>;
  }, onNodeUpdate?: (nodeId: string, status: string, progress: number) => void): Promise<{
    success: boolean;
    results: Map<string, any>;
    totalDuration: number;
  }> {
    const startTime = Date.now();
    const results = new Map<string, any>();
    
    // Build dependency graph
    const dependencies = new Map<string, string[]>();
    for (const edge of flow.edges) {
      if (!dependencies.has(edge.target)) {
        dependencies.set(edge.target, []);
      }
      dependencies.get(edge.target)!.push(edge.source);
    }
    
    // Find nodes with no dependencies (entry points)
    const entryNodes = flow.nodes.filter(node => 
      !dependencies.has(node.id) || dependencies.get(node.id)!.length === 0
    );
    
    // Execute nodes in topological order
    const executed = new Set<string>();
    const queue = [...entryNodes];
    
    while (queue.length > 0) {
      const node = queue.shift()!;
      
      // Check if all dependencies are executed
      const nodeDeps = dependencies.get(node.id) || [];
      if (nodeDeps.some(dep => !executed.has(dep))) {
        // Re-queue if dependencies not met
        queue.push(node);
        continue;
      }
      
      // Execute node
      if (onNodeUpdate) {
        onNodeUpdate(node.id, 'running', 0);
      }
      
      const result = await this.executeNode(node);
      results.set(node.id, result);
      executed.add(node.id);
      
      if (onNodeUpdate) {
        onNodeUpdate(node.id, result.success ? 'completed' : 'failed', 100);
      }
      
      // Add dependent nodes to queue
      for (const edge of flow.edges) {
        if (edge.source === node.id && !executed.has(edge.target)) {
          const target = flow.nodes.find(n => n.id === edge.target);
          if (target && !queue.some(n => n.id === target.id)) {
            queue.push(target);
          }
        }
      }
    }
    
    const totalDuration = Date.now() - startTime;
    const allSuccess = Array.from(results.values()).every(r => r.success);
    
    return {
      success: allSuccess,
      results,
      totalDuration,
    };
  }

  // Method to cancel ongoing execution
  async cancel(): Promise<void> {
    if (this.executionId) {
      try {
        await executionApi.stopExecution(this.executionId);
      } catch (error) {
        console.error('Failed to cancel execution:', error);
      }
    }
  }
}

// Export a factory function for creating execution services
export function createExecutionService(useNativeClaude: boolean = true, projectId?: string) {
  return new RealExecutionService(useNativeClaude, projectId);
}