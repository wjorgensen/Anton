import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NodeEditModal from '../NodeEditModal'
import { useFlowStore } from '@/store/flowStore'

// Mock the store
jest.mock('@/store/flowStore')

describe('NodeEditModal', () => {
  const mockUseFlowStore = useFlowStore as jest.MockedFunction<typeof useFlowStore>
  const mockUpdateNode = jest.fn()
  const mockCloseEditModal = jest.fn()
  
  const mockNode = {
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
        inputs: [
          { name: 'input1', type: 'string', required: true },
          { name: 'input2', type: 'number', required: false },
        ],
        outputs: [
          { name: 'output1', type: 'string' },
        ],
      },
      inputs: {},
      timeout: 30000,
      retryCount: 3,
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseFlowStore.mockReturnValue({
      editingNode: mockNode,
      updateNode: mockUpdateNode,
      closeEditModal: mockCloseEditModal,
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
      duplicateNode: jest.fn(),
      clearFlow: jest.fn(),
    })
  })

  describe('Rendering', () => {
    it('renders modal when editing node is present', () => {
      render(<NodeEditModal />)
      
      expect(screen.getByText('Configure Node')).toBeInTheDocument()
      expect(screen.getByText('Test Agent')).toBeInTheDocument()
    })

    it('does not render when no editing node', () => {
      mockUseFlowStore.mockReturnValue({
        editingNode: null,
        updateNode: mockUpdateNode,
        closeEditModal: mockCloseEditModal,
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
        duplicateNode: jest.fn(),
        clearFlow: jest.fn(),
      })
      
      const { container } = render(<NodeEditModal />)
      expect(container.firstChild).toBeNull()
    })

    it('displays agent description', () => {
      render(<NodeEditModal />)
      
      expect(screen.getByText('Test description')).toBeInTheDocument()
    })

    it('renders all input fields', () => {
      render(<NodeEditModal />)
      
      expect(screen.getByLabelText(/input1.*required/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/input2/i)).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('validates required fields', async () => {
      const user = userEvent.setup()
      render(<NodeEditModal />)
      
      const input1Field = screen.getByLabelText(/input1.*required/i)
      await user.clear(input1Field)
      
      const saveButton = screen.getByText('Save')
      await user.click(saveButton)
      
      expect(mockUpdateNode).not.toHaveBeenCalled()
      expect(screen.getByText(/required field/i)).toBeInTheDocument()
    })

    it('validates number fields', async () => {
      const user = userEvent.setup()
      render(<NodeEditModal />)
      
      const input2Field = screen.getByLabelText(/input2/i)
      await user.type(input2Field, 'not-a-number')
      
      await waitFor(() => {
        expect(screen.getByText(/must be a number/i)).toBeInTheDocument()
      })
    })

    it('validates timeout range', async () => {
      const user = userEvent.setup()
      render(<NodeEditModal />)
      
      const timeoutField = screen.getByLabelText(/timeout/i)
      await user.clear(timeoutField)
      await user.type(timeoutField, '-1')
      
      const saveButton = screen.getByText('Save')
      await user.click(saveButton)
      
      expect(screen.getByText(/must be positive/i)).toBeInTheDocument()
    })

    it('validates retry count range', async () => {
      const user = userEvent.setup()
      render(<NodeEditModal />)
      
      const retryField = screen.getByLabelText(/retry count/i)
      await user.clear(retryField)
      await user.type(retryField, '11')
      
      const saveButton = screen.getByText('Save')
      await user.click(saveButton)
      
      expect(screen.getByText(/maximum.*10/i)).toBeInTheDocument()
    })
  })

  describe('Form Interactions', () => {
    it('updates node label', async () => {
      const user = userEvent.setup()
      render(<NodeEditModal />)
      
      const labelField = screen.getByLabelText(/node label/i)
      await user.clear(labelField)
      await user.type(labelField, 'Updated Label')
      
      const saveButton = screen.getByText('Save')
      await user.click(saveButton)
      
      expect(mockUpdateNode).toHaveBeenCalledWith('node-1', expect.objectContaining({
        data: expect.objectContaining({
          label: 'Updated Label',
        }),
      }))
    })

    it('updates input values', async () => {
      const user = userEvent.setup()
      render(<NodeEditModal />)
      
      const input1Field = screen.getByLabelText(/input1.*required/i)
      await user.type(input1Field, 'test value')
      
      const input2Field = screen.getByLabelText(/input2/i)
      await user.type(input2Field, '42')
      
      const saveButton = screen.getByText('Save')
      await user.click(saveButton)
      
      expect(mockUpdateNode).toHaveBeenCalledWith('node-1', expect.objectContaining({
        data: expect.objectContaining({
          inputs: {
            input1: 'test value',
            input2: 42,
          },
        }),
      }))
    })

    it('updates timeout value', async () => {
      const user = userEvent.setup()
      render(<NodeEditModal />)
      
      const timeoutField = screen.getByLabelText(/timeout/i)
      await user.clear(timeoutField)
      await user.type(timeoutField, '60000')
      
      const saveButton = screen.getByText('Save')
      await user.click(saveButton)
      
      expect(mockUpdateNode).toHaveBeenCalledWith('node-1', expect.objectContaining({
        data: expect.objectContaining({
          timeout: 60000,
        }),
      }))
    })

    it('closes modal on cancel', async () => {
      const user = userEvent.setup()
      render(<NodeEditModal />)
      
      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)
      
      expect(mockCloseEditModal).toHaveBeenCalled()
      expect(mockUpdateNode).not.toHaveBeenCalled()
    })

    it('closes modal on escape key', () => {
      render(<NodeEditModal />)
      
      fireEvent.keyDown(document, { key: 'Escape' })
      
      expect(mockCloseEditModal).toHaveBeenCalled()
    })

    it('closes modal on backdrop click', () => {
      render(<NodeEditModal />)
      
      const backdrop = screen.getByRole('dialog').parentElement
      fireEvent.click(backdrop!)
      
      expect(mockCloseEditModal).toHaveBeenCalled()
    })
  })

  describe('Advanced Features', () => {
    it('shows advanced options when toggled', async () => {
      const user = userEvent.setup()
      render(<NodeEditModal />)
      
      const advancedToggle = screen.getByText(/advanced options/i)
      await user.click(advancedToggle)
      
      expect(screen.getByLabelText(/environment variables/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/working directory/i)).toBeInTheDocument()
    })

    it('allows adding environment variables', async () => {
      const user = userEvent.setup()
      render(<NodeEditModal />)
      
      const advancedToggle = screen.getByText(/advanced options/i)
      await user.click(advancedToggle)
      
      const addEnvButton = screen.getByText(/add environment variable/i)
      await user.click(addEnvButton)
      
      const keyField = screen.getByPlaceholderText(/variable name/i)
      const valueField = screen.getByPlaceholderText(/variable value/i)
      
      await user.type(keyField, 'API_KEY')
      await user.type(valueField, 'secret123')
      
      const saveButton = screen.getByText('Save')
      await user.click(saveButton)
      
      expect(mockUpdateNode).toHaveBeenCalledWith('node-1', expect.objectContaining({
        data: expect.objectContaining({
          env: { API_KEY: 'secret123' },
        }),
      }))
    })

    it('validates environment variable names', async () => {
      const user = userEvent.setup()
      render(<NodeEditModal />)
      
      const advancedToggle = screen.getByText(/advanced options/i)
      await user.click(advancedToggle)
      
      const addEnvButton = screen.getByText(/add environment variable/i)
      await user.click(addEnvButton)
      
      const keyField = screen.getByPlaceholderText(/variable name/i)
      await user.type(keyField, '123-invalid')
      
      await waitFor(() => {
        expect(screen.getByText(/invalid variable name/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('displays error message when update fails', async () => {
      mockUpdateNode.mockRejectedValue(new Error('Update failed'))
      const user = userEvent.setup()
      render(<NodeEditModal />)
      
      const saveButton = screen.getByText('Save')
      await user.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText(/failed to update/i)).toBeInTheDocument()
      })
    })

    it('disables save button while saving', async () => {
      mockUpdateNode.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      const user = userEvent.setup()
      render(<NodeEditModal />)
      
      const saveButton = screen.getByText('Save')
      await user.click(saveButton)
      
      expect(saveButton).toBeDisabled()
      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })
  })
})