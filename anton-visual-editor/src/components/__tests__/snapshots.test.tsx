import React from 'react'
import { render } from '@testing-library/react'
import FlowEditor from '../FlowEditor'
import AgentLibrary from '../AgentLibrary'
import NodeEditModal from '../NodeEditModal'
import PreviewManager from '../PreviewManager'
import BaseNode from '../nodes/BaseNode'
import ReviewNode from '../nodes/ReviewNode'
import { useFlowStore } from '@/store/flowStore'
import { useAgents } from '@/hooks/useAgents'
import { useWebSocket } from '@/hooks/useWebSocket'

// Mock stores and hooks
jest.mock('@/store/flowStore')
jest.mock('@/hooks/useAgents')
jest.mock('@/hooks/useWebSocket')

describe('Component Snapshots', () => {
  const mockUseFlowStore = useFlowStore as jest.MockedFunction<typeof useFlowStore>
  const mockUseAgents = useAgents as jest.MockedFunction<typeof useAgents>
  const mockUseWebSocket = useWebSocket as jest.MockedFunction<typeof useWebSocket>
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mocks
    mockUseFlowStore.mockReturnValue({
      nodes: [
        {
          id: 'node-1',
          type: 'execution',
          position: { x: 100, y: 100 },
          data: {
            label: 'Test Node',
            agentConfig: {
              id: 'test-agent',
              name: 'Test Agent',
              category: 'execution',
              description: 'Test description',
            },
          },
        },
      ],
      edges: [],
      editingNode: null,
      selectedNode: null,
      onNodesChange: jest.fn(),
      onEdgesChange: jest.fn(),
      onConnect: jest.fn(),
      addNode: jest.fn(),
      deleteNode: jest.fn(),
      selectNode: jest.fn(),
      openEditModal: jest.fn(),
      closeEditModal: jest.fn(),
      updateNode: jest.fn(),
      duplicateNode: jest.fn(),
      clearFlow: jest.fn(),
    })
    
    mockUseAgents.mockReturnValue({
      agents: [
        {
          id: 'agent-1',
          name: 'Sample Agent',
          category: 'setup',
          type: 'setup',
          version: '1.0.0',
          description: 'Sample agent for testing',
          icon: '🤖',
          color: '#3B82F6',
          instructions: { base: 'Test', contextual: 'Test' },
          inputs: [],
          outputs: [],
          tags: ['test'],
        },
      ],
      loading: false,
      error: null,
      getAgentsByCategory: jest.fn(),
      getAgentById: jest.fn(),
    })
    
    mockUseWebSocket.mockReturnValue({
      connected: true,
      connecting: false,
      error: null,
      nodeUpdates: {},
      previewData: {
        terminal: {
          nodeId: 'node-1',
          output: 'Sample terminal output',
          timestamp: new Date().toISOString(),
        },
      },
      subscribeToExecution: jest.fn(),
      subscribeToProject: jest.fn(),
      reconnect: jest.fn(),
    })
  })

  describe('FlowEditor Snapshots', () => {
    it('matches snapshot with empty flow', () => {
      mockUseFlowStore.mockReturnValue({
        ...mockUseFlowStore(),
        nodes: [],
        edges: [],
      })
      
      const { container } = render(<FlowEditor />)
      expect(container.firstChild).toMatchSnapshot()
    })

    it('matches snapshot with nodes and edges', () => {
      mockUseFlowStore.mockReturnValue({
        ...mockUseFlowStore(),
        nodes: [
          {
            id: 'node-1',
            type: 'execution',
            position: { x: 100, y: 100 },
            data: { label: 'Node 1', agentConfig: { name: 'Agent 1' } },
          },
          {
            id: 'node-2',
            type: 'review',
            position: { x: 300, y: 100 },
            data: { label: 'Node 2', agentConfig: { name: 'Agent 2' } },
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-1', target: 'node-2' },
        ],
      })
      
      const { container } = render(<FlowEditor />)
      expect(container.firstChild).toMatchSnapshot()
    })

    it('matches snapshot with selected node', () => {
      mockUseFlowStore.mockReturnValue({
        ...mockUseFlowStore(),
        selectedNode: 'node-1',
      })
      
      const { container } = render(<FlowEditor />)
      expect(container.firstChild).toMatchSnapshot()
    })
  })

  describe('AgentLibrary Snapshots', () => {
    it('matches snapshot with agents', () => {
      const mockOnDragStart = jest.fn()
      const { container } = render(<AgentLibrary onDragStart={mockOnDragStart} />)
      expect(container.firstChild).toMatchSnapshot()
    })

    it('matches snapshot while loading', () => {
      mockUseAgents.mockReturnValue({
        ...mockUseAgents(),
        agents: [],
        loading: true,
      })
      
      const mockOnDragStart = jest.fn()
      const { container } = render(<AgentLibrary onDragStart={mockOnDragStart} />)
      expect(container.firstChild).toMatchSnapshot()
    })

    it('matches snapshot with error state', () => {
      mockUseAgents.mockReturnValue({
        ...mockUseAgents(),
        agents: [],
        error: 'Failed to load agents',
      })
      
      const mockOnDragStart = jest.fn()
      const { container } = render(<AgentLibrary onDragStart={mockOnDragStart} />)
      expect(container.firstChild).toMatchSnapshot()
    })
  })

  describe('Node Component Snapshots', () => {
    it('BaseNode matches snapshot', () => {
      const props = {
        id: 'base-1',
        data: {
          label: 'Base Node',
          agentConfig: {
            name: 'Base Agent',
            description: 'Base agent description',
            category: 'setup',
            icon: '⚙️',
          },
        },
        selected: false,
        categoryColor: '#3B82F6',
      }
      
      const { container } = render(<BaseNode {...props} />)
      expect(container.firstChild).toMatchSnapshot()
    })

    it('BaseNode matches snapshot when selected', () => {
      const props = {
        id: 'base-1',
        data: {
          label: 'Base Node',
          agentConfig: {
            name: 'Base Agent',
            description: 'Base agent description',
            category: 'setup',
            icon: '⚙️',
          },
        },
        selected: true,
        categoryColor: '#3B82F6',
      }
      
      const { container } = render(<BaseNode {...props} />)
      expect(container.firstChild).toMatchSnapshot()
    })

    it('ReviewNode matches snapshot in pending state', () => {
      const props = {
        id: 'review-1',
        data: {
          label: 'Review Node',
          agentConfig: {
            name: 'Review Agent',
            description: 'Review agent description',
          },
          status: 'pending' as const,
          reviewScope: 'full' as const,
          requiresApproval: true,
        },
        selected: false,
      }
      
      const { container } = render(<ReviewNode {...props} />)
      expect(container.firstChild).toMatchSnapshot()
    })

    it('ReviewNode matches snapshot in approved state', () => {
      const props = {
        id: 'review-1',
        data: {
          label: 'Review Node',
          agentConfig: {
            name: 'Review Agent',
            description: 'Review agent description',
          },
          status: 'approved' as const,
          reviewScope: 'changes' as const,
          feedback: [
            {
              id: 'feedback-1',
              message: 'Looks good!',
              severity: 'info' as const,
              timestamp: new Date().toISOString(),
            },
          ],
        },
        selected: false,
      }
      
      const { container } = render(<ReviewNode {...props} />)
      expect(container.firstChild).toMatchSnapshot()
    })
  })

  describe('NodeEditModal Snapshots', () => {
    it('matches snapshot when open', () => {
      mockUseFlowStore.mockReturnValue({
        ...mockUseFlowStore(),
        editingNode: {
          id: 'node-1',
          type: 'execution',
          position: { x: 100, y: 100 },
          data: {
            label: 'Edit Node',
            agentConfig: {
              id: 'agent-1',
              name: 'Edit Agent',
              description: 'Agent being edited',
              inputs: [
                { name: 'input1', type: 'string', required: true },
                { name: 'input2', type: 'number', required: false },
              ],
              outputs: [
                { name: 'output1', type: 'string' },
              ],
            },
            inputs: { input1: 'test' },
            timeout: 30000,
          },
        },
      })
      
      const { container } = render(<NodeEditModal />)
      expect(container.firstChild).toMatchSnapshot()
    })

    it('matches snapshot when closed', () => {
      mockUseFlowStore.mockReturnValue({
        ...mockUseFlowStore(),
        editingNode: null,
      })
      
      const { container } = render(<NodeEditModal />)
      expect(container.firstChild).toMatchSnapshot()
    })
  })

  describe('PreviewManager Snapshots', () => {
    it('matches snapshot with terminal output', () => {
      const { container } = render(<PreviewManager executionId="exec-1" />)
      expect(container.firstChild).toMatchSnapshot()
    })

    it('matches snapshot with web preview', () => {
      mockUseWebSocket.mockReturnValue({
        ...mockUseWebSocket(),
        previewData: {
          web: {
            nodeId: 'node-1',
            url: 'http://localhost:3000',
            html: '<html><body>Preview</body></html>',
            timestamp: new Date().toISOString(),
          },
        },
      })
      
      const { container } = render(<PreviewManager executionId="exec-1" />)
      expect(container.firstChild).toMatchSnapshot()
    })

    it('matches snapshot when disconnected', () => {
      mockUseWebSocket.mockReturnValue({
        ...mockUseWebSocket(),
        connected: false,
        error: 'Connection failed',
      })
      
      const { container } = render(<PreviewManager executionId="exec-1" />)
      expect(container.firstChild).toMatchSnapshot()
    })
  })

  describe('Dark Theme Snapshots', () => {
    beforeEach(() => {
      document.documentElement.classList.add('dark')
    })

    afterEach(() => {
      document.documentElement.classList.remove('dark')
    })

    it('FlowEditor matches dark theme snapshot', () => {
      const { container } = render(<FlowEditor />)
      expect(container.firstChild).toMatchSnapshot()
    })

    it('AgentLibrary matches dark theme snapshot', () => {
      const mockOnDragStart = jest.fn()
      const { container } = render(<AgentLibrary onDragStart={mockOnDragStart} />)
      expect(container.firstChild).toMatchSnapshot()
    })

    it('BaseNode matches dark theme snapshot', () => {
      const props = {
        id: 'base-1',
        data: {
          label: 'Base Node',
          agentConfig: {
            name: 'Base Agent',
            description: 'Base agent description',
            category: 'setup',
            icon: '⚙️',
          },
        },
        selected: false,
        categoryColor: '#3B82F6',
      }
      
      const { container } = render(<BaseNode {...props} />)
      expect(container.firstChild).toMatchSnapshot()
    })
  })
})