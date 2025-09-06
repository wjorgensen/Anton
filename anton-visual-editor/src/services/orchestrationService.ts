// Service to interact with the orchestration backend

const ORCHESTRATOR_URL = 'http://localhost:3002';

export interface FlowNode {
  id: string;
  type: string;
  label: string;
  description?: string;
  position: { x: number; y: number };
  inputs?: Record<string, any>;
  config?: Record<string, any>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

export interface Flow {
  id?: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface ExecutionResult {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: any;
  error?: string;
}

class OrchestrationService {
  async createProject(name: string, description: string) {
    const response = await fetch(`${ORCHESTRATOR_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create project');
    }
    
    return response.json();
  }

  async saveFlow(projectId: string, flow: Flow) {
    const response = await fetch(`${ORCHESTRATOR_URL}/api/flows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        ...flow,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to save flow');
    }
    
    return response.json();
  }

  async executeFlow(flowId: string, projectId: string) {
    const response = await fetch(`${ORCHESTRATOR_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flowId,
        projectId,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to execute flow');
    }
    
    return response.json();
  }

  async executeNode(projectId: string, node: FlowNode) {
    const response = await fetch(`${ORCHESTRATOR_URL}/api/execute/node`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        node: {
          ...node,
          type: node.type || 'setup',
          config: {
            ...node.config,
            agent: node.type,
            prompt: node.description,
          },
        },
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to execute node');
    }
    
    return response.json();
  }

  async getExecutionStatus(executionId: string): Promise<ExecutionResult> {
    const response = await fetch(`${ORCHESTRATOR_URL}/api/executions/${executionId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get execution status');
    }
    
    return response.json();
  }

  connectWebSocket(onMessage: (data: any) => void) {
    const ws = new WebSocket(`ws://localhost:3002`);
    
    ws.onopen = () => {
      console.log('Connected to orchestration WebSocket');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('Disconnected from orchestration WebSocket');
      // Reconnect after 5 seconds
      setTimeout(() => {
        this.connectWebSocket(onMessage);
      }, 5000);
    };
    
    return ws;
  }
}

export const orchestrationService = new OrchestrationService();