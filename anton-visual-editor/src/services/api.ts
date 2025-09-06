interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'created' | 'running' | 'completed' | 'failed' | 'paused';
  flow: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  executions?: Execution[];
  userId?: string;
  metadata?: Record<string, any>;
}

interface Execution {
  id: string;
  projectId: string;
  status: 'starting' | 'running' | 'completed' | 'failed' | 'paused';
  startedAt: string;
  completedAt?: string;
  metadata: Record<string, any>;
  nodes?: NodeExecution[];
  project?: Project;
}

interface NodeExecution {
  id: string;
  executionId: string;
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'reviewing';
  startedAt?: string;
  completedAt?: string;
  output?: Record<string, any>;
  errorMessage?: string;
}

interface CreateProjectRequest {
  name: string;
  description?: string;
  flow: Record<string, any>;
}

interface ExecuteProjectRequest {
  projectId: string;
}

interface AgentCompleteRequest {
  nodeId: string;
  executionId: string;
  status: 'completed' | 'failed' | 'error';
  output?: Record<string, any>;
  errorMessage?: string;
}

interface ReviewFeedbackRequest {
  executionId: string;
  nodeId: string;
  approved: boolean;
  feedback?: string;
  changes?: Record<string, any>;
}

class ApiClient {
  private baseUrl: string;
  private trpcUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
    this.trpcUrl = process.env.NEXT_PUBLIC_TRPC_URL || 'http://localhost:3003';
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      return { 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      };
    }
  }

  private async trpcRequest<T>(procedure: string, input?: any): Promise<ApiResponse<T>> {
    try {
      const url = `${this.trpcUrl}/${procedure}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`tRPC ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      console.error(`tRPC request failed for ${procedure}:`, error);
      return { 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      };
    }
  }

  // Health check
  async checkHealth(): Promise<ApiResponse<{ status: string; timestamp: string; version?: string }>> {
    return this.request('/health');
  }

  // Project management
  async createProject(projectData: CreateProjectRequest): Promise<ApiResponse<Project>> {
    const response = await this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
    // Handle the nested structure from the API
    if (response.data && typeof response.data === 'object' && 'project' in response.data) {
      return { data: (response.data as any).project };
    }
    return response;
  }

  async getProject(id: string): Promise<ApiResponse<Project>> {
    const response = await this.request(`/api/projects/${id}`);
    // Handle the nested structure from the API
    if (response.data && typeof response.data === 'object' && 'project' in response.data) {
      return { data: (response.data as any).project };
    }
    return response;
  }

  async listProjects(): Promise<ApiResponse<Project[]>> {
    const response = await this.request('/api/projects');
    // Handle the nested structure from the API
    if (response.data && typeof response.data === 'object' && 'projects' in response.data) {
      return { data: (response.data as any).projects };
    }
    return response;
  }

  async updateProject(id: string, updates: Partial<CreateProjectRequest>): Promise<ApiResponse<Project>> {
    return this.request(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteProject(id: string): Promise<ApiResponse<void>> {
    return this.request(`/api/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // Execution management
  async executeProject(projectId: string): Promise<ApiResponse<Execution>> {
    return this.request('/api/executions', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
  }

  async getExecution(id: string): Promise<ApiResponse<Execution>> {
    return this.request(`/api/executions/${id}`);
  }

  async getExecutionHistory(filters?: {
    status?: string;
    projectId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Execution[]>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }
    
    return this.request(`/api/executions/history?${params.toString()}`);
  }

  async pauseExecution(executionId: string): Promise<ApiResponse<void>> {
    return this.request(`/api/executions/${executionId}/pause`, {
      method: 'POST',
    });
  }

  async resumeExecution(executionId: string): Promise<ApiResponse<void>> {
    return this.request(`/api/executions/${executionId}/resume`, {
      method: 'POST',
    });
  }

  async stopExecution(executionId: string): Promise<ApiResponse<void>> {
    return this.request(`/api/executions/${executionId}/stop`, {
      method: 'POST',
    });
  }

  // Agent callbacks
  async reportAgentComplete(data: AgentCompleteRequest): Promise<ApiResponse<NodeExecution>> {
    return this.request('/api/agent-complete', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitReviewFeedback(data: ReviewFeedbackRequest): Promise<ApiResponse<NodeExecution>> {
    return this.request('/api/review-feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Preview management
  async startPreview(executionId: string, nodeId: string): Promise<ApiResponse<{ url: string }>> {
    return this.request(`/api/preview/${executionId}/${nodeId}`, {
      method: 'POST',
    });
  }

  async stopPreview(nodeId: string): Promise<ApiResponse<void>> {
    return this.request(`/api/preview/${nodeId}`, {
      method: 'DELETE',
    });
  }

  async getPreviewUrl(nodeId: string): Promise<ApiResponse<{ url: string }>> {
    return this.request(`/api/preview/${nodeId}`);
  }

  async getActivePreviewServers(): Promise<ApiResponse<{ servers: any[] }>> {
    return this.request('/api/preview/active');
  }

  // Metrics
  async getMetrics(): Promise<ApiResponse<string>> {
    return this.request('/metrics');
  }

  // Template projects (for wizard)
  async getProjectTemplates(): Promise<ApiResponse<any[]>> {
    return this.request('/api/projects/templates');
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export types for use in components
export type {
  Project,
  Execution,
  NodeExecution,
  CreateProjectRequest,
  ExecuteProjectRequest,
  AgentCompleteRequest,
  ReviewFeedbackRequest,
  ApiResponse,
};