// Simulated execution service that mimics real Claude Code execution
// In production, this would integrate with the actual Claude API or Claude Code instances

const AGENT_DESCRIPTIONS: Record<string, string> = {
  'setup': 'Initializing project structure and configuration files',
  'frontend-developer': 'Building user interface components and interactions',
  'backend-developer': 'Creating server-side logic and API endpoints',
  'database-developer': 'Setting up database schema and migrations',
  'api-integrator': 'Integrating with external APIs and services',
  'test-runner': 'Running tests and validating code quality',
  'playwright-e2e': 'Executing end-to-end browser tests',
  'code-review': 'Reviewing code for quality and best practices',
  'deployment': 'Deploying application to production environment',
  'docker-builder': 'Creating Docker containers and configurations',
  'security-audit': 'Analyzing code for security vulnerabilities',
  'performance-optimizer': 'Optimizing application performance',
};

const SIMULATED_OUTPUTS: Record<string, string[]> = {
  'setup': [
    '✓ Created project directory structure',
    '✓ Initialized package.json with dependencies',
    '✓ Set up configuration files (.env, tsconfig.json)',
    '✓ Created initial README.md',
  ],
  'frontend-developer': [
    '✓ Created React components',
    '✓ Set up routing structure',
    '✓ Implemented responsive layouts',
    '✓ Added form validation',
  ],
  'backend-developer': [
    '✓ Set up Express server',
    '✓ Created API routes',
    '✓ Implemented authentication middleware',
    '✓ Added error handling',
  ],
  'database-developer': [
    '✓ Created database schema',
    '✓ Set up migrations',
    '✓ Added seed data',
    '✓ Configured connection pooling',
  ],
  'test-runner': [
    '✓ Running unit tests... 42 passed',
    '✓ Running integration tests... 18 passed',
    '✓ Code coverage: 87%',
    '✓ All tests passed successfully',
  ],
};

export class SimulatedExecutionService {
  private executionDelay: number;
  private realTimeMode: boolean;

  constructor(realTimeMode: boolean = true, executionDelay: number = 2000) {
    this.realTimeMode = realTimeMode;
    this.executionDelay = executionDelay;
  }

  async executeNode(node: {
    id: string;
    type: string;
    label: string;
    description?: string;
  }): Promise<{
    success: boolean;
    output: string;
    duration: number;
    logs: string[];
  }> {
    const startTime = Date.now();
    const agentType = node.type || 'setup';
    const description = AGENT_DESCRIPTIONS[agentType] || 'Executing custom task';
    const outputs = SIMULATED_OUTPUTS[agentType] || ['✓ Task completed'];

    // Simulate execution time
    if (this.realTimeMode) {
      // Simulate realistic execution time (2-8 seconds per node)
      const executionTime = this.executionDelay + Math.random() * 6000;
      await new Promise(resolve => setTimeout(resolve, executionTime));
    }

    // Build execution logs
    const logs: string[] = [
      `[START] ${new Date().toISOString()} - ${node.label}`,
      `[INFO] Agent: ${agentType}`,
      `[INFO] ${description}`,
      '',
    ];

    // Add simulated progress logs
    for (const output of outputs) {
      logs.push(`[PROGRESS] ${output}`);
      if (this.realTimeMode) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Add completion log
    const duration = Date.now() - startTime;
    logs.push('');
    logs.push(`[COMPLETE] Execution finished in ${(duration / 1000).toFixed(2)}s`);

    // Build output summary
    const output = `
Task: ${node.label}
Agent: ${agentType}
Description: ${node.description || description}

Results:
${outputs.join('\\n')}

Status: Completed successfully
Duration: ${(duration / 1000).toFixed(2)}s
    `.trim();

    return {
      success: true,
      output,
      duration,
      logs,
    };
  }

  async executeFlow(flow: {
    nodes: Array<{
      id: string;
      type: string;
      label: string;
      description?: string;
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

    // Simple sequential execution (in real implementation, would respect dependencies)
    for (const node of flow.nodes) {
      if (onNodeUpdate) {
        onNodeUpdate(node.id, 'running', 0);
      }

      // Simulate progress updates
      for (let progress = 0; progress <= 100; progress += 25) {
        if (onNodeUpdate) {
          onNodeUpdate(node.id, 'running', progress);
        }
        if (this.realTimeMode) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Execute the node
      const result = await this.executeNode(node);
      results.set(node.id, result);

      if (onNodeUpdate) {
        onNodeUpdate(node.id, 'completed', 100);
      }
    }

    const totalDuration = Date.now() - startTime;

    return {
      success: true,
      results,
      totalDuration,
    };
  }
}

export const simulatedExecutionService = new SimulatedExecutionService();