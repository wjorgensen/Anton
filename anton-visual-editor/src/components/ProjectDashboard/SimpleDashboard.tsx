'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Zap, 
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  Edit3,
  Trash2,
  FolderOpen
} from 'lucide-react';
import SimpleProjectWizard from './SimpleProjectWizard';
import { Project } from '@/services/clientProjectStorage';
import { backendProjectService } from '@/services/backendProjectService';

export default function SimpleDashboard() {
  const router = useRouter();
  const [showWizard, setShowWizard] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      // Use backend service to load projects from API
      const data = await backendProjectService.listProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async (projectData: { name: string; prompt: string }, skipPlanning = false) => {
    try {
      let circuitBoard = null;
      
      if (!skipPlanning) {
        // Try Claude CLI planning
        const planResponse = await fetch('/api/plan-circuit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: projectData.prompt }),
        });
        
        if (planResponse.ok) {
          const result = await planResponse.json();
          
          // Check if planning is async (returns planningId)
          if (result.planningId) {
            // Poll for results
            let attempts = 0;
            const maxAttempts = 60; // Poll for up to 5 minutes
            
            while (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
              
              const statusResponse = await fetch(`/api/plan-project/${result.planningId}`);
              if (statusResponse.ok) {
                const statusResult = await statusResponse.json();
                
                if (statusResult.status !== 'running') {
                  circuitBoard = statusResult;
                  break;
                }
              }
              
              attempts++;
            }
            
            if (!circuitBoard) {
              throw new Error('Planning timed out. Claude may still be working - please try creating the project without planning.');
            }
          } else {
            circuitBoard = result;
          }
        } else {
          const error = await planResponse.json();
          throw new Error(error.error || 'Planning failed');
        }
      }
      
      // If no circuit board from planning or skipPlanning is true, use simple generation
      if (!circuitBoard) {
        const response = await fetch('/api/generate-circuit-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: projectData.prompt }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to generate circuit board');
        }
        
        circuitBoard = await response.json();
      }
      
      // Create project with circuit board using backend service
      const project = await backendProjectService.createProject(
        projectData.name,
        projectData.prompt,
        circuitBoard
      );
      
      // Reload projects list
      await loadProjects();
      
      // Navigate to circuit board
      router.push(`/circuit-board?id=${project.id}`);
    } catch (error) {
      console.error('Failed to create project:', error);
      
      // Show error with retry option
      const message = error instanceof Error ? error.message : 'Failed to create project';
      if (confirm(`${message}\n\nWould you like to try creating the project without Claude planning?`)) {
        handleCreateProject(projectData, true); // Retry without planning
      }
    }
  };

  const handleOpenProject = (projectId: string) => {
    router.push(`/circuit-board?id=${projectId}`);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      await backendProjectService.deleteProject(projectId);
      loadProjects();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'completed':
        return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'failed':
        return 'text-red-400 bg-red-400/10 border-red-400/20';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-[#262626] bg-gradient-to-r from-[#0A0A0A] to-[#141414]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Circuit Board Studio</h1>
                <p className="text-gray-400">Visual AI workflow builder</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowWizard(true)}
              className="px-6 py-3 bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white rounded-lg hover:from-[#60A5FA] hover:to-[#A78BFA] transition-all flex items-center gap-2 font-medium shadow-lg shadow-[#3B82F6]/25"
            >
              <Plus className="w-5 h-5" />
              New Project
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 bg-[#262626] rounded-full flex items-center justify-center mb-6">
              <FolderOpen className="w-10 h-10 text-gray-600" />
            </div>
            <h2 className="text-xl font-medium text-white mb-2">No projects yet</h2>
            <p className="text-gray-400 mb-8">Create your first project to get started</p>
            <button
              onClick={() => setShowWizard(true)}
              className="px-8 py-3 bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white rounded-lg hover:from-[#60A5FA] hover:to-[#A78BFA] transition-all flex items-center gap-2 font-medium"
            >
              <Plus className="w-5 h-5" />
              Create First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-[#0A0A0A] border border-[#262626] rounded-lg hover:border-[#404040] transition-all group"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-white mb-1">{project.name}</h3>
                      <p className="text-sm text-gray-400 line-clamp-2">{project.prompt}</p>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(project.status)} flex items-center gap-1`}>
                      {getStatusIcon(project.status)}
                      {project.status}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-[#141414] rounded-lg p-3">
                      <div className="text-2xl font-bold text-white">
                        {project.circuitBoard.nodes.length}
                      </div>
                      <div className="text-xs text-gray-400">Nodes</div>
                    </div>
                    <div className="bg-[#141414] rounded-lg p-3">
                      <div className="text-2xl font-bold text-white">
                        {project.executionHistory?.length || 0}
                      </div>
                      <div className="text-xs text-gray-400">Runs</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenProject(project.id)}
                      className="flex-1 px-4 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-[#60A5FA] transition-all flex items-center justify-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      Open
                    </button>
                    <button
                      onClick={() => handleDeleteProject(project.id)}
                      className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="border-t border-[#262626] px-6 py-3 bg-[#050505]">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                    <span>v{project.circuitBoard.metadata?.version || 1}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showWizard && (
        <SimpleProjectWizard
          onComplete={handleCreateProject}
          onCancel={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}