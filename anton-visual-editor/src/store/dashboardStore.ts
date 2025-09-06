import { create } from 'zustand'

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
  technology: {
    frontend: string;
    backend: string;
    database: string;
  };
  createdAt: Date;
  updatedAt: Date;
  estimatedTime: number;
  actualTime?: number;
  progress: number;
  agentCount: number;
  isFavorite: boolean;
  tags: string[];
  executionHistory: ExecutionHistoryItem[];
  metrics: ProjectMetrics;
}

export interface ExecutionHistoryItem {
  id: string;
  timestamp: Date;
  status: 'success' | 'failure' | 'cancelled';
  duration: number;
  agentsExecuted: number;
  errorMessage?: string;
}

export interface ProjectMetrics {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  lastExecuted?: Date;
  totalAgents: number;
  activeAgents: number;
}

export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  failedProjects: number;
  averageSuccessRate: number;
  totalExecutionTime: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'project_created' | 'project_completed' | 'project_failed' | 'agent_executed';
  message: string;
  timestamp: Date;
  projectId?: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: {
    status?: string[];
    tags?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
    technology?: string[];
  };
}

interface DashboardState {
  // Data
  projects: Project[];
  stats: DashboardStats | null;
  
  // UI State
  viewMode: 'grid' | 'list';
  searchQuery: string;
  selectedProjects: Set<string>;
  
  // Filtering
  activeFilters: {
    status: string[];
    tags: string[];
    technology: string[];
    dateRange?: { start: Date; end: Date };
  };
  filterPresets: FilterPreset[];
  activeFilterPreset: string | null;
  showFilterPanel: boolean;
  
  // Sorting
  sortBy: 'name' | 'date' | 'status' | 'progress' | 'successRate';
  sortOrder: 'asc' | 'desc';
  
  // Loading states
  isLoading: boolean;
  isLoadingStats: boolean;
  error: string | null;
  
  // Actions
  setProjects: (projects: Project[]) => void;
  setStats: (stats: DashboardStats) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setSearchQuery: (query: string) => void;
  toggleProjectSelection: (projectId: string) => void;
  selectAllProjects: () => void;
  clearSelection: () => void;
  
  // Filtering actions
  setStatusFilter: (status: string[]) => void;
  setTagsFilter: (tags: string[]) => void;
  setTechnologyFilter: (tech: string[]) => void;
  setDateRangeFilter: (range: { start: Date; end: Date } | undefined) => void;
  clearFilters: () => void;
  saveFilterPreset: (name: string) => void;
  applyFilterPreset: (presetId: string) => void;
  deleteFilterPreset: (presetId: string) => void;
  toggleFilterPanel: () => void;
  
  // Sorting actions
  setSortBy: (field: 'name' | 'date' | 'status' | 'progress' | 'successRate') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  
  // Data actions
  refreshData: () => Promise<void>;
  loadRealProjects: (apiClient: any) => Promise<void>;
  toggleProjectFavorite: (projectId: string) => void;
  deleteProjects: (projectIds: string[], apiClient?: any) => Promise<void>;
  duplicateProject: (projectId: string) => void;
  archiveProjects: (projectIds: string[]) => void;
  
  // Computed getters
  getFilteredProjects: () => Project[];
  getProjectStats: () => DashboardStats;
  hasActiveFilters: () => boolean;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  // Initial state
  projects: [],
  stats: null,
  viewMode: 'grid',
  searchQuery: '',
  selectedProjects: new Set(),
  activeFilters: {
    status: [],
    tags: [],
    technology: [],
  },
  filterPresets: [
    {
      id: 'active-projects',
      name: 'Active Projects',
      filters: { status: ['running', 'paused'] }
    },
    {
      id: 'completed-today',
      name: 'Completed Today',
      filters: { 
        status: ['completed'], 
        dateRange: { 
          start: new Date(new Date().setHours(0, 0, 0, 0)), 
          end: new Date() 
        } 
      }
    }
  ],
  activeFilterPreset: null,
  showFilterPanel: false,
  sortBy: 'date',
  sortOrder: 'desc',
  isLoading: false,
  isLoadingStats: false,
  error: null,

