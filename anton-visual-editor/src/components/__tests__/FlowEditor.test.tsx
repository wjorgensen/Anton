import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FlowEditor from '../FlowEditor'
import { useFlowStore } from '@/store/flowStore'
import { AgentConfig } from '@/types/agent'

// Mock the store
jest.mock('@/store/flowStore')

// Mock components that are tested separately
jest.mock('../AgentLibrary', () => {
  return jest.fn(({ onDragStart }) => (
    <div data-testid="agent-library">
      <div
        data-testid="draggable-agent"
        draggable
        onDragStart={(e) => {
          const mockAgent: AgentConfig = {
            id: 'test-agent',
            name: 'Test Agent',
            icon: '🤖',
            description: 'Test description',
            category: 'setup',
            inputs: [],
            outputs: [],
            tags: ['test'],
          }
          onDragStart(e, mockAgent)
        }}
      >
        Test Agent
      </div>
    </div>
  ))
})

jest.mock('../NodeEditModal', () => {
  return jest.fn(() => <div data-testid="node-edit-modal">Modal</div>)
})

const mockFlowStore = {
  nodes: [],
  edges: [],
  onNodesChange: jest.fn(),
  onEdgesChange: jest.fn(),
  onConnect: jest.fn(),
  addNode: jest.fn(),
  deleteNode: jest.fn(),
  selectNode: jest.fn(),
  openEditModal: jest.fn(),
  selectedNode: null,
}

