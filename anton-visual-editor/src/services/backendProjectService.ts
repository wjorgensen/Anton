// Backend-connected project service that uses the real API
import { Project, CircuitBoard } from './clientProjectStorage';
import { projectApi } from '@/lib/rest-api';

class BackendProjectService {
  async createProject(name: string, prompt: string, circuitBoard?: CircuitBoard): Promise<Project> {
    try {
      // Create project in backend
      const backendProject = await projectApi.createProject({
        name,
        description: prompt,
        flow: {
          nodes: circuitBoard?.nodes?.map(node => ({
            id: node.id,
            agentId: node.agent || 'setup',
            label: node.label,
            instructions: node.description,
            position: node.position,
            status: 'pending',
          })) || [],
          edges: circuitBoard?.edges?.map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
          })) || [],
        }
      });

      // Convert backend format to frontend format
      const project: Project = {
        id: backendProject.id,
        name: backendProject.name,
        prompt: backendProject.description || prompt,
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
        createdAt: backendProject.createdAt,
        updatedAt: backendProject.updatedAt,
        executionHistory: []
      };

      return project;
    } catch (error) {
      console.error('Failed to create project in backend:', error);
      throw error;
    }
  }

  async getProject(id: string): Promise<Project | null> {
    try {
      const backendProject = await projectApi.getProject(id);
      
      if (!backendProject) return null;

      // Convert backend format to frontend format
      const project: Project = {
        id: backendProject.id,
        name: backendProject.name,
        prompt: backendProject.description || '',
        circuitBoard: {
          nodes: backendProject.flow?.nodes?.map((node: any) => ({
            id: node.id,
            agent: node.agentId,
            label: node.label,
            description: node.instructions,
            position: node.position,
            status: node.status,
          })) || [],
          edges: backendProject.flow?.edges || [],
          metadata: {
            createdAt: backendProject.createdAt,
            updatedAt: backendProject.updatedAt,
            version: 1
          }
        },
        status: backendProject.status === 'active' ? 'ready' : backendProject.status,
        createdAt: backendProject.createdAt,
        updatedAt: backendProject.updatedAt,
        executionHistory: []
      };

      return project;
    } catch (error) {
      console.error('Failed to get project from backend:', error);
      return null;
    }
  }

  async updateProject(project: Project): Promise<void> {
    try {
      await projectApi.updateProject(project.id, {
        name: project.name,
        description: project.prompt,
        status: project.status === 'ready' ? 'active' : project.status as any,
      });
    } catch (error) {
      console.error('Failed to update project in backend:', error);
      throw error;
    }
  }

  async deleteProject(id: string): Promise<void> {
    try {
      await projectApi.deleteProject(id);
    } catch (error) {
      console.error('Failed to delete project from backend:', error);
      throw error;
    }
  }

  async listProjects(): Promise<Project[]> {
    try {
      const backendProjects = await projectApi.listProjects();
      
      // Convert backend format to frontend format
      return backendProjects.map((bp: any) => ({
        id: bp.id,
        name: bp.name,
        prompt: bp.description || '',
        circuitBoard: {
          nodes: bp.flow?.nodes?.map((node: any) => ({
            id: node.id,
            agent: node.agentId,
            label: node.label,
            description: node.instructions,
            position: node.position,
            status: node.status,
          })) || [],
          edges: bp.flow?.edges || [],
          metadata: {
            createdAt: bp.createdAt,
            updatedAt: bp.updatedAt,
            version: 1
          }
        },
        status: bp.status === 'active' ? 'ready' : bp.status,
        createdAt: bp.createdAt,
        updatedAt: bp.updatedAt,
        executionHistory: []
      }));
    } catch (error) {
      console.error('Failed to list projects from backend:', error);
      // Return empty array if backend is not available
      return [];
    }
  }

  // Synchronous version for compatibility (returns cached or empty)
  listProjectsSync(): Project[] {
    console.warn('listProjectsSync called - this should be replaced with async version');
    return [];
  }
}

export const backendProjectService = new BackendProjectService();