  // Basic setters
  setProjects: (projects) => set({ projects }),
  setStats: (stats) => set({ stats }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  // Selection actions
  toggleProjectSelection: (projectId) => {
    const current = get().selectedProjects;
    const newSelection = new Set(current);
    if (newSelection.has(projectId)) {
      newSelection.delete(projectId);
    } else {
      newSelection.add(projectId);
    }
    set({ selectedProjects: newSelection });
  },
  
  selectAllProjects: () => {
    const filteredProjects = get().getFilteredProjects();
    const allIds = new Set(filteredProjects.map(p => p.id));
    set({ selectedProjects: allIds });
  },
  
  clearSelection: () => set({ selectedProjects: new Set() }),
  
  // Filtering actions
  setStatusFilter: (status) => {
    set({ 
      activeFilters: { ...get().activeFilters, status },
      activeFilterPreset: null 
    });
  },
  
  setTagsFilter: (tags) => {
    set({ 
      activeFilters: { ...get().activeFilters, tags },
      activeFilterPreset: null 
    });
  },
  
  setTechnologyFilter: (technology) => {
    set({ 
      activeFilters: { ...get().activeFilters, technology },
      activeFilterPreset: null 
    });
  },
  
  setDateRangeFilter: (range) => {
    set({ 
      activeFilters: { ...get().activeFilters, dateRange: range },
      activeFilterPreset: null 
    });
  },
  
  clearFilters: () => {
    set({
      activeFilters: { status: [], tags: [], technology: [] },
      activeFilterPreset: null,
      searchQuery: ''
    });
  },
  
  saveFilterPreset: (name) => {
    const currentFilters = get().activeFilters;
    const newPreset: FilterPreset = {
      id: `preset-${Date.now()}`,
      name,
      filters: { ...currentFilters }
    };
    
    set({
      filterPresets: [...get().filterPresets, newPreset],
      activeFilterPreset: newPreset.id
    });
  },
  
  applyFilterPreset: (presetId) => {
    const preset = get().filterPresets.find(p => p.id === presetId);
    if (preset) {
      set({
        activeFilters: {
          status: preset.filters.status || [],
          tags: preset.filters.tags || [],
          technology: preset.filters.technology || [],
          dateRange: preset.filters.dateRange
        },
        activeFilterPreset: presetId
      });
    }
  },
  
  deleteFilterPreset: (presetId) => {
    set({
      filterPresets: get().filterPresets.filter(p => p.id !== presetId),
      activeFilterPreset: get().activeFilterPreset === presetId ? null : get().activeFilterPreset
    });
  },
  
  toggleFilterPanel: () => set({ showFilterPanel: !get().showFilterPanel }),
  
  // Sorting actions
  setSortBy: (field) => {
    const current = get().sortBy;
    const newOrder = current === field && get().sortOrder === 'asc' ? 'desc' : 'asc';
    set({ sortBy: field, sortOrder: newOrder });
  },
  
  setSortOrder: (order) => set({ sortOrder: order }),
  
  // Data actions
  loadRealProjects: async (apiClient) => {
    try {
      set({ isLoading: true, error: null });
      
      const response = await apiClient.listProjects();
      
      if (response.error) {
        set({ error: response.error, isLoading: false });
        return;
      }

      // Transform API projects to dashboard format
      const transformedProjects: Project[] = (response.data || []).map((project: any) => ({
        id: project.id,
        name: project.name,
        description: project.description || '',
        status: project.status === 'created' ? 'idle' : project.status,
        technology: {
          frontend: project.metadata?.technology?.frontend || 'React',
          backend: project.metadata?.technology?.backend || 'Node.js',
          database: project.metadata?.technology?.database || 'PostgreSQL'
        },
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.updatedAt),
        estimatedTime: project.metadata?.estimatedTime || 60,
        actualTime: project.metadata?.actualTime,
        progress: project.metadata?.progress || 0,
        agentCount: project.flow ? Object.keys(project.flow).length : 0,
        isFavorite: project.metadata?.isFavorite || false,
        tags: project.metadata?.tags || [],
        executionHistory: [], // TODO: Load from executions API
        metrics: {
          totalExecutions: 0,
          successRate: 0.0,
          averageExecutionTime: 0,
          lastExecuted: undefined,
          totalAgents: project.flow ? Object.keys(project.flow).length : 0,
          activeAgents: 0
        }
      }));

      set({ 
        projects: transformedProjects, 
        isLoading: false, 
        error: null 
      });

      // Update stats
      const stats = get().getProjectStats();
      set({ stats });

    } catch (err) {
      console.error('Failed to load projects:', err);
      set({ 
        error: 'Failed to load projects', 
        isLoading: false 
      });
    }
  },
  
