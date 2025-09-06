import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

// Import the AppRouter type from the orchestration service
// This would normally be imported from the backend, but for now we'll define a minimal interface
interface AppRouter {
  project: {
    get: {
      query: (input: { id: string }) => Promise<Project>;
    };
    list: {
      query: () => Promise<Project[]>;
    };
    create: {
      mutate: (input: CreateProjectInput) => Promise<Project>;
    };
    update: {
      mutate: (input: UpdateProjectInput) => Promise<Project>;
    };
    delete: {
      mutate: (input: { id: string }) => Promise<void>;
    };
  };
  flow: {
    get: {
      query: (input: { id: string }) => Promise<Flow>;
    };
    save: {
      mutate: (input: SaveFlowInput) => Promise<Flow>;
    };
    validate: {
      query: (input: { flow: Flow }) => Promise<ValidationResult>;
    };
  };
  execution: {
    start: {
      mutate: (input: StartExecutionInput) => Promise<Execution>;
    };
    stop: {
      mutate: (input: { executionId: string }) => Promise<void>;
    };
    status: {
      query: (input: { executionId: string }) => Promise<ExecutionStatus>;
    };
    logs: {
      query: (input: { executionId: string }) => Promise<ExecutionLog[]>;
    };
  };
  agent: {
    list: {
      query: () => Promise<Agent[]>;
    };
    get: {
      query: (input: { id: string }) => Promise<Agent>;
    };
    search: {
      query: (input: { query: string }) => Promise<Agent[]>;
    };
  };
  planning: {
    generateFlow: {
      mutate: (input: { requirements: string }) => Promise<Flow>;
    };
    suggestAgents: {
      query: (input: { context: string }) => Promise<Agent[]>;
    };
  };
}

// Type definitions
interface Project {
  id: string;
  name: string;
  description?: string;
  flowId?: string;
  created: string;
  updated: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
}

interface CreateProjectInput {
  name: string;
  description?: string;
  requirements?: string;
}

interface UpdateProjectInput {
  id: string;
  name?: string;
  description?: string;
  status?: Project['status'];
}

interface Flow {
  id: string;
  version: number;
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  metadata?: Record<string, any>;
}

interface FlowNode {
  id: string;
  agentId: string;
  label: string;
  instructions?: string;
  inputs?: Record<string, any>;
  position: { x: number; y: number };
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'reviewing';
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: {
    type: 'success' | 'failure' | 'custom';
    expression?: string;
  };
}

interface SaveFlowInput {
  projectId: string;
  flow: Flow;
}

interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

interface StartExecutionInput {
  projectId: string;
  flowId: string;
  parameters?: Record<string, any>;
}

interface Execution {
  id: string;
  projectId: string;
  flowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface ExecutionStatus {
  execution: Execution;
  nodeStatuses: Record<string, NodeExecutionStatus>;
  progress: number;
}

interface NodeExecutionStatus {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  output?: any;
  error?: string;
}

interface ExecutionLog {
  timestamp: string;
  nodeId?: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  data?: any;
}

interface Agent {
  id: string;
  name: string;
  category: 'setup' | 'execution' | 'testing' | 'integration' | 'review' | 'summary';
  type: string;
  description: string;
  icon?: string;
  inputs: AgentInput[];
  outputs: AgentOutput[];
  estimatedTime?: number;
}

interface AgentInput {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  default?: any;
}

interface AgentOutput {
  name: string;
  type: string;
  description?: string;
}

// Create the API client
const getApiUrl = () => {
  // Use environment variable if available, otherwise use default
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
};

export const api = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: `${getApiUrl()}/trpc`,
      headers() {
        // Get token from localStorage if available
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
        return {
          authorization: token ? `Bearer ${token}` : '',
        };
      },
    }),
  ],
});

// Helper functions for common operations
export const projectApi = {
  async getProject(id: string) {
    return await api.project.get.query({ id });
  },
  
  async listProjects() {
    return await api.project.list.query();
  },
  
  async createProject(input: CreateProjectInput) {
    return await api.project.create.mutate(input);
  },
  
  async updateProject(input: UpdateProjectInput) {
    return await api.project.update.mutate(input);
  },
  
  async deleteProject(id: string) {
    return await api.project.delete.mutate({ id });
  },
};

export const flowApi = {
  async getFlow(id: string) {
    return await api.flow.get.query({ id });
  },
  
  async saveFlow(projectId: string, flow: Flow) {
    return await api.flow.save.mutate({ projectId, flow });
  },
  
  async validateFlow(flow: Flow) {
    return await api.flow.validate.query({ flow });
  },
  
  async generateFlow(requirements: string) {
    return await api.planning.generateFlow.mutate({ requirements });
  },
};

export const executionApi = {
  async startExecution(projectId: string, flowId: string, parameters?: Record<string, any>) {
    return await api.execution.start.mutate({ projectId, flowId, parameters });
  },
  
  async stopExecution(executionId: string) {
    return await api.execution.stop.mutate({ executionId });
  },
  
  async getStatus(executionId: string) {
    return await api.execution.status.query({ executionId });
  },
  
  async getLogs(executionId: string) {
    return await api.execution.logs.query({ executionId });
  },
};

export const agentApi = {
  async listAgents() {
    return await api.agent.list.query();
  },
  
  async getAgent(id: string) {
    return await api.agent.get.query({ id });
  },
  
  async searchAgents(query: string) {
    return await api.agent.search.query({ query });
  },
  
  async suggestAgents(context: string) {
    return await api.planning.suggestAgents.query({ context });
  },
};

// WebSocket connection for real-time updates
export class RealtimeConnection {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    const wsUrl = getApiUrl().replace('http', 'ws') + '/ws';
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        
        // Authenticate if token exists
        const token = localStorage.getItem('token');
        if (token) {
          this.send('auth', { token });
        }
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { type, data } = message;
          
          // Notify all subscribers for this event type
          const handlers = this.subscribers.get(type);
          if (handlers) {
            handlers.forEach(handler => handler(data));
          }
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.handleReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.handleReconnect();
    }
  }
  
  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      console.log(`Reconnecting in ${delay}ms...`);
      setTimeout(() => this.connect(), delay);
    }
  }
  
  send(type: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }
  
  subscribe(eventType: string, handler: (data: any) => void) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.subscribers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Create singleton instance
export const realtime = new RealtimeConnection();

// Auto-connect on module load if in browser
if (typeof window !== 'undefined') {
  realtime.connect();
}