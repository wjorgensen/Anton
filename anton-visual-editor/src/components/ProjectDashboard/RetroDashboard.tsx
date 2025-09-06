'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '@/services/clientProjectStorage';
import { projectService } from '@/services/projectService';

export default function RetroDashboard() {
  const router = useRouter();
  const [showWizard, setShowWizard] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [projectName, setProjectName] = useState('');
  const [projectPrompt, setProjectPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = projectService.listProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim() || !projectPrompt.trim()) return;
    
    setIsCreating(true);
    try {
      const circuitResponse = await fetch('/api/generate-circuit-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: projectPrompt }),
      }).catch(() => 
        fetch('/api/generate-circuit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: projectPrompt }),
        })
      );

      if (circuitResponse.ok) {
        const circuitBoard = await circuitResponse.json();
        
        const project = await projectService.createProject(
          projectName,
          projectPrompt,
          circuitBoard
        );
        
        await loadProjects();
        router.push(`/circuit-board?id=${project.id}`);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsCreating(false);
      setShowWizard(false);
      setProjectName('');
      setProjectPrompt('');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (confirm('[DELETE PROJECT?] Y/N')) {
      await projectService.deleteProject(projectId);
      loadProjects();
    }
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#000000',
    fontFamily: '"Courier New", monospace',
    color: '#FFFFFF',
  };

  const headerStyle: React.CSSProperties = {
    borderBottom: '2px solid #FFFFFF',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const buttonStyle: React.CSSProperties = {
    background: '#000000',
    border: '2px solid #FFFFFF',
    color: '#FFFFFF',
    padding: '8px 16px',
    fontFamily: '"Courier New", monospace',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    cursor: 'pointer',
    boxShadow: '4px 4px 0px #0080FF',
  };

  const projectCardStyle: React.CSSProperties = {
    background: '#000000',
    border: '2px solid #FFFFFF',
    padding: '0',
    marginBottom: '16px',
    boxShadow: '4px 4px 0px #0080FF',
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ 
            fontSize: '20px', 
            fontWeight: 'bold', 
            margin: 0,
            textTransform: 'uppercase' 
          }}>
            CIRCUIT BOARD STUDIO
          </h1>
          <p style={{ fontSize: '12px', color: '#0080FF', margin: 0 }}>
            VISUAL AI WORKFLOW BUILDER V1.0
          </p>
        </div>
        
        <button
          onClick={() => setShowWizard(true)}
          style={buttonStyle}
        >
          [+] NEW PROJECT
        </button>
      </header>

      <main style={{ padding: '24px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <p style={{ color: '#0080FF' }}>[LOADING...]</p>
          </div>
        ) : projects.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px',
            border: '2px solid #FFFFFF',
            boxShadow: '4px 4px 0px #0080FF',
          }}>
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>
              [NO PROJECTS FOUND]
            </p>
            <p style={{ fontSize: '12px', color: '#0080FF', marginBottom: '24px' }}>
              CREATE YOUR FIRST PROJECT TO BEGIN
            </p>
            <button
              onClick={() => setShowWizard(true)}
              style={{
                ...buttonStyle,
                background: '#0080FF',
                color: '#000000',
                border: '2px solid #0080FF',
              }}
            >
              [CREATE FIRST PROJECT]
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color: '#0080FF', marginBottom: '16px' }}>
              [{projects.length} PROJECT{projects.length !== 1 ? 'S' : ''} FOUND]
            </p>
            {projects.map((project) => (
              <div key={project.id} style={projectCardStyle}>
                <div style={{
                  borderBottom: '2px solid #FFFFFF',
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {project.name}
                    </span>
                    <span style={{ color: '#0080FF', marginLeft: '16px' }}>
                      [{project.status.toUpperCase()}]
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#0080FF' }}>
                    NODES: {project.circuitBoard.nodes.length}
                  </span>
                </div>
                <div style={{ padding: '12px' }}>
                  <p style={{ fontSize: '12px', marginBottom: '12px' }}>
                    {project.prompt}
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => router.push(`/circuit-board?id=${project.id}`)}
                      style={{
                        ...buttonStyle,
                        boxShadow: 'none',
                        background: '#0080FF',
                        color: '#000000',
                        border: '2px solid #0080FF',
                      }}
                    >
                      [OPEN]
                    </button>
                    <button
                      onClick={() => handleDeleteProject(project.id)}
                      style={{
                        ...buttonStyle,
                        boxShadow: 'none',
                        color: '#0080FF',
                      }}
                    >
                      [DELETE]
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showWizard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#000000',
            border: '2px solid #FFFFFF',
            width: '500px',
            boxShadow: '8px 8px 0px #0080FF',
          }}>
            <div style={{
              borderBottom: '2px solid #FFFFFF',
              padding: '12px 16px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
            }}>
              [CREATE NEW PROJECT]
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                  PROJECT NAME:
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: '#000000',
                    border: '2px solid #FFFFFF',
                    color: '#FFFFFF',
                    fontFamily: '"Courier New", monospace',
                  }}
                  placeholder="ENTER PROJECT NAME..."
                />
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                  PROJECT DESCRIPTION:
                </label>
                <textarea
                  value={projectPrompt}
                  onChange={(e) => setProjectPrompt(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: '#000000',
                    border: '2px solid #FFFFFF',
                    color: '#FFFFFF',
                    fontFamily: '"Courier New", monospace',
                    minHeight: '100px',
                    resize: 'none',
                  }}
                  placeholder="DESCRIBE YOUR PROJECT..."
                />
              </div>

              <div style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'flex-end',
              }}>
                <button
                  onClick={() => {
                    setShowWizard(false);
                    setProjectName('');
                    setProjectPrompt('');
                  }}
                  style={buttonStyle}
                  disabled={isCreating}
                >
                  [CANCEL]
                </button>
                <button
                  onClick={handleCreateProject}
                  style={{
                    ...buttonStyle,
                    background: '#0080FF',
                    color: '#000000',
                    border: '2px solid #0080FF',
                  }}
                  disabled={!projectName.trim() || !projectPrompt.trim() || isCreating}
                >
                  {isCreating ? '[CREATING...]' : '[CREATE]'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}