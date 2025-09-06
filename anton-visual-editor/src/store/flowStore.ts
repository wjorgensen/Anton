import { create } from 'zustand'
import { Node, Edge, addEdge, Connection, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from '@xyflow/react'
import { AgentConfig, FlowNode } from '@/types/agent'
import { autoLayout, forceDirectedLayout, snapToGrid, centerNodes, LayoutOptions } from '@/utils/autoLayout'

interface FlowState {
  nodes: Node[]
  edges: Edge[]
  selectedNode: string | null
  selectedNodes: string[]
  isEditModalOpen: boolean
  editingNode: Node | null
  isMultiSelecting: boolean
  selectionBox: { startX: number; startY: number; endX: number; endY: number } | null
  clipboard: Node[]
  
  // Actions
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addNode: (agent: AgentConfig, position: { x: number; y: number }) => string
  updateNode: (id: string, data: Partial<Node['data']>) => void
  deleteNode: (id: string) => void
  duplicateNode: (id: string) => void
  selectNode: (id: string | null) => void
  selectMultipleNodes: (ids: string[]) => void
  toggleNodeSelection: (id: string) => void
  clearSelection: () => void
  copyNodes: (nodeIds: string[]) => void
  pasteNodes: (position?: { x: number; y: number }) => void
  deleteSelectedNodes: () => void
  openEditModal: (node: Node) => void
  closeEditModal: () => void
  updateEditingNode: (data: Partial<Node['data']>) => void
  saveEditingNode: () => void
  startSelectionBox: (x: number, y: number) => void
  updateSelectionBox: (x: number, y: number) => void
  endSelectionBox: () => void
  clearFlow: () => void
  applyAutoLayout: (options?: LayoutOptions) => void
  applyForceLayout: (iterations?: number) => void
  snapNodesToGrid: (gridSize?: number) => void
  centerAllNodes: () => void
  alignNodes: (nodeIds: string[], alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void
  distributeNodes: (nodeIds: string[], direction: 'horizontal' | 'vertical') => void
  loadGeneratedFlow: (projectData: any) => void
}

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  selectedNodes: [],
  isEditModalOpen: false,
  editingNode: null,
  isMultiSelecting: false,
  selectionBox: null,
  clipboard: [],

  setNodes: (nodes) => set({ nodes }),
  
  setEdges: (edges) => set({ edges }),
  
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    })
  },
  
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    })
  },
  
  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
    })
  },
  
  addNode: (agent, position) => {
    const id = `${agent.id}-${Date.now()}`
    const newNode: Node = {
      id,
      type: agent.category,
      position,
      data: {
        agent,
        label: agent.name,
        instructions: agent.instructions.base,
        claudeMD: agent.claudeMD,
        status: 'pending',
        inputs: {},
        outputs: {},
        config: {
          retryOnFailure: true,
          maxRetries: 3,
          timeout: 300,
          requiresReview: false,
        },
      },
    }
    
    set({
      nodes: [...get().nodes, newNode],
    })
    
    return id
  },
  
  updateNode: (id, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    })
  },
  
  deleteNode: (id) => {
    set({
      nodes: get().nodes.filter((node) => node.id !== id),
      edges: get().edges.filter(
        (edge) => edge.source !== id && edge.target !== id
      ),
      selectedNode: get().selectedNode === id ? null : get().selectedNode,
      selectedNodes: get().selectedNodes.filter(nodeId => nodeId !== id),
    })
  },
  
  duplicateNode: (id) => {
    const nodeToClone = get().nodes.find(node => node.id === id)
    if (nodeToClone) {
      const newId = `${nodeToClone.data.agent.id}-${Date.now()}`
      const newNode: Node = {
        ...nodeToClone,
        id: newId,
        position: {
          x: nodeToClone.position.x + 50,
          y: nodeToClone.position.y + 50,
        },
        data: {
          ...nodeToClone.data,
          label: `${nodeToClone.data.label} (Copy)`,
        },
      }
      set({
        nodes: [...get().nodes, newNode],
      })
    }
  },
  
  selectNode: (id) => set({ 
    selectedNode: id, 
    selectedNodes: id ? [id] : [],
  }),
  
  selectMultipleNodes: (ids) => set({
    selectedNodes: ids,
    selectedNode: ids.length === 1 ? ids[0] : null,
  }),
  
  toggleNodeSelection: (id) => {
    const current = get().selectedNodes
    const isSelected = current.includes(id)
    const newSelection = isSelected 
      ? current.filter(nodeId => nodeId !== id)
      : [...current, id]
    
    set({
      selectedNodes: newSelection,
      selectedNode: newSelection.length === 1 ? newSelection[0] : null,
    })
  },
  
  clearSelection: () => set({
    selectedNode: null,
    selectedNodes: [],
  }),
  
  copyNodes: (nodeIds) => {
    const nodesToCopy = get().nodes.filter(node => nodeIds.includes(node.id))
    set({ clipboard: nodesToCopy })
  },
  
  pasteNodes: (position = { x: 100, y: 100 }) => {
    const clipboard = get().clipboard
    if (clipboard.length === 0) return
    
    const newNodes = clipboard.map((node, index) => {
      const newId = `${node.data.agent.id}-${Date.now()}-${index}`
      return {
        ...node,
        id: newId,
        position: {
          x: position.x + (index * 50),
          y: position.y + (index * 50),
        },
        data: {
          ...node.data,
          label: `${node.data.label} (Paste)`,
        },
      }
    })
    
    set({
      nodes: [...get().nodes, ...newNodes],
      selectedNodes: newNodes.map(node => node.id),
    })
  },
  
  deleteSelectedNodes: () => {
    const selectedIds = get().selectedNodes
    set({
      nodes: get().nodes.filter(node => !selectedIds.includes(node.id)),
      edges: get().edges.filter(
        edge => !selectedIds.includes(edge.source) && !selectedIds.includes(edge.target)
      ),
      selectedNode: null,
      selectedNodes: [],
    })
  },
  
  startSelectionBox: (x, y) => set({
    isMultiSelecting: true,
    selectionBox: { startX: x, startY: y, endX: x, endY: y },
  }),
  
  updateSelectionBox: (x, y) => {
    const current = get().selectionBox
    if (current) {
      set({
        selectionBox: { ...current, endX: x, endY: y },
      })
    }
  },
  
  endSelectionBox: () => {
    const box = get().selectionBox
    if (box) {
      // Find nodes within selection box
      const selectedIds = get().nodes
        .filter(node => {
          const nodeRect = {
            x: node.position.x,
            y: node.position.y,
            width: 200, // Approximate node width
            height: 120, // Approximate node height
          }
          
          const selectionRect = {
            x: Math.min(box.startX, box.endX),
            y: Math.min(box.startY, box.endY),
            width: Math.abs(box.endX - box.startX),
            height: Math.abs(box.endY - box.startY),
          }
          
          return (
            nodeRect.x < selectionRect.x + selectionRect.width &&
            nodeRect.x + nodeRect.width > selectionRect.x &&
            nodeRect.y < selectionRect.y + selectionRect.height &&
            nodeRect.y + nodeRect.height > selectionRect.y
          )
        })
        .map(node => node.id)
      
      get().selectMultipleNodes(selectedIds)
    }
    
    set({
      isMultiSelecting: false,
      selectionBox: null,
    })
  },

  clearFlow: () => set({
    nodes: [],
    edges: [],
    selectedNode: null,
    selectedNodes: [],
  }),
  
  applyAutoLayout: (options) => {
    const { nodes, edges } = get()
    const { nodes: layoutedNodes } = autoLayout(nodes, edges, options)
    set({ nodes: layoutedNodes })
  },
  
  applyForceLayout: (iterations = 100) => {
    const { nodes, edges } = get()
    const layoutedNodes = forceDirectedLayout(nodes, edges, iterations)
    set({ nodes: layoutedNodes })
  },
  
  snapNodesToGrid: (gridSize = 25) => {
    const { nodes } = get()
    const snappedNodes = snapToGrid(nodes, gridSize)
    set({ nodes: snappedNodes })
  },
  
  centerAllNodes: () => {
    const { nodes } = get()
    const centeredNodes = centerNodes(nodes)
    set({ nodes: centeredNodes })
  },
  
  alignNodes: (nodeIds, alignment) => {
    const { nodes } = get()
    const selectedNodeObjects = nodes.filter(node => nodeIds.includes(node.id))
    if (selectedNodeObjects.length < 2) return
    
    let referenceValue: number
    
    switch (alignment) {
      case 'left':
        referenceValue = Math.min(...selectedNodeObjects.map(node => node.position.x))
        selectedNodeObjects.forEach(node => {
          node.position.x = referenceValue
        })
        break
      case 'center':
        const avgX = selectedNodeObjects.reduce((sum, node) => sum + node.position.x, 0) / selectedNodeObjects.length
        selectedNodeObjects.forEach(node => {
          node.position.x = avgX
        })
        break
      case 'right':
        referenceValue = Math.max(...selectedNodeObjects.map(node => node.position.x))
        selectedNodeObjects.forEach(node => {
          node.position.x = referenceValue
        })
        break
      case 'top':
        referenceValue = Math.min(...selectedNodeObjects.map(node => node.position.y))
        selectedNodeObjects.forEach(node => {
          node.position.y = referenceValue
        })
        break
      case 'middle':
        const avgY = selectedNodeObjects.reduce((sum, node) => sum + node.position.y, 0) / selectedNodeObjects.length
        selectedNodeObjects.forEach(node => {
          node.position.y = avgY
        })
        break
      case 'bottom':
        referenceValue = Math.max(...selectedNodeObjects.map(node => node.position.y))
        selectedNodeObjects.forEach(node => {
          node.position.y = referenceValue
        })
        break
    }
    
    set({ nodes: [...nodes] })
  },
  
  distributeNodes: (nodeIds, direction) => {
    const { nodes } = get()
    const selectedNodeObjects = nodes.filter(node => nodeIds.includes(node.id))
    if (selectedNodeObjects.length < 3) return
    
    selectedNodeObjects.sort((a, b) => 
      direction === 'horizontal' ? a.position.x - b.position.x : a.position.y - b.position.y
    )
    
    const first = selectedNodeObjects[0]
    const last = selectedNodeObjects[selectedNodeObjects.length - 1]
    
    const totalDistance = direction === 'horizontal' 
      ? last.position.x - first.position.x
      : last.position.y - first.position.y
    
    const step = totalDistance / (selectedNodeObjects.length - 1)
    
    selectedNodeObjects.forEach((node, index) => {
      if (index > 0 && index < selectedNodeObjects.length - 1) {
        if (direction === 'horizontal') {
          node.position.x = first.position.x + (step * index)
        } else {
          node.position.y = first.position.y + (step * index)
        }
      }
    })
    
    set({ nodes: [...nodes] })
  },
  
  openEditModal: (node) => {
    set({
      isEditModalOpen: true,
      editingNode: JSON.parse(JSON.stringify(node)), // Deep clone
    })
  },
  
  closeEditModal: () => {
    set({
      isEditModalOpen: false,
      editingNode: null,
    })
  },
  
  updateEditingNode: (data) => {
    const current = get().editingNode
    if (current) {
      set({
        editingNode: {
          ...current,
          data: { ...current.data, ...data },
        },
      })
    }
  },
  
  saveEditingNode: () => {
    const editingNode = get().editingNode
    if (editingNode) {
      get().updateNode(editingNode.id, editingNode.data)
      get().closeEditModal()
    }
  },
  
  loadGeneratedFlow: (projectData) => {
    // Create sample nodes for testing
    const sampleNodes: Node[] = [
      {
        id: 'planner-1',
        type: 'setup',
        position: { x: 100, y: 100 },
        data: {
          agent: { 
            id: 'planner', 
            name: 'Project Planner', 
            category: 'setup', 
            icon: '📋',
            inputs: [],
            outputs: ['requirements'],
            description: 'Set up project structure and requirements'
          },
          label: 'Project Planner',
          instructions: 'Set up project structure and requirements',
          claudeMD: '',
          status: 'pending',
          inputs: {},
          outputs: {},
          config: { retryOnFailure: true, maxRetries: 3, timeout: 300, requiresReview: false }
        }
      },
      {
        id: 'api-1',
        type: 'execution',
        position: { x: 300, y: 100 },
        data: {
          agent: { 
            id: 'api-dev', 
            name: 'API Developer', 
            category: 'execution', 
            icon: '🔌',
            inputs: ['requirements'],
            outputs: ['api'],
            description: 'Build REST API endpoints'
          },
          label: 'API Developer',
          instructions: 'Build REST API endpoints',
          claudeMD: '',
          status: 'pending',
          inputs: {},
          outputs: {},
          config: { retryOnFailure: true, maxRetries: 3, timeout: 300, requiresReview: false }
        }
      },
      {
        id: 'auth-1',
        type: 'execution',
        position: { x: 500, y: 100 },
        data: {
          agent: { 
            id: 'auth-dev', 
            name: 'Auth Developer', 
            category: 'execution', 
            icon: '🔒',
            inputs: ['api'],
            outputs: ['auth'],
            description: 'Implement authentication system'
          },
          label: 'Auth Developer',
          instructions: 'Implement authentication system',
          claudeMD: '',
          status: 'pending',
          inputs: {},
          outputs: {},
          config: { retryOnFailure: true, maxRetries: 3, timeout: 300, requiresReview: false }
        }
      },
      {
        id: 'database-1',
        type: 'setup',
        position: { x: 100, y: 250 },
        data: {
          agent: { 
            id: 'db-setup', 
            name: 'Database Setup', 
            category: 'setup', 
            icon: '💾',
            inputs: ['requirements'],
            outputs: ['database'],
            description: 'Set up database schema and connections'
          },
          label: 'Database Setup',
          instructions: 'Set up database schema and connections',
          claudeMD: '',
          status: 'pending',
          inputs: {},
          outputs: {},
          config: { retryOnFailure: true, maxRetries: 3, timeout: 300, requiresReview: false }
        }
      },
      {
        id: 'frontend-1',
        type: 'execution',
        position: { x: 300, y: 250 },
        data: {
          agent: { 
            id: 'frontend-dev', 
            name: 'Frontend Developer', 
            category: 'execution', 
            icon: '🎨',
            inputs: ['database'],
            outputs: ['frontend'],
            description: 'Build user interface components'
          },
          label: 'Frontend Developer',
          instructions: 'Build user interface components',
          claudeMD: '',
          status: 'pending',
          inputs: {},
          outputs: {},
          config: { retryOnFailure: true, maxRetries: 3, timeout: 300, requiresReview: false }
        }
      },
      {
        id: 'testing-1',
        type: 'testing',
        position: { x: 500, y: 250 },
        data: {
          agent: { 
            id: 'tester', 
            name: 'Test Engineer', 
            category: 'testing', 
            icon: '🧪',
            inputs: ['frontend'],
            outputs: ['tests'],
            description: 'Write and run automated tests'
          },
          label: 'Test Engineer',
          instructions: 'Write and run automated tests',
          claudeMD: '',
          status: 'pending',
          inputs: {},
          outputs: {},
          config: { retryOnFailure: true, maxRetries: 3, timeout: 300, requiresReview: false }
        }
      },
      {
        id: 'integration-1',
        type: 'integration',
        position: { x: 700, y: 100 },
        data: {
          agent: { 
            id: 'integrator', 
            name: 'Integration Specialist', 
            category: 'integration', 
            icon: '🔗',
            inputs: ['auth'],
            outputs: ['integration'],
            description: 'Integrate all components together'
          },
          label: 'Integration Specialist',
          instructions: 'Integrate all components together',
          claudeMD: '',
          status: 'pending',
          inputs: {},
          outputs: {},
          config: { retryOnFailure: true, maxRetries: 3, timeout: 300, requiresReview: false }
        }
      },
      {
        id: 'review-1',
        type: 'review',
        position: { x: 700, y: 250 },
        data: {
          agent: { 
            id: 'reviewer', 
            name: 'Code Reviewer', 
            category: 'review', 
            icon: '👀',
            inputs: ['tests', 'integration'],
            outputs: ['review'],
            description: 'Review code quality and standards'
          },
          label: 'Code Reviewer',
          instructions: 'Review code quality and standards',
          claudeMD: '',
          status: 'pending',
          inputs: {},
          outputs: {},
          config: { retryOnFailure: true, maxRetries: 3, timeout: 300, requiresReview: false }
        }
      }
    ];

    const sampleEdges: Edge[] = [
      { id: 'e1', source: 'planner-1', target: 'api-1', type: 'default' },
      { id: 'e2', source: 'planner-1', target: 'database-1', type: 'default' },
      { id: 'e3', source: 'api-1', target: 'auth-1', type: 'default' },
      { id: 'e4', source: 'database-1', target: 'frontend-1', type: 'default' },
      { id: 'e5', source: 'auth-1', target: 'integration-1', type: 'default' },
      { id: 'e6', source: 'frontend-1', target: 'testing-1', type: 'default' },
      { id: 'e7', source: 'testing-1', target: 'review-1', type: 'default' },
      { id: 'e8', source: 'integration-1', target: 'review-1', type: 'default' },
    ];

    set({
      nodes: sampleNodes,
      edges: sampleEdges
    });
  },
}))