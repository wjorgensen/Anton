// REST API client for Anton backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

// Helper function for API calls
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API call failed: ${response.statusText}`);
  }

  return response.json();
}

// Project API
export const projectApi = {
  async listProjects() {
    const result = await apiCall('/api/projects');
    return result.projects || [];
  },

  async getProject(id: string) {
    const result = await apiCall(`/api/projects/${id}`);
    return result.project;
  },

  async createProject(data: { name: string; description?: string; flow?: any }) {
    const result = await apiCall('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result.project;
  },

  async updateProject(id: string, data: any) {
    const result = await apiCall(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return result.project;
  },

  async deleteProject(id: string) {
    await apiCall(`/api/projects/${id}`, {
      method: 'DELETE',
    });
  },
};

// Execution API
export const executionApi = {
  async startExecution(projectId: string, options?: any) {
    const result = await apiCall(`/api/projects/${projectId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ options }),
    });
    return result.execution;
  },

  async getExecution(executionId: string) {
    const result = await apiCall(`/api/executions/${executionId}`);
    return result.execution;
  },

  async stopExecution(executionId: string) {
    await apiCall(`/api/executions/${executionId}/stop`, {
      method: 'POST',
    });
  },
};

// Agent API - Load from local files
export const agentApi = {
  async listAgents() {
    try {
      // Load agents from the local directory structure
      const response = await fetch('/api/agents');
      const result = await response.json();
      return result.agents || [];
    } catch (error) {
      console.error('Failed to load agents:', error);
      // Return mock agents as fallback
      return [
        {
          id: 'react-developer',
          name: 'React Developer',
          category: 'execution',
          type: 'frontend',
          description: 'Develops React components and applications',
          inputs: [],
          outputs: [],
        },
        {
          id: 'nodejs-backend',
          name: 'Node.js Backend',
          category: 'execution',
          type: 'backend',
          description: 'Develops Node.js backend services',
          inputs: [],
          outputs: [],
        },
        {
          id: 'code-review',
          name: 'Code Review',
          category: 'review',
          type: 'quality',
          description: 'Reviews code for quality and best practices',
          inputs: [],
          outputs: [],
        },
      ];
    }
  },

  async getAgent(id: string) {
    const agents = await this.listAgents();
    return agents.find((a: any) => a.id === id);
  },

  async searchAgents(query: string) {
    const agents = await this.listAgents();
    const lowerQuery = query.toLowerCase();
    return agents.filter((a: any) => 
      a.name.toLowerCase().includes(lowerQuery) ||
      a.description.toLowerCase().includes(lowerQuery) ||
      a.category.toLowerCase().includes(lowerQuery)
    );
  },
};

// Stats API
export const statsApi = {
  async getStats() {
    const result = await apiCall('/api/stats');
    return result.stats;
  },
};

// Health check
export const healthApi = {
  async check() {
    const result = await apiCall('/health');
    return result;
  },
};

// WebSocket connection for real-time updates
export class RealtimeConnection {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;

  connect() {
    const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + '/ws';
    
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      console.log(`Reconnecting in ${delay}ms...`);
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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

// Export default api object for compatibility
export const api = {
  project: projectApi,
  execution: executionApi,
  agent: agentApi,
  stats: statsApi,
  health: healthApi,
};