export interface PlanRequest {
  prompt: string;
  runFixer?: boolean;
  config?: {
    maxParallelization?: boolean;
    includeTests?: boolean;
    includeDocs?: boolean;
  };
}

export interface ExecutionRequest {
  planPath?: string;
  plan?: Plan;
  mode: 'full' | 'selective';
  selectedNodes?: string[];
  config?: {
    failFast?: boolean;
    parallel?: boolean;
    maxConcurrency?: number;
  };
}

export interface Plan {
  plan: {
    projectName: string;
    description: string;
  };
  nodes: PlanNode[];
  executionFlow: ExecutionFlow;
}

export interface PlanNode {
  id: string;
  type: 'setup' | 'execution' | 'testing' | 'fix-execution' | 'integration';
  agent: string;
  label: string;
  instructions: string;
  dependencies: string[];
  testingLoop?: {
    testNode: string;
    fixNode: string;
  };
}

export interface ExecutionFlow {
  type: 'sequential' | 'parallel' | 'node';
  id?: string;
  children: ExecutionFlow[] | string;
}

export interface ClaudeMessage {
  type: string;
  subtype?: string;
  message?: any;
  content?: any;
  tool_use?: any;
  session_id?: string;
  uuid?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface PlanGenerationResult {
  sessionId: string;
  plan: Plan;
  messages: ClaudeMessage[];
  outputDir: string;
  success: boolean;
  projectName?: string;
}

export interface ExecutionResult {
  executionId: string;
  status: string;
  nodeExecutions: NodeExecution[];
  completedNodes: string[];
  duration: number;
  success: boolean;
}

export interface NodeExecution {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  messages: ClaudeMessage[];
  error?: string;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
}

export interface StreamUpdate {
  type: 'planning' | 'execution' | 'node' | 'message' | 'status';
  sessionId?: string;
  executionId?: string;
  nodeId?: string;
  data: any;
}