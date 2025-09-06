'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, Sparkles, Save, Share2 } from 'lucide-react';
import { Project } from '@/services/clientProjectStorage';
import { backendProjectService } from '@/services/backendProjectService';

const CircuitBoardEditor = dynamic(
  () => import('@/components/CircuitBoard/CircuitBoardEditor'),
  { ssr: false }
);

async function generateCircuitBoard(prompt: string) {
  const response = await fetch('/api/generate-circuit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to generate circuit board');
  }
  
  return response.json();
}

export default function CircuitBoardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadProject = async () => {
      const projectId = searchParams.get('id');
      if (projectId) {
        // Use backend service
        const project = await backendProjectService.getProject(projectId);
        
        if (project) {
          console.log('Loaded project from backend:', project);
          
          // Generate circuit board if not present (shouldn't happen now)
          if (!project.circuitBoard || project.circuitBoard.nodes.length === 0) {
            console.log('Project has no circuit board, generating...');
            setIsGenerating(true);
            try {
              const circuitData = await generateCircuitBoard(project.prompt);
              console.log('Generated circuit data:', circuitData);
              project.circuitBoard = circuitData;
              project.status = 'ready';
              
              // Save updated project
              await backendProjectService.updateProject(project);
            } finally {
              setIsGenerating(false);
            }
          } else {
            console.log('Project already has circuit board with', project.circuitBoard.nodes.length, 'nodes');
          }
          setProject(project);
        } else {
          console.error('Project not found:', projectId);
        }
      } else {
        const name = searchParams.get('name');
        const prompt = searchParams.get('prompt');
        
        if (name && prompt) {
          setIsGenerating(true);
          try {
            const circuitData = await generateCircuitBoard(prompt);
            
            const newProject: Project = {
              id: `project-${Date.now()}`,
              name,
              prompt,
              circuitBoard: circuitData,
              status: 'ready',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              executionHistory: [],
            };
            
            setProject(newProject);
          } catch (error) {
            console.error('Failed to generate circuit board:', error);
          } finally {
            setIsGenerating(false);
          }
        }
      }
    };

    loadProject();
  }, [searchParams]);

  const handleSave = async (nodes: any[], edges: any[]) => {
    if (!project) return;
    
    setIsSaving(true);
    try {
      const updatedProject = {
        ...project,
        circuitBoard: {
          nodes: nodes.map(node => ({
            id: node.id,
            type: node.type,
            label: node.data.label,
            description: node.data.description,
            agent: node.data.agent,
            position: node.position,
            data: node.data,
            status: node.data.status,
            progress: node.data.progress,
          })),
          edges: edges.map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
            animated: edge.animated,
            style: edge.style,
            label: edge.data?.label,
          })),
          metadata: {
            ...project.circuitBoard.metadata,
            updatedAt: new Date().toISOString(),
            version: (project.circuitBoard.metadata?.version || 0) + 1,
          },
        },
        updatedAt: new Date().toISOString(),
      };

      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProject),
      });

      if (response.ok) {
        setProject(updatedProject);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = async () => {
    if (!project) return;

    const response = await fetch(`/api/projects/${project.id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const executionData = await response.json();
      console.log('Execution started:', executionData);
    }
  };

  if (isGenerating) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#000000',
        fontFamily: '"Courier New", monospace',
      }}>
        <div style={{
          border: '2px solid #FFFFFF',
          padding: '24px',
          background: '#000000',
          boxShadow: '4px 4px 0px #0080FF',
        }}>
          <p style={{ color: '#0080FF', fontWeight: 'bold', margin: 0 }}>
            [GENERATING CIRCUIT BOARD...]
          </p>
          <p style={{ color: '#FFFFFF', fontSize: '12px', marginTop: '8px' }}>
            {'>'} AI ANALYZING REQUIREMENTS
          </p>
          <p style={{ color: '#0080FF', fontSize: '12px', marginTop: '4px' }}>
            {'>'} PLEASE WAIT_
          </p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#000000',
        fontFamily: '"Courier New", monospace',
      }}>
        <div style={{
          border: '2px solid #FFFFFF',
          padding: '24px',
          background: '#000000',
          boxShadow: '4px 4px 0px #0080FF',
          textAlign: 'center',
        }}>
          <p style={{ color: '#FFFFFF', fontWeight: 'bold', margin: 0 }}>
            [ERROR: NO PROJECT FOUND]
          </p>
          <button
            onClick={() => router.push('/')}
            style={{
              marginTop: '16px',
              background: '#0080FF',
              border: '2px solid #0080FF',
              color: '#000000',
              padding: '8px 24px',
              fontFamily: '"Courier New", monospace',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            [RETURN TO DASHBOARD]
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: '#000000' }}>
      <header style={{
        borderBottom: '2px solid #FFFFFF',
        background: '#000000',
        padding: '12px 24px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: '"Courier New", monospace',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => router.push('/')}
              style={{
                background: '#000000',
                border: '2px solid #FFFFFF',
                color: '#FFFFFF',
                padding: '8px',
                fontFamily: '"Courier New", monospace',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {'<-'}
            </button>
            <div>
              <h1 style={{
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#FFFFFF',
                textTransform: 'uppercase',
                margin: 0,
              }}>
                {project.name}
              </h1>
              <p style={{
                fontSize: '12px',
                color: '#0080FF',
                margin: 0,
              }}>
                CIRCUIT BOARD EDITOR
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isSaving && (
              <span style={{ fontSize: '12px', color: '#0080FF' }}>[SAVING...]</span>
            )}
            <button style={{
              background: '#000000',
              border: '2px solid #FFFFFF',
              color: '#FFFFFF',
              padding: '8px 16px',
              fontFamily: '"Courier New", monospace',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: '4px 4px 0px #0080FF',
            }}>
              [SHARE]
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 relative">
        <CircuitBoardEditor
          project={project}
          onSave={handleSave}
          onRun={handleRun}
        />
      </main>
    </div>
  );
}