import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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

class ProjectStorageService {
  private projectsDir: string;

  constructor() {
    this.projectsDir = path.join(process.cwd(), 'projects');
  }

  async ensureProjectsDir(): Promise<void> {
    try {
      await fs.access(this.projectsDir);
    } catch {
      await fs.mkdir(this.projectsDir, { recursive: true });
    }
  }

  async createProject(name: string, prompt: string): Promise<Project> {
    await this.ensureProjectsDir();
    
    const projectId = uuidv4();
    const projectDir = path.join(this.projectsDir, projectId);
    
    await fs.mkdir(projectDir, { recursive: true });
    
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
    
    await this.saveProject(project);
    return project;
  }

  async saveProject(project: Project): Promise<void> {
    const projectDir = path.join(this.projectsDir, project.id);
    const projectFile = path.join(projectDir, 'project.json');
    
    project.updatedAt = new Date().toISOString();
    
    await fs.writeFile(
      projectFile,
      JSON.stringify(project, null, 2),
      'utf-8'
    );
  }

  async loadProject(projectId: string): Promise<Project | null> {
    try {
      const projectFile = path.join(this.projectsDir, projectId, 'project.json');
      const data = await fs.readFile(projectFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async listProjects(): Promise<Project[]> {
    await this.ensureProjectsDir();
    
    try {
      const entries = await fs.readdir(this.projectsDir, { withFileTypes: true });
      const projects: Project[] = [];
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const project = await this.loadProject(entry.name);
          if (project) {
            projects.push(project);
          }
        }
      }
      
      return projects.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch {
      return [];
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    const projectDir = path.join(this.projectsDir, projectId);
    await fs.rm(projectDir, { recursive: true, force: true });
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

  async saveExecutionLog(projectId: string, executionId: string, log: string): Promise<void> {
    const logDir = path.join(this.projectsDir, projectId, 'logs', executionId);
    await fs.mkdir(logDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logDir, `${timestamp}.log`);
    
    await fs.appendFile(logFile, log + '\n', 'utf-8');
  }

  async getExecutionLogs(projectId: string, executionId: string): Promise<string[]> {
    try {
      const logDir = path.join(this.projectsDir, projectId, 'logs', executionId);
      const files = await fs.readdir(logDir);
      const logs: string[] = [];
      
      for (const file of files.sort()) {
        const content = await fs.readFile(path.join(logDir, file), 'utf-8');
        logs.push(...content.split('\n').filter(line => line.trim()));
      }
      
      return logs;
    } catch {
      return [];
    }
  }
}

export const projectStorage = new ProjectStorageService();