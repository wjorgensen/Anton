'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  Node,
  Edge,
  useReactFlow,
  Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import '@/styles/global-enhancements.css'
import { useFlowStore } from '@/store/flowStore'
import { nodeTypes } from '@/components/nodes'
import AgentLibrary from '@/components/AgentLibrary'
import NodeEditModal from '@/components/NodeEditModal'
import FloatingToolbar from '@/components/FloatingToolbar'
import PropertyPanel from '@/components/PropertyPanel'
import ContextMenu, { createNodeContextMenu, createCanvasContextMenu } from '@/components/ContextMenu'
import NotificationSystem, { useNotifications } from '@/components/NotificationSystem'
import { useWebSocket } from '@/hooks/useWebSocket'
import { AgentConfig } from '@/types/agent'
import { Play, Square, Trash2, Download, Upload } from 'lucide-react'

function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView, getViewport, setViewport } = useReactFlow()
  const [isRunning, setIsRunning] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [dropPosition, setDropPosition] = useState<{ x: number; y: number } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showPropertyPanel, setShowPropertyPanel] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    type: 'node' | 'canvas' | 'edge'
    targetId?: string
  } | null>(null)
  const [executionProgress, setExecutionProgress] = useState(0)
  const [showGrid, setShowGrid] = useState(true)
  const [showMinimap, setShowMinimap] = useState(true)
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null)
  
  const { notifications, removeNotification, success, error, warning, info } = useNotifications()
  
  // WebSocket integration for real-time updates
  const { 
    connected, 
    connecting, 
    error: wsError,
    nodeUpdates,
    previewData,
    subscribeToExecution,
    subscribeToProject,
    reconnect 
  } = useWebSocket(currentExecutionId || undefined)
  
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    deleteNode,
    duplicateNode,
    selectNode,
    openEditModal,
    selectedNode,
    updateNode,
    clearFlow,
  } = useFlowStore()
  
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    
    // Update drop position for visual indicator
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })
    setDropPosition(position)
  }, [screenToFlowPosition])
  
  const onDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDraggingOver(true)
  }, [])
  
  const onDragLeave = useCallback((event: React.DragEvent) => {
    // Only set to false if leaving the main container
    if (event.currentTarget === event.target) {
      setIsDraggingOver(false)
      setDropPosition(null)
    }
  }, [])
  
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setIsDraggingOver(false)
      setDropPosition(null)
      
      const agentData = event.dataTransfer.getData('application/agent')
      if (!agentData || !reactFlowWrapper.current) return
      
      const agent = JSON.parse(agentData) as AgentConfig
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      
      // Add node with animation
      const newNodeId = addNode(agent, position)
      
      // Animate the new node appearance
      setTimeout(() => {
        const element = document.querySelector(`[data-id="${newNodeId}"]`)
        if (element) {
          element.classList.add('animate-scale-in')
        }
      }, 10)
    },
    [screenToFlowPosition, addNode]
  )
  
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectNode(node.id)
      setShowPropertyPanel(true)
      setContextMenu(null)
    },
    [selectNode]
  )
  
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      openEditModal(node)
    },
    [openEditModal]
  )

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'node',
        targetId: node.id,
      })
      selectNode(node.id)
    },
    [selectNode]
  )

  const onPaneClick = useCallback(() => {
    setContextMenu(null)
    selectNode(null)
  }, [selectNode])

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      type: 'canvas',
    })
  }, [])

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault()
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'edge',
        targetId: edge.id,
      })
    },
    []
  )
  
  const handleDeleteSelected = useCallback(() => {
    if (selectedNode) {
      deleteNode(selectedNode)
      selectNode(null)
    }
  }, [selectedNode, deleteNode, selectNode])
  
  const handleRun = useCallback(async () => {
    if (nodes.length === 0) {
      error('No Agents', 'Please add some agents to your flow before running.');
      return;
    }

    try {
      setIsRunning(true);
      setExecutionProgress(0);
      
      // TODO: Get current project ID from context/props
      const mockProjectId = 'current-project-id'; // This should come from project context
      
      // Create flow data structure
      const flowData = {
        nodes: nodes.map(node => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target
        }))
      };
      
      console.log('Starting flow execution with:', { nodes, edges, flowData });
      
      // For now, create a new project with this flow and execute it
      const { apiClient } = await import('@/services/api');
      
      const projectResponse = await apiClient.createProject({
        name: `Flow Execution ${new Date().toISOString()}`,
        description: 'Auto-generated project for flow execution',
        flow: flowData
      });
      
      if (projectResponse.error) {
        throw new Error(projectResponse.error);
      }
      
      const project = projectResponse.data;
      if (!project) {
        throw new Error('Failed to create project');
      }
      
      // Execute the project
      const executionResponse = await apiClient.executeProject(project.id);
      
      if (executionResponse.error) {
        throw new Error(executionResponse.error);
      }
      
      const execution = executionResponse.data;
      console.log('Execution started:', execution);
      
      if (execution?.id) {
        setCurrentExecutionId(execution.id);
        subscribeToExecution(execution.id);
      }
      
      success('Execution Started', `Flow execution started with ID: ${execution?.id}`);
      
      // Real-time progress will come from WebSocket updates
      // For now, keep some fallback progress simulation
      const progressInterval = setInterval(() => {
        setExecutionProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            setIsRunning(false);
            success('Execution Complete', 'Flow execution completed successfully!');
            return 100;
          }
          return prev + Math.random() * 15;
        });
      }, 1000);
      
    } catch (err) {
      console.error('Flow execution failed:', err);
      setIsRunning(false);
      setExecutionProgress(0);
      error('Execution Failed', err instanceof Error ? err.message : 'Unknown error occurred');
    }
  }, [nodes, edges, success, error])
  
  const handleStop = useCallback(() => {
    setIsRunning(false)
    setExecutionProgress(0)
    // TODO: Implement flow stop
  }, [])
  
  const handleSave = useCallback(() => {
    try {
      // TODO: Implement flow save
      console.log('Saving flow...')
      success('Flow Saved', 'Your flow has been saved successfully.')
    } catch (err) {
      error('Save Failed', 'There was an error saving your flow.')
    }
  }, [success, error])

  const handleFitView = useCallback(() => {
    fitView({ duration: 800, padding: 0.2 })
  }, [fitView])

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  const handleReset = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 800 })
  }, [setViewport])

  const handleExport = useCallback(() => {
    try {
      const flow = {
        nodes,
        edges,
        timestamp: new Date().toISOString(),
      }
      const dataStr = JSON.stringify(flow, null, 2)
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
      
      const exportFileDefaultName = `flow-${Date.now()}.json`
      
      const linkElement = document.createElement('a')
      linkElement.setAttribute('href', dataUri)
      linkElement.setAttribute('download', exportFileDefaultName)
      linkElement.click()
      
      success('Export Complete', `Flow exported as ${exportFileDefaultName}`)
    } catch (err) {
      error('Export Failed', 'There was an error exporting your flow.')
    }
  }, [nodes, edges, success, error])
  
  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          try {
            const flow = JSON.parse(event.target?.result as string)
            // TODO: Import flow validation and loading
            console.log('Imported flow:', flow)
            success('Import Complete', 'Flow imported successfully.')
          } catch (err) {
            error('Import Failed', 'Invalid flow file or corrupted data.')
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }, [])

  // Close context menu on scroll or resize
  useEffect(() => {
    const handleCloseContextMenu = () => setContextMenu(null)
    window.addEventListener('scroll', handleCloseContextMenu)
    window.addEventListener('resize', handleCloseContextMenu)
    return () => {
      window.removeEventListener('scroll', handleCloseContextMenu)
      window.removeEventListener('resize', handleCloseContextMenu)
    }
  }, [])

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Handle WebSocket node updates
  useEffect(() => {
    if (Object.keys(nodeUpdates).length > 0) {
      // Update node statuses based on WebSocket events
      Object.entries(nodeUpdates).forEach(([nodeId, status]) => {
        updateNode(nodeId, { 
          status: status.status,
          output: status.output,
          error: status.error
        });
        
        // Show notifications for node status changes
        switch (status.status) {
          case 'running':
            info('Node Started', `Agent ${nodeId} is now running`);
            break;
          case 'completed':
            success('Node Completed', `Agent ${nodeId} completed successfully`);
            break;
          case 'failed':
            error('Node Failed', `Agent ${nodeId} failed: ${status.error || 'Unknown error'}`);
            break;
          case 'reviewing':
            warning('Review Required', `Agent ${nodeId} requires manual review`);
            break;
        }
      });
    }
  }, [nodeUpdates, updateNode, info, success, error, warning]);

  // Handle WebSocket connection status
  useEffect(() => {
    if (wsError) {
      error('Connection Error', `WebSocket connection failed: ${wsError}`);
    } else if (connected) {
      success('Connected', 'Real-time updates connected');
    }
  }, [wsError, connected, error, success]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 's':
            event.preventDefault()
            handleSave()
            break
          case 'r':
            event.preventDefault()
            if (!isRunning) handleRun()
            break
          case 'f':
            event.preventDefault()
            handleFitView()
            break
          case 'Delete':
          case 'Backspace':
            if (selectedNode) {
              deleteNode(selectedNode)
              selectNode(null)
            }
            break
        }
      } else if (event.key === 'Escape') {
        setContextMenu(null)
        selectNode(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedNode, isRunning, handleSave, handleRun, handleFitView, deleteNode, selectNode])
  
  return (
    <div 
      className={`flex-1 relative transition-all duration-300 ${
        isDraggingOver ? 'bg-accent-primary/5' : ''
      }`} 
      ref={reactFlowWrapper}
    >
      {/* Drop Zone Indicator */}
      {isDraggingOver && (
        <div className="absolute inset-0 pointer-events-none z-50">
          <div className="h-full w-full border-2 border-dashed border-accent-primary/50 rounded-lg">
            <div className="flex items-center justify-center h-full">
              <div className="bg-bg-secondary/90 backdrop-blur px-6 py-3 rounded-lg border border-accent-primary shadow-lg shadow-accent-glow/30">
                <p className="text-accent-primary font-semibold animate-pulse">
                  Drop here to add agent
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Drop Position Indicator */}
      {dropPosition && isDraggingOver && (
        <div 
          className="absolute w-32 h-32 pointer-events-none z-40"
          style={{
            left: dropPosition.x - 64,
            top: dropPosition.y - 64,
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
            animation: 'pulse 1.5s infinite',
          }}
        />
      )}
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
        className="bg-bg-primary custom-scrollbar"
        minZoom={0.05}
        maxZoom={8}
        connectionLineStyle={{ 
          stroke: '#3B82F6', 
          strokeWidth: 3,
          strokeDasharray: '8 4',
          filter: 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.5))',
        }}
        defaultEdgeOptions={{
          style: { 
            stroke: '#404040', 
            strokeWidth: 2.5,
            opacity: 0.8,
            filter: 'drop-shadow(0 0 3px rgba(64, 64, 64, 0.8))',
          },
          animated: true,
          type: 'smoothstep',
          markerEnd: {
            type: 'arrowclosed',
            width: 12,
            height: 12,
            color: '#404040',
          },
        }}
      >
        {showGrid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={25}
            size={1.5}
            className="bg-bg-primary"
            color="#333333"
            style={{
              backgroundImage: `
                radial-gradient(circle at 1px 1px, #333333 1.5px, transparent 0),
                linear-gradient(to right, rgba(51, 51, 51, 0.1) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(51, 51, 51, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: '25px 25px, 25px 25px, 25px 25px',
            }}
          />
        )}
        <Controls
          className="bg-glass backdrop-blur-xl border-glass-border rounded-lg shadow-glass"
          position="bottom-right"
          showInteractive={false}
        />
        {showMinimap && (
          <MiniMap
            className="bg-glass backdrop-blur-xl border-glass-border rounded-lg shadow-glass overflow-hidden"
            maskColor="rgba(59, 130, 246, 0.15)"
            nodeColor={(node) => {
              const categoryColors: Record<string, string> = {
                setup: '#10B981',
                execution: '#3B82F6', 
                testing: '#F59E0B',
                integration: '#8B5CF6',
                review: '#EF4444',
                summary: '#6B7280',
              }
              return categoryColors[node.type || 'default'] || '#666'
            }}
            position="top-right"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
            }}
          />
        )}
      </ReactFlow>

      {/* Floating Toolbar */}
      <FloatingToolbar
        isRunning={isRunning}
        onRun={handleRun}
        onStop={handleStop}
        onExport={handleExport}
        onImport={handleImport}
        onSave={handleSave}
        onFitView={handleFitView}
        onFullscreen={handleFullscreen}
        onReset={handleReset}
        isFullscreen={isFullscreen}
        nodeCount={nodes.length}
        edgeCount={edges.length}
        executionProgress={executionProgress}
      />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={
            contextMenu.type === 'node' && contextMenu.targetId
              ? createNodeContextMenu(
                  contextMenu.targetId,
                  () => {
                    const node = nodes.find(n => n.id === contextMenu.targetId)
                    if (node) openEditModal(node)
                  },
                  () => {
                    if (contextMenu.targetId) duplicateNode(contextMenu.targetId)
                  },
                  () => {
                    if (contextMenu.targetId) deleteNode(contextMenu.targetId)
                  },
                  () => {
                    // TODO: Run from specific node
                    handleRun()
                  },
                  handleStop,
                  isRunning
                )
              : contextMenu.type === 'canvas'
              ? createCanvasContextMenu(
                  undefined, // onPaste
                  () => {
                    // Select all nodes
                    nodes.forEach(node => selectNode(node.id))
                  },
                  () => {
                    clearFlow()
                  },
                  false, // hasPaste
                  nodes.length > 0
                )
              : []
          }
        />
      )}
      
      {/* Notification System */}
      <NotificationSystem 
        notifications={notifications}
        onRemove={removeNotification}
      />
    </div>
  )
}

export default function FlowEditor() {
  const onDragStart = useCallback((event: React.DragEvent, agent: AgentConfig) => {
    event.dataTransfer.setData('application/agent', JSON.stringify(agent))
    event.dataTransfer.effectAllowed = 'move'
  }, [])
  
  return (
    <ReactFlowProvider>
      <FlowEditorContent onDragStart={onDragStart} />
    </ReactFlowProvider>
  )
}

function FlowEditorContent({ onDragStart }: { onDragStart: (event: React.DragEvent, agent: AgentConfig) => void }) {
  const [showPropertyPanel, setShowPropertyPanel] = useState(false)
  
  const {
    nodes,
    selectedNode,
    updateNode,
  } = useFlowStore()
  
  return (
    <div className="flex h-screen bg-bg-primary relative overflow-hidden">
      {/* Desktop: Show AgentLibrary normally */}
      {/* Mobile: AgentLibrary will handle its own positioning */}
      <AgentLibrary onDragStart={onDragStart} />
      <FlowCanvas />
      <NodeEditModal />
      <PropertyPanel 
        selectedNode={selectedNode ? nodes.find(n => n.id === selectedNode) || null : null}
        isOpen={showPropertyPanel && !!selectedNode}
        onClose={() => setShowPropertyPanel(false)}
        onUpdateNode={(nodeId, updates) => updateNode(nodeId, updates)}
      />
    </div>
  )
}