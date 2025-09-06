export interface FlowNode {
    id: string;
    agentId: string;
    label: string;
    instructions: string;
    claudeMD?: string;
    inputs: Record<string, any>;
    position: {
        x: number;
        y: number;
    };
    config: {
        retryOnFailure: boolean;
        maxRetries: number;
        timeout: number;
        requiresReview: boolean;
    };
    status: 'pending' | 'running' | 'completed' | 'failed' | 'reviewing';
}
export interface FlowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle: string;
    targetHandle: string;
    condition?: {
        type: 'success' | 'failure' | 'custom';
        expression?: string;
    };
    label?: string;
}
export interface Flow {
    id: string;
    version: number;
    name: string;
    description: string;
    created: string;
    modified: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
    metadata: {
        gitRepo?: string;
        branch?: string;
        environment?: Record<string, string>;
        secrets?: string[];
    };
}
export interface ClaudeInstance {
    id: string;
    nodeId: string;
    projectDir: string;
    process?: any;
    status: 'initializing' | 'running' | 'stopped' | 'error';
    startedAt: Date;
    stoppedAt?: Date;
    output: any;
    logs: string[];
    metrics: {
        duration?: number;
        tokensUsed?: number;
        filesModified?: string[];
    };
}
export interface HookEvent {
    event: 'start' | 'stop' | 'error' | 'checkpoint' | 'tool_use';
    nodeId: string;
    agentId: string;
    timestamp: number;
    status: {
        code: number;
        message: string;
    };
    output: {
        data: any;
        logs: string[];
        metrics: {
            duration: number;
            tokensUsed: number;
            filesModified: string[];
        };
    };
    next: {
        action: 'continue' | 'retry' | 'skip' | 'abort' | 'review';
        context?: any;
    };
}
export interface ExecutionState {
    flowId: string;
    status: 'initializing' | 'running' | 'completed' | 'failed' | 'paused';
    startedAt: Date;
    completedAt?: Date;
    nodes: Map<string, NodeExecutionState>;
    errors: Error[];
    output: Record<string, any>;
}
export interface NodeExecutionState {
    nodeId: string;
    status: FlowNode['status'];
    startedAt?: Date;
    completedAt?: Date;
    attempts: number;
    lastError?: Error;
    output?: any;
    instanceId?: string;
}
export interface AgentConfig {
    id: string;
    name: string;
    category: 'setup' | 'execution' | 'testing' | 'integration' | 'review' | 'summary';
    type: string;
    version: string;
    description: string;
    instructions: {
        base: string;
        contextual: string;
    };
    claudeMD: string;
    inputs: Array<{
        name: string;
        type: string;
        required: boolean;
        description: string;
        default?: any;
    }>;
    outputs: Array<{
        name: string;
        type: string;
        description: string;
    }>;
    hooks: {
        onStart?: string;
        onStop: string;
        onError?: string;
    };
    resources: {
        estimatedTime: number;
        estimatedTokens: number;
        requiresGPU: boolean;
        maxRetries: number;
    };
    dependencies?: string[];
    tags: string[];
}
export interface RetryStrategy {
    maxAttempts: number;
    backoff: 'linear' | 'exponential' | 'fibonacci';
    initialDelay: number;
    maxDelay: number;
    contextEnhancement: {
        includeErrors: boolean;
        includeStackTrace: boolean;
        includeSuggestions: boolean;
        includeRelatedCode: boolean;
    };
}
export interface ExecutionOptions {
    maxParallel: number;
    timeout: number;
    retryStrategy: RetryStrategy;
    debug: boolean;
    dryRun: boolean;
}
export interface ExecutionResult {
    flowId: string;
    success: boolean;
    duration: number;
    completedNodes: number;
    failedNodes: number;
    output: Record<string, any>;
    errors: Error[];
}
//# sourceMappingURL=index.d.ts.map