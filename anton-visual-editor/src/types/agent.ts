export type AgentCategory = 'setup' | 'execution' | 'testing' | 'integration' | 'review' | 'summary'

export interface AgentInput {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  required: boolean
  description: string
  default?: any
}

export interface AgentOutput {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
}

export interface AgentConfig {
  id: string
  name: string
  category: AgentCategory
  type: string
  version: string
  description: string
  icon: string
  color: string
  instructions: {
    base: string
    contextual: string
  }
  claudeMD: string
  inputs: AgentInput[]
  outputs: AgentOutput[]
  hooks: {
    onStart?: string
    onStop: string
    onError?: string
  }
  resources: {
    estimatedTime: number
    estimatedTokens: number
    requiresGPU: boolean
    maxRetries: number
  }
  dependencies: string[]
  tags: string[]
}

export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'reviewing'

export interface FlowNode {
  id: string
  agentId: string
  label: string
  instructions: string
  inputs: Record<string, any>
  position: {
    x: number
    y: number
  }
  config: {
    retryOnFailure: boolean
    maxRetries: number
    timeout: number
    requiresReview: boolean
  }
  status: NodeStatus
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  condition?: {
    type: 'success' | 'failure' | 'custom'
    expression?: string
  }
  label?: string
}

export interface Flow {
  id: string
  version: number
  name: string
  description: string
  created: string
  modified: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  metadata: {
    gitRepo?: string
    branch?: string
    environment: Record<string, string>
    secrets: string[]
  }
}