  refreshData: async () => {
    set({ isLoading: true, error: null });
    
    try {
      // Simulate API call - replace with actual API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data generation
      const mockProjects: Project[] = [
        {
          id: '1',
          name: 'E-commerce Platform',
          description: 'Modern e-commerce platform with React and Node.js',
          status: 'running',
          technology: {
            frontend: 'React',
            backend: 'Node.js',
            database: 'PostgreSQL'
          },
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date(),
          estimatedTime: 120,
          actualTime: 95,
          progress: 75,
          agentCount: 8,
          isFavorite: true,
          tags: ['web', 'ecommerce', 'full-stack'],
          executionHistory: [
            {
              id: 'exec-1',
              timestamp: new Date(Date.now() - 86400000),
              status: 'success',
              duration: 85,
              agentsExecuted: 6
            }
          ],
          metrics: {
            totalExecutions: 3,
            successRate: 0.89,
            averageExecutionTime: 87,
            lastExecuted: new Date(Date.now() - 3600000),
            totalAgents: 8,
            activeAgents: 3
          }
        },
        {
          id: '2',
          name: 'Mobile Chat App',
          description: 'Real-time messaging app with React Native',
          status: 'completed',
          technology: {
            frontend: 'React Native',
            backend: 'Express.js',
            database: 'MongoDB'
          },
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date(Date.now() - 86400000),
          estimatedTime: 80,
          actualTime: 72,
          progress: 100,
          agentCount: 6,
          isFavorite: false,
          tags: ['mobile', 'chat', 'realtime'],
          executionHistory: [],
          metrics: {
            totalExecutions: 2,
            successRate: 1.0,
            averageExecutionTime: 72,
            lastExecuted: new Date(Date.now() - 86400000),
            totalAgents: 6,
            activeAgents: 0
          }
        },
        {
          id: '3',
          name: 'AI Dashboard',
          description: 'Analytics dashboard with machine learning insights',
          status: 'failed',
          technology: {
            frontend: 'Vue.js',
            backend: 'Python',
            database: 'Redis'
          },
          createdAt: new Date('2024-01-20'),
          updatedAt: new Date(Date.now() - 7200000),
          estimatedTime: 150,
          progress: 45,
          agentCount: 10,
          isFavorite: false,
          tags: ['ai', 'dashboard', 'analytics'],
          executionHistory: [
            {
              id: 'exec-2',
              timestamp: new Date(Date.now() - 7200000),
              status: 'failure',
              duration: 42,
              agentsExecuted: 4,
              errorMessage: 'Database connection failed'
            }
          ],
          metrics: {
            totalExecutions: 1,
            successRate: 0.0,
            averageExecutionTime: 42,
            lastExecuted: new Date(Date.now() - 7200000),
            totalAgents: 10,
            activeAgents: 0
          }
        }
      ];
      
      set({ projects: mockProjects });
      
    } catch (error) {
      set({ error: 'Failed to load projects' });
    } finally {
      set({ isLoading: false });
    }
  },
  
