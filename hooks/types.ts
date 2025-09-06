/**
 * Anton v2 Hook System Type Definitions
 * TypeScript interfaces for all hook payloads and events
 */

// ============================================================================
// Base Types
// ============================================================================

export interface HookEvent {
  event: 'start' | 'stop' | 'error' | 'checkpoint' | 'file-change' | 'subagent-complete' | 'test-results';
  nodeId: string;
  timestamp: string;
  sessionId?: string;
}

export interface HookResponse {
  success: boolean;
  message?: string;
  result?: any;
  error?: string;
}

export interface NodeStatus {
  code: number;
  message: string;
}

export interface ExecutionMetrics {
  duration: number;
  tokensUsed: number;
  filesModified?: string[];
  memoryUsed?: number;
  cpuTime?: number;
}

export interface NextAction {
  action: 'continue' | 'retry' | 'skip' | 'abort' | 'review';
  context?: any;
  retryCount?: number;
  maxRetries?: number;
}

// ============================================================================
// Stop Hook Payload
// ============================================================================

export interface StopHookPayload extends HookEvent {
  event: 'stop';
  agentId?: string;
  status: NodeStatus;
  exitCode?: number;
  output: {
    data: any;
    metrics: ExecutionMetrics;
  };
  next: NextAction;
}

// ============================================================================
// File Change Hook Payload
// ============================================================================

export interface FileMetadata {
  path: string;
  size: number;
  mimeType: string;
  lineCount: number;
  hash: string;
  lastModified?: string;
}

export interface GitChanges {
  staged: string[];
  modified: string[];
  untracked: string[];
  deleted?: string[];
}

export interface FileChangeHookPayload extends HookEvent {
  event: 'file-change';
  tool: string;
  snapshotId: string;
  fileMetadata: FileMetadata;
  gitChanges?: GitChanges;
}

// ============================================================================
// Subagent Complete Hook Payload
// ============================================================================

export interface SubagentMetrics {
  filesModified: number;
  testsResults?: {
    passed: number;
    failed: number;
  };
  errorCount: number;
}

export interface SubagentCompleteHookPayload extends HookEvent {
  event: 'subagent-complete';
  parentNodeId: string;
  subagentId: string;
  status: string;
  validation: 'valid' | 'invalid';
  output: any;
  aggregated: Record<string, any>;
  metrics: SubagentMetrics;
  next: NextAction;
}

// ============================================================================
// Test Results Hook Payload
// ============================================================================

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped?: number;
  errors?: number;
  flaky?: number;
}

export interface TestResults {
  framework: 'jest' | 'pytest' | 'go' | 'mocha' | 'vitest' | 'playwright' | 'cypress' | 'rust' | 'unknown';
  summary: TestSummary;
  duration?: number;
  failures?: string[];
  success: boolean;
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  raw?: boolean;
}

export interface TestResultsHookPayload extends HookEvent {
  event: 'test-results';
  command: string;
  results: TestResults;
  recommendations: string[];
}

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentConfig {
  id: string;
  name: string;
  category: 'setup' | 'execution' | 'testing' | 'integration' | 'review' | 'summary';
  type: string;
  version: string;
  description: string;
  icon?: string;
  color?: string;
  instructions: {
    base: string;
    contextual?: string;
  };
  claudeMD: string;
  inputs: AgentInput[];
  outputs: AgentOutput[];
  hooks: AgentHooks;
  resources: AgentResources;
  dependencies?: string[];
  tags?: string[];
}

export interface AgentInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  default?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: any[];
  };
}

export interface AgentOutput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  schema?: any;
}

export interface AgentHooks {
  onStart?: string;
  onStop: string;
  onError?: string;
  postToolUse?: Record<string, string>;
}

export interface AgentResources {
  estimatedTime: number;
  estimatedTokens: number;
  requiresGPU?: boolean;
  maxRetries?: number;
  timeout?: number;
}

// ============================================================================
// Hook Configuration
// ============================================================================

export interface HookConfig {
  hooks: {
    Stop?: HookDefinition[];
    PostToolUse?: HookDefinition[];
    SubagentStop?: HookDefinition[];
    PreCompact?: HookDefinition[];
    UserPromptSubmit?: HookDefinition[];
    SessionStart?: HookDefinition[];
    Notification?: HookDefinition[];
  };
}

export interface HookDefinition {
  matcher?: string;
  hooks: HookCommand[];
}

export interface HookCommand {
  type: 'command';
  command: string;
  timeout?: number;
  retryOnFailure?: boolean;
  continueOnError?: boolean;
}

// ============================================================================
// Flow Types
// ============================================================================

export interface FlowNode {
  id: string;
  agentId: string;
  label?: string;
  instructions?: string;
  inputs?: Record<string, any>;
  position: {
    x: number;
    y: number;
  };
  config?: NodeConfig;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'reviewing';
}

export interface NodeConfig {
  retryOnFailure?: boolean;
  maxRetries?: number;
  timeout?: number;
  requiresReview?: boolean;
  parallelizable?: boolean;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: EdgeCondition;
  label?: string;
}

export interface EdgeCondition {
  type: 'success' | 'failure' | 'custom';
  expression?: string;
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
  metadata?: FlowMetadata;
}

export interface FlowMetadata {
  gitRepo?: string;
  branch?: string;
  environment?: Record<string, string>;
  secrets?: string[];
}

// ============================================================================
// Orchestrator Types
// ============================================================================

export interface OrchestratorConfig {
  port: number;
  wsPort: number;
  dataDir: string;
  logsDir: string;
  maxConcurrentAgents: number;
  hookTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface ExecutionState {
  executionId: string;
  flowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  progress: number;
  currentNodes: string[];
  completedNodes: string[];
  failedNodes: string[];
  nodeStates: Record<string, NodeState>;
}

export interface NodeState {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'reviewing';
  startedAt?: string;
  completedAt?: string;
  output?: any;
  error?: string;
  metrics?: ExecutionMetrics;
  retryCount?: number;
}

// ============================================================================
// Security Types
// ============================================================================

export interface SecurityContext {
  userId?: string;
  projectId: string;
  permissions: string[];
  limits: ResourceLimits;
}

export interface ResourceLimits {
  maxExecutionTime: number;
  maxMemory: number;
  maxDiskSpace: number;
  maxNetworkRequests: number;
  allowedDomains?: string[];
  blockedDomains?: string[];
}

export interface HookValidation {
  signature?: string;
  timestamp: string;
  nonce?: string;
}

// ============================================================================
// Preview Types
// ============================================================================

export interface PreviewUpdate {
  type: 'file-change' | 'terminal-output' | 'web-preview' | 'error';
  nodeId: string;
  timestamp: string;
  data: any;
}

export interface TerminalOutput {
  nodeId: string;
  type: 'stdout' | 'stderr';
  data: string;
  timestamp: string;
}

export interface WebPreviewConfig {
  port: number;
  url: string;
  framework?: string;
  hotReload?: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

export interface HookError {
  code: string;
  message: string;
  nodeId?: string;
  hookType?: string;
  details?: any;
  stack?: string;
  timestamp: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoff: 'linear' | 'exponential' | 'fibonacci';
  initialDelay: number;
  maxDelay: number;
  jitter?: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>;
}[keyof T];

export type Nullable<T> = T | null | undefined;