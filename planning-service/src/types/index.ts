export interface ProjectRequirements {
  description: string;
  projectType?: 'web' | 'mobile' | 'api' | 'fullstack' | 'microservice' | 'cli';
  features?: string[];
  technology?: {
    frontend?: string[];
    backend?: string[];
    database?: string[];
    testing?: string[];
  };
  constraints?: {
    maxParallel?: number;
    timeLimit?: number;
    budget?: number;
  };
  preferences?: {
    framework?: string;
    testing?: 'comprehensive' | 'basic' | 'none';
    review?: 'manual' | 'automated' | 'both';
    deployment?: boolean;
    documentation?: boolean;
  };
}

export interface FlowNode {
  id: string;
  agentId: string;
  label: string;
  category: 'setup' | 'execution' | 'testing' | 'integration' | 'review' | 'utility';
  instructions?: string;
  inputs?: Record<string, any>;
  position: {
    x: number;
    y: number;
  };
  config?: {
    retryOnFailure?: boolean;
    maxRetries?: number;
    timeout?: number;
    requiresReview?: boolean;
  };
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'reviewing';
  estimatedTime?: number;
  dependencies?: string[];
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
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
  metadata?: {
    gitRepo?: string;
    branch?: string;
    environment?: Record<string, string>;
    secrets?: string[];
    projectType?: string;
    estimatedTotalTime?: number;
    estimatedTotalTokens?: number;
  };
}

export interface AgentSelection {
  agentId: string;
  reason: string;
  confidence: number;
  alternatives?: string[];
}

export interface PlanningContext {
  requirements: ProjectRequirements;
  availableAgents: Map<string, any>;
  agentDirectory: any;
  constraints?: {
    maxNodes?: number;
    maxDepth?: number;
  };
}

export interface LayoutPosition {
  x: number;
  y: number;
  layer: number;
}

export interface DependencyGraph {
  nodes: Map<string, FlowNode>;
  edges: Map<string, Set<string>>;
  layers: string[][];
  criticalPath: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface PlanningResult {
  flow: Flow;
  graph: DependencyGraph;
  validation: ValidationResult;
  metrics: {
    totalNodes: number;
    totalEdges: number;
    maxParallelism: number;
    estimatedTime: number;
    estimatedTokens: number;
    criticalPathLength: number;
  };
}