  toggleProjectFavorite: (projectId) => {
    set({
      projects: get().projects.map(p =>
        p.id === projectId ? { ...p, isFavorite: !p.isFavorite } : p
      )
    });
  },
  
  deleteProjects: async (projectIds, apiClient?) => {
    // First update the UI optimistically
    set({
      projects: get().projects.filter(p => !projectIds.includes(p.id)),
      selectedProjects: new Set()
    });
    
    // Then call API to delete from backend if apiClient provided
    if (apiClient) {
      try {
        await Promise.all(
          projectIds.map(id => apiClient.deleteProject(id))
        );
      } catch (error) {
        console.error('Failed to delete projects from backend:', error);
        // Could reload projects here to sync with backend
      }
    }
  },
  
  duplicateProject: (projectId) => {
    const project = get().projects.find(p => p.id === projectId);
    if (project) {
      const duplicated: Project = {
        ...project,
        id: `${projectId}-copy-${Date.now()}`,
        name: `${project.name} (Copy)`,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'idle',
        progress: 0,
        executionHistory: []
      };
      set({ projects: [...get().projects, duplicated] });
    }
  },
  
  archiveProjects: (projectIds) => {
    // In a real implementation, this would move projects to an archived state
    // For now, we'll just remove them
    get().deleteProjects(projectIds);
  },
  
  // Computed getters
  getFilteredProjects: () => {
    const { projects, searchQuery, activeFilters, sortBy, sortOrder } = get();
    
    let filtered = projects.filter(project => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          project.name.toLowerCase().includes(query) ||
          project.description.toLowerCase().includes(query) ||
          project.tags.some(tag => tag.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }
      
      // Status filter
      if (activeFilters.status.length > 0 && !activeFilters.status.includes(project.status)) {
        return false;
      }
      
      // Tags filter
      if (activeFilters.tags.length > 0 && 
          !activeFilters.tags.some(tag => project.tags.includes(tag))) {
        return false;
      }
      
      // Technology filter
      if (activeFilters.technology.length > 0) {
        const projectTech = [project.technology.frontend, project.technology.backend, project.technology.database];
        if (!activeFilters.technology.some(tech => projectTech.includes(tech))) {
          return false;
        }
      }
      
      // Date range filter
      if (activeFilters.dateRange) {
        const projectDate = new Date(project.updatedAt);
        if (projectDate < activeFilters.dateRange.start || projectDate > activeFilters.dateRange.end) {
          return false;
        }
      }
      
      return true;
    });
    
    // Sort projects
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'progress':
          comparison = a.progress - b.progress;
          break;
        case 'successRate':
          comparison = a.metrics.successRate - b.metrics.successRate;
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  },
  
  getProjectStats: () => {
    const projects = get().projects;
    
    const stats: DashboardStats = {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'running').length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      failedProjects: projects.filter(p => p.status === 'failed').length,
      averageSuccessRate: projects.length > 0 
        ? projects.reduce((sum, p) => sum + p.metrics.successRate, 0) / projects.length 
        : 0,
      totalExecutionTime: projects.reduce((sum, p) => sum + (p.actualTime || 0), 0),
      recentActivity: projects
        .flatMap(p => p.executionHistory.map(h => ({
          id: h.id,
          type: h.status === 'success' ? 'project_completed' as const : 'project_failed' as const,
          message: `${p.name} execution ${h.status === 'success' ? 'completed' : 'failed'}`,
          timestamp: h.timestamp,
          projectId: p.id
        })))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10)
    };
    
    return stats;
  },
  
  hasActiveFilters: () => {
    const { activeFilters, searchQuery } = get();
    return !!(
      searchQuery ||
      activeFilters.status.length > 0 ||
      activeFilters.tags.length > 0 ||
      activeFilters.technology.length > 0 ||
      activeFilters.dateRange
    );
  }
}))