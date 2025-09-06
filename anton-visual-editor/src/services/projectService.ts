// Client-side project service that works directly with localStorage
import { Project, CircuitBoard } from './clientProjectStorage';

class ProjectService {
  private readonly STORAGE_KEY = 'anton_projects';

  async createProject(name: string, prompt: string, circuitBoard?: CircuitBoard): Promise<Project> {
    const projectId = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const project: Project = {
      id: projectId,
      name,
      prompt,
      circuitBoard: circuitBoard || {
        nodes: [],
        edges: [],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1
        }
      },
      status: 'ready',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionHistory: []
    };
    
    // Get existing projects
    const projects = this.getProjects();
    projects.push(project);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projects));
    }
    
    return project;
  }

  async getProject(id: string): Promise<Project | null> {
    const projects = this.getProjects();
    return projects.find(p => p.id === id) || null;
  }

  async updateProject(project: Project): Promise<void> {
    const projects = this.getProjects();
    const index = projects.findIndex(p => p.id === project.id);
    
    if (index >= 0) {
      projects[index] = {
        ...project,
        updatedAt: new Date().toISOString()
      };
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projects));
      }
    }
  }

  async deleteProject(id: string): Promise<void> {
    const projects = this.getProjects();
    const filtered = projects.filter(p => p.id !== id);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    }
  }

  listProjects(): Project[] {
    return this.getProjects();
  }

  private getProjects(): Project[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
}

export const projectService = new ProjectService();