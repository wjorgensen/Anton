export interface ProjectNode {
  id: string;
  type: 'agent' | 'review' | 'parallel' | 'condition';
  label: string;
  description?: string;
  agent?: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
}

export interface ProjectEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  animated?: boolean;
  style?: Record<string, any>;
  label?: string;
}

export interface CircuitBoard {
  nodes: ProjectNode[];
  edges: ProjectEdge[];
  metadata?: {
    createdAt: string;
    updatedAt: string;
    version: number;
  };
}

export interface Project {
  id: string;
  name: string;
  prompt: string;
  circuitBoard: CircuitBoard;
  status: 'draft' | 'ready' | 'running' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  executionHistory?: ExecutionRecord[];
}

export interface ExecutionRecord {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  logs?: string[];
  results?: Record<string, any>;
}

class ClientProjectStorage {
  private readonly STORAGE_KEY = 'anton_projects';
  private memoryStorage: Project[] = [];

  private getProjects(): Project[] {
    // Use memory storage for SSR/server-side operations
    if (typeof window === 'undefined') return this.memoryStorage;
    
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      const projects = data ? JSON.parse(data) : [];
      this.memoryStorage = projects;
      return projects;
    } catch {
      return this.memoryStorage;
    }
  }

  private saveProjects(projects: Project[]): void {
    this.memoryStorage = projects;
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projects));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  async createProject(name: string, prompt: string): Promise<Project> {
    const projectId = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const project: Project = {
      id: projectId,
      name,
      prompt,
      circuitBoard: {
        nodes: [],
        edges: [],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1
        }
      },
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionHistory: []
    };
    
    const projects = this.getProjects();
    projects.push(project);
    this.saveProjects(projects);
    
    return project;
  }

  async saveProject(project: Project): Promise<void> {
    project.updatedAt = new Date().toISOString();
    
    const projects = this.getProjects();
    const index = projects.findIndex(p => p.id === project.id);
    
    if (index >= 0) {
      projects[index] = project;
    } else {
      projects.push(project);
    }
    
    this.saveProjects(projects);
  }

  async loadProject(projectId: string): Promise<Project | null> {
    const projects = this.getProjects();
    return projects.find(p => p.id === projectId) || null;
  }

  async listProjects(): Promise<Project[]> {
    const projects = this.getProjects();
    return projects.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async deleteProject(projectId: string): Promise<void> {
    const projects = this.getProjects();
    const filtered = projects.filter(p => p.id !== projectId);
    this.saveProjects(filtered);
  }

  async updateCircuitBoard(projectId: string, circuitBoard: CircuitBoard): Promise<void> {
    const project = await this.loadProject(projectId);
    if (project) {
      project.circuitBoard = {
        ...circuitBoard,
        metadata: {
          ...circuitBoard.metadata,
          updatedAt: new Date().toISOString(),
          version: (circuitBoard.metadata?.version || 0) + 1
        }
      };
      await this.saveProject(project);
    }
  }

  async addExecutionRecord(projectId: string, record: ExecutionRecord): Promise<void> {
    const project = await this.loadProject(projectId);
    if (project) {
      if (!project.executionHistory) {
        project.executionHistory = [];
      }
      project.executionHistory.push(record);
      await this.saveProject(project);
    }
  }
}

export const clientProjectStorage = new ClientProjectStorage();