describe('FlowEditor', () => {
  beforeEach(() => {
    ;(useFlowStore as unknown as jest.Mock).mockReturnValue(mockFlowStore)
    jest.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders the main flow editor components', () => {
      render(<FlowEditor />)

      expect(screen.getByTestId('react-flow-provider')).toBeInTheDocument()
      expect(screen.getByTestId('agent-library')).toBeInTheDocument()
      expect(screen.getByTestId('react-flow')).toBeInTheDocument()
      expect(screen.getByTestId('node-edit-modal')).toBeInTheDocument()
    })

    it('renders background with correct color #000000', () => {
      render(<FlowEditor />)
      
      const background = screen.getByTestId('react-flow-background')
      expect(background).toBeInTheDocument()
    })

    it('renders controls and minimap', () => {
      render(<FlowEditor />)

      expect(screen.getByTestId('react-flow-controls')).toBeInTheDocument()
      expect(screen.getByTestId('react-flow-minimap')).toBeInTheDocument()
    })

    it('renders control panel with correct buttons', () => {
      render(<FlowEditor />)

      const panels = screen.getAllByTestId('react-flow-panel')
      const controlPanel = panels[0]

      expect(within(controlPanel).getByText('Run')).toBeInTheDocument()
      expect(within(controlPanel).getByTitle('Delete selected node')).toBeInTheDocument()
      expect(within(controlPanel).getByTitle('Export flow')).toBeInTheDocument()
      expect(within(controlPanel).getByTitle('Import flow')).toBeInTheDocument()
    })

    it('renders status bar with node and edge counts', () => {
      render(<FlowEditor />)

      const panels = screen.getAllByTestId('react-flow-panel')
      const statusBar = panels[1]

      expect(within(statusBar).getByText('Nodes: 0')).toBeInTheDocument()
      expect(within(statusBar).getByText('Edges: 0')).toBeInTheDocument()
    })
  })

  describe('Drag and Drop Functionality', () => {
    it('initiates drag from agent library', () => {
      render(<FlowEditor />)

      const draggableAgent = screen.getByTestId('draggable-agent')
      const dragStartEvent = new Event('dragstart', { bubbles: true }) as any
      dragStartEvent.dataTransfer = {
        setData: jest.fn(),
        effectAllowed: '',
      }

      fireEvent(draggableAgent, dragStartEvent)

      expect(dragStartEvent.dataTransfer.setData).toHaveBeenCalledWith(
        'application/agent',
        expect.stringContaining('Test Agent')
      )
      expect(dragStartEvent.dataTransfer.effectAllowed).toBe('move')
    })

    it('handles drop event on canvas', () => {
      render(<FlowEditor />)

      const reactFlow = screen.getByTestId('react-flow')
      
      // Simulate drag over
      const dragOverEvent = new Event('dragover', { bubbles: true }) as any
      dragOverEvent.preventDefault = jest.fn()
      dragOverEvent.dataTransfer = { dropEffect: '' }
      
      fireEvent(reactFlow, dragOverEvent)
      expect(dragOverEvent.preventDefault).toHaveBeenCalled()
      expect(dragOverEvent.dataTransfer.dropEffect).toBe('move')

      // Simulate drop
      const mockAgent: AgentConfig = {
        id: 'test-agent',
        name: 'Test Agent',
        icon: '🤖',
        description: 'Test description',
        category: 'setup',
        inputs: [],
        outputs: [],
        tags: ['test'],
      }

      const dropEvent = new Event('drop', { bubbles: true }) as any
      dropEvent.preventDefault = jest.fn()
      dropEvent.clientX = 100
      dropEvent.clientY = 200
      dropEvent.dataTransfer = {
        getData: jest.fn(() => JSON.stringify(mockAgent)),
      }

      fireEvent(reactFlow, dropEvent)
      
      expect(dropEvent.preventDefault).toHaveBeenCalled()
      expect(mockFlowStore.addNode).toHaveBeenCalledWith(mockAgent, { x: 100, y: 200 })
    })

    it('ignores drop without agent data', () => {
      render(<FlowEditor />)

      const reactFlow = screen.getByTestId('react-flow')
      
      const dropEvent = new Event('drop', { bubbles: true }) as any
      dropEvent.preventDefault = jest.fn()
      dropEvent.dataTransfer = {
        getData: jest.fn(() => ''),
      }

      fireEvent(reactFlow, dropEvent)
      
      expect(dropEvent.preventDefault).toHaveBeenCalled()
      expect(mockFlowStore.addNode).not.toHaveBeenCalled()
    })
  })

  describe('Node Selection and Interaction', () => {
    it('selects node on click', () => {
      render(<FlowEditor />)

      const reactFlow = screen.getByTestId('react-flow')
      const nodeClickHandler = (reactFlow as any).onNodeClick

      const mockNode = { id: 'node-1', data: {} }
      const mockEvent = new MouseEvent('click')

      nodeClickHandler(mockEvent, mockNode)

      expect(mockFlowStore.selectNode).toHaveBeenCalledWith('node-1')
    })

    it('opens edit modal on double click', () => {
      render(<FlowEditor />)

      const reactFlow = screen.getByTestId('react-flow')
      const nodeDoubleClickHandler = (reactFlow as any).onNodeDoubleClick

      const mockNode = { id: 'node-1', data: {} }
      const mockEvent = new MouseEvent('dblclick')

      nodeDoubleClickHandler(mockEvent, mockNode)

      expect(mockFlowStore.openEditModal).toHaveBeenCalledWith(mockNode)
    })

    it('deletes selected node when delete button clicked', () => {
      const selectedStore = {
        ...mockFlowStore,
        selectedNode: 'node-1',
      }
      ;(useFlowStore as unknown as jest.Mock).mockReturnValue(selectedStore)

      render(<FlowEditor />)

      const deleteButton = screen.getByTitle('Delete selected node')
      fireEvent.click(deleteButton)

      expect(selectedStore.deleteNode).toHaveBeenCalledWith('node-1')
      expect(selectedStore.selectNode).toHaveBeenCalledWith(null)
    })

    it('disables delete button when no node selected', () => {
      render(<FlowEditor />)

      const deleteButton = screen.getByTitle('Delete selected node')
      expect(deleteButton).toBeDisabled()
    })
  })

  describe('Flow Execution Controls', () => {
    it('starts flow execution when Run clicked', () => {
      const storeWithNodes = {
        ...mockFlowStore,
        nodes: [{ id: 'node-1' }],
        edges: [{ id: 'edge-1' }],
      }
      ;(useFlowStore as unknown as jest.Mock).mockReturnValue(storeWithNodes)

      render(<FlowEditor />)

      const runButton = screen.getByText('Run')
      fireEvent.click(runButton)

      // Button should change to Stop
      expect(screen.getByText('Stop')).toBeInTheDocument()
      expect(screen.queryByText('Run')).not.toBeInTheDocument()
    })

    it('stops flow execution when Stop clicked', () => {
      const storeWithNodes = {
        ...mockFlowStore,
        nodes: [{ id: 'node-1' }],
      }
      ;(useFlowStore as unknown as jest.Mock).mockReturnValue(storeWithNodes)

      render(<FlowEditor />)

      // Start execution first
      const runButton = screen.getByText('Run')
      fireEvent.click(runButton)

      // Stop execution
      const stopButton = screen.getByText('Stop')
      fireEvent.click(stopButton)

      // Button should change back to Run
      expect(screen.getByText('Run')).toBeInTheDocument()
      expect(screen.queryByText('Stop')).not.toBeInTheDocument()
    })

    it('disables Run button when no nodes present', () => {
      render(<FlowEditor />)

      const runButton = screen.getByText('Run')
      expect(runButton).toBeDisabled()
    })

    it('shows running status in status bar', () => {
      const storeWithNodes = {
        ...mockFlowStore,
        nodes: [{ id: 'node-1' }],
      }
      ;(useFlowStore as unknown as jest.Mock).mockReturnValue(storeWithNodes)

      render(<FlowEditor />)

      const runButton = screen.getByText('Run')
      fireEvent.click(runButton)

      const panels = screen.getAllByTestId('react-flow-panel')
      const statusBar = panels[1]

      expect(within(statusBar).getByText('Running...')).toBeInTheDocument()
    })
  })

  describe('Import/Export Functionality', () => {
    it('exports flow data to JSON file', () => {
      const storeWithData = {
        ...mockFlowStore,
        nodes: [{ id: 'node-1', data: { label: 'Test' } }],
        edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2' }],
      }
      ;(useFlowStore as unknown as jest.Mock).mockReturnValue(storeWithData)

      const createElementSpy = jest.spyOn(document, 'createElement')
      const clickSpy = jest.fn()

      render(<FlowEditor />)

      const exportButton = screen.getByTitle('Export flow')
      
      // Mock link element
      const mockLink = document.createElement('a')
      mockLink.click = clickSpy
      createElementSpy.mockReturnValueOnce(mockLink)

      fireEvent.click(exportButton)

      expect(mockLink.getAttribute('href')).toContain('data:application/json')
      expect(mockLink.getAttribute('download')).toMatch(/flow-\d+\.json/)
      expect(clickSpy).toHaveBeenCalled()

      createElementSpy.mockRestore()
    })

    it('imports flow data from JSON file', () => {
      const createElementSpy = jest.spyOn(document, 'createElement')
      const mockFileReader = {
        readAsText: jest.fn(),
        onload: null as any,
      }
      const FileReaderSpy = jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any)

      render(<FlowEditor />)

      const importButton = screen.getByTitle('Import flow')
      
      // Mock file input
      const mockInput = document.createElement('input')
      const clickSpy = jest.fn()
      mockInput.click = clickSpy
      createElementSpy.mockReturnValueOnce(mockInput)

      fireEvent.click(importButton)

      expect(mockInput.type).toBe('file')
      expect(mockInput.accept).toBe('.json')
      expect(clickSpy).toHaveBeenCalled()

      // Simulate file selection
      const mockFile = new File(['{"nodes":[],"edges":[]}'], 'flow.json', { type: 'application/json' })
      Object.defineProperty(mockInput, 'files', {
        value: [mockFile],
      })

      mockInput.onchange?.({ target: mockInput } as any)

      expect(mockFileReader.readAsText).toHaveBeenCalledWith(mockFile)

      // Simulate file read complete
      mockFileReader.onload?.({ target: { result: '{"nodes":[],"edges":[]}' } } as any)

      createElementSpy.mockRestore()
      FileReaderSpy.mockRestore()
    })

    it('handles invalid JSON during import', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const createElementSpy = jest.spyOn(document, 'createElement')
      const mockFileReader = {
        readAsText: jest.fn(),
        onload: null as any,
      }
      const FileReaderSpy = jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any)

      render(<FlowEditor />)

      const importButton = screen.getByTitle('Import flow')
      const mockInput = document.createElement('input')
      createElementSpy.mockReturnValueOnce(mockInput)

      fireEvent.click(importButton)

      const mockFile = new File(['invalid json'], 'flow.json', { type: 'application/json' })
      Object.defineProperty(mockInput, 'files', {
        value: [mockFile],
      })

      mockInput.onchange?.({ target: mockInput } as any)
      mockFileReader.onload?.({ target: { result: 'invalid json' } } as any)

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to import flow:', expect.any(Error))

      createElementSpy.mockRestore()
      FileReaderSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Connection Management', () => {
    it('handles edge connection events', () => {
      render(<FlowEditor />)

      const reactFlow = screen.getByTestId('react-flow')
      const onConnectHandler = (reactFlow as any).onConnect

      const mockConnection = { source: 'node-1', target: 'node-2' }
      onConnectHandler(mockConnection)

      expect(mockFlowStore.onConnect).toHaveBeenCalledWith(mockConnection)
    })

    it('handles nodes change events', () => {
      render(<FlowEditor />)

      const reactFlow = screen.getByTestId('react-flow')
      const onNodesChangeHandler = (reactFlow as any).onNodesChange

      const changes = [{ type: 'position', id: 'node-1', position: { x: 100, y: 100 } }]
      onNodesChangeHandler(changes)

      expect(mockFlowStore.onNodesChange).toHaveBeenCalledWith(changes)
    })

    it('handles edges change events', () => {
      render(<FlowEditor />)

      const reactFlow = screen.getByTestId('react-flow')
      const onEdgesChangeHandler = (reactFlow as any).onEdgesChange

      const changes = [{ type: 'remove', id: 'edge-1' }]
      onEdgesChangeHandler(changes)

      expect(mockFlowStore.onEdgesChange).toHaveBeenCalledWith(changes)
    })
  })

  describe('Zoom and Pan Controls', () => {
    it('sets correct zoom limits', () => {
      render(<FlowEditor />)

      const reactFlow = screen.getByTestId('react-flow')

      expect(reactFlow).toHaveAttribute('minZoom', '0.1')
      expect(reactFlow).toHaveAttribute('maxZoom', '5')
    })

    it('enables fit view on initial render', () => {
      render(<FlowEditor />)

      const reactFlow = screen.getByTestId('react-flow')
      expect(reactFlow).toHaveAttribute('fitView', 'true')
    })
  })

  describe('Style Validation', () => {
    it('applies correct background color class', () => {
      render(<FlowEditor />)

      const reactFlow = screen.getByTestId('react-flow')
      expect(reactFlow).toHaveClass('bg-bg-primary')
    })

    it('displays selected node in accent color', () => {
      const selectedStore = {
        ...mockFlowStore,
        selectedNode: 'node-1',
      }
      ;(useFlowStore as unknown as jest.Mock).mockReturnValue(selectedStore)

      render(<FlowEditor />)

      const panels = screen.getAllByTestId('react-flow-panel')
      const statusBar = panels[1]

      const selectedText = within(statusBar).getByText('Selected: node-1')
      expect(selectedText).toHaveClass('text-accent-primary')
    })

    it('shows running status with pulse animation', () => {
      const storeWithNodes = {
        ...mockFlowStore,
        nodes: [{ id: 'node-1' }],
      }
      ;(useFlowStore as unknown as jest.Mock).mockReturnValue(storeWithNodes)

      render(<FlowEditor />)

      fireEvent.click(screen.getByText('Run'))

      const panels = screen.getAllByTestId('react-flow-panel')
      const statusBar = panels[1]

      const runningText = within(statusBar).getByText('Running...')
      expect(runningText).toHaveClass('animate-pulse')
    })
  })
})