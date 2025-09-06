'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  addEdge,
  NodeTypes,
  EdgeTypes,
  Panel,
  useReactFlow,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import RetroCircuitNode from './RetroCircuitNode';
import RetroEdge from './RetroEdge';
import { Project, ProjectNode, ProjectEdge } from '@/services/clientProjectStorage';
import { simulatedExecutionService } from '@/services/simulatedExecutionService';
import { createExecutionService } from '@/services/realExecutionService';

const nodeTypes: NodeTypes = {
  circuit: RetroCircuitNode,
};

const edgeTypes: EdgeTypes = {
  electric: RetroEdge,
};

interface CircuitBoardEditorProps {
  project: Project;
  onSave: (nodes: Node[], edges: Edge[]) => void;
  onRun: () => void;
}

function CircuitBoardCanvas({ project, onSave, onRun }: CircuitBoardEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [flowId, setFlowId] = useState<string | null>(null);
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!project.circuitBoard.nodes || project.circuitBoard.nodes.length === 0) {
      return;
    }
    
    const initialNodes = project.circuitBoard.nodes.map((node: ProjectNode) => ({
      id: node.id,
      type: 'circuit',
      position: node.position,
      data: {
        ...node.data,
        label: node.label,
        status: node.status || 'pending',
        progress: node.progress || 0,
        agent: node.agent,
        description: node.description,
      },
    }));

    const initialEdges = project.circuitBoard.edges.map((edge: ProjectEdge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'electric',
      animated: false,
      data: {
        isActive: false,
      },
    }));
    
    setNodes(initialNodes);
    setEdges(initialEdges);
    
    setTimeout(() => {
      fitView({ padding: 0.1 });
    }, 100);
  }, [project, fitView]);

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      const newEdge = {
        ...params,
        id: `edge-${Date.now()}`,
        type: 'electric',
        animated: false,
        data: { isActive: false },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const handleSave = useCallback(() => {
    onSave(nodes, edges);
  }, [nodes, edges, onSave]);

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setCurrentNodeIndex(0);
    
    // In production, this would save to the orchestration backend
    // For now, we'll execute directly with simulation

    // Reset all nodes to pending
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          status: 'pending',
          progress: 0,
        },
      }))
    );

    // Process nodes sequentially with real Claude execution
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      setCurrentNodeIndex(i);

      // Set current node to running
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              data: {
                ...n.data,
                status: 'running',
                progress: 0,
              },
            };
          }
          return n;
        })
      );

      // Activate edges leading to this node
      setEdges((eds) =>
        eds.map((edge) => ({
          ...edge,
          data: {
            isActive: edge.target === node.id,
          },
        }))
      );

      try {
        // Use real execution service with native Claude CLI
        const executionService = createExecutionService(true, project.id);
        const result = await executionService.executeNode({
          id: node.id,
          type: node.data.agent || 'setup',
          agent: node.data.agent,
          label: node.data.label,
          description: node.data.description,
        }, project.prompt);

        if (result.success) {
          console.log(`Node ${node.id} execution result:`, result.output);
          
          // Show progress incrementally
          for (let progress = 0; progress <= 100; progress += 25) {
            setNodes((nds) =>
              nds.map((n) => {
                if (n.id === node.id) {
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      progress,
                    },
                  };
                }
                return n;
              })
            );
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // Mark node as completed
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === node.id) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    status: 'completed',
                    progress: 100,
                    executionOutput: result.output,
                  },
                };
              }
              return n;
            })
          );
        }
      } catch (error) {
        console.error(`Failed to execute node ${node.id}:`, error);
        // Mark node as failed
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === node.id) {
              return {
                ...n,
                data: {
                  ...n.data,
                  status: 'failed',
                  progress: 0,
                },
              };
            }
            return n;
          })
        );
      }

      // Deactivate edges
      setEdges((eds) =>
        eds.map((edge) => ({
          ...edge,
          data: {
            isActive: false,
          },
        }))
      );
    }

    setIsRunning(false);
    onRun();
  }, [nodes, isRunning, setNodes, setEdges, onRun, project]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setCurrentNodeIndex(0);

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          status: 'pending',
          progress: 0,
        },
      }))
    );

    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        data: {
          isActive: false,
        },
      }))
    );
  }, [setNodes, setEdges]);

  const handleAddNode = useCallback(() => {
    const newNode = {
      id: `node-${Date.now()}`,
      type: 'circuit',
      position: { x: 250, y: 250 },
      data: {
        label: 'NEW AGENT',
        status: 'pending',
        progress: 0,
        agent: 'setup',
        description: 'Configure this agent',
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        style={{ background: '#000000' }}
        proOptions={{ hideAttribution: true }}
      >
        <Panel position="top-left" style={{
          background: '#000000',
          border: '2px solid #FFFFFF',
          padding: '8px',
          display: 'flex',
          gap: '8px',
          fontFamily: '"Courier New", monospace',
          boxShadow: '4px 4px 0px #0080FF'
        }}>
          <button
            onClick={handleRun}
            disabled={isRunning}
            style={{
              background: isRunning ? '#666666' : '#000000',
              border: '2px solid #FFFFFF',
              color: '#FFFFFF',
              padding: '8px 16px',
              fontFamily: '"Courier New", monospace',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              position: 'relative',
            }}
          >
            {isRunning ? `[RUNNING ${currentNodeIndex+1}/${nodes.length}]` : '[RUN]'}
          </button>
          
          <button
            onClick={handleReset}
            style={{
              background: '#000000',
              border: '2px solid #FFFFFF',
              color: '#FFFFFF',
              padding: '8px 16px',
              fontFamily: '"Courier New", monospace',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            [RESET]
          </button>
          
          <button
            onClick={handleSave}
            style={{
              background: '#000000',
              border: '2px solid #FFFFFF',
              color: '#FFFFFF',
              padding: '8px 16px',
              fontFamily: '"Courier New", monospace',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            [SAVE]
          </button>
          
          <button
            onClick={handleAddNode}
            style={{
              background: '#0080FF',
              border: '2px solid #0080FF',
              color: '#000000',
              padding: '8px 16px',
              fontFamily: '"Courier New", monospace',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            [+] ADD NODE
          </button>
        </Panel>

        <Panel position="top-right" style={{
          background: '#000000',
          border: '2px solid #FFFFFF',
          padding: '8px 16px',
          fontFamily: '"Courier New", monospace',
          color: isRunning ? '#0080FF' : '#FFFFFF',
          fontWeight: 'bold',
          boxShadow: '4px 4px 0px #0080FF'
        }}>
          {isRunning ? `> EXECUTING...` : '> READY'}
        </Panel>
      </ReactFlow>
    </>
  );
}

export default function CircuitBoardEditor(props: CircuitBoardEditorProps) {
  return (
    <ReactFlowProvider>
      <div className="w-full h-full relative" style={{ background: '#000000' }}>
        <CircuitBoardCanvas {...props} />
      </div>
    </ReactFlowProvider>
  );
}