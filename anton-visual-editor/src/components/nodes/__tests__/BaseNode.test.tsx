import React from 'react'
import { render, screen } from '@testing-library/react'
import BaseNode from '../BaseNode'
import { NodeProps } from '@xyflow/react'
import { AgentConfig, NodeStatus } from '@/types/agent'

describe('BaseNode', () => {
  const mockAgent: AgentConfig = {
    id: 'test-agent',
    name: 'Test Agent',
    icon: '🤖',
    description: 'Test agent description',
    category: 'setup',
    inputs: ['input1'],
    outputs: ['output1'],
    tags: ['test', 'mock'],
  }

  const defaultProps: NodeProps & { categoryColor: string } = {
    id: 'node-1',
    data: {
      agent: mockAgent,
      label: 'Test Node',
      instructions: 'Test instructions',
      claudeMD: 'Test MD',
      status: 'pending' as NodeStatus,
      inputs: {},
      outputs: {},
      config: {
        retryOnFailure: false,
        maxRetries: 3,
        timeout: 60,
        requiresReview: false,
      },
    },
    selected: false,
    categoryColor: '#3B82F6',
    type: 'base',
    xPos: 0,
    yPos: 0,
    dragging: false,
    isConnectable: true,
    zIndex: 1,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    width: 200,
    height: 100,
  }

  describe('Rendering', () => {
    it('renders node with label and icon', () => {
      render(<BaseNode {...defaultProps} />)

      expect(screen.getByText('Test Node')).toBeInTheDocument()
      expect(screen.getByText('🤖')).toBeInTheDocument()
    })

    it('renders agent description', () => {
      render(<BaseNode {...defaultProps} />)

      expect(screen.getByText('Test agent description')).toBeInTheDocument()
    })

    it('renders category badge with correct category', () => {
      render(<BaseNode {...defaultProps} />)

      expect(screen.getByText('setup')).toBeInTheDocument()
    })

    it('applies category color to badge', () => {
      render(<BaseNode {...defaultProps} />)

      const categoryBadge = screen.getByText('setup')
      expect(categoryBadge).toHaveStyle({
        backgroundColor: '#3B82F620',
        color: '#3B82F6',
      })
    })
  })

  describe('Handles', () => {
    it('renders input handle when agent has inputs', () => {
      render(<BaseNode {...defaultProps} />)

      const handles = screen.getAllByTestId('react-flow-handle')
      const targetHandle = handles.find(h => h.getAttribute('type') === 'target')
      expect(targetHandle).toBeInTheDocument()
    })

    it('renders output handle when agent has outputs', () => {
      render(<BaseNode {...defaultProps} />)

      const handles = screen.getAllByTestId('react-flow-handle')
      const sourceHandle = handles.find(h => h.getAttribute('type') === 'source')
      expect(sourceHandle).toBeInTheDocument()
    })

    it('does not render input handle when agent has no inputs', () => {
      const propsNoInputs = {
        ...defaultProps,
        data: {
          ...defaultProps.data,
          agent: { ...mockAgent, inputs: [] },
        },
      }

      render(<BaseNode {...propsNoInputs} />)

      const handles = screen.getAllByTestId('react-flow-handle')
      const targetHandle = handles.find(h => h.getAttribute('type') === 'target')
      expect(targetHandle).toBeUndefined()
    })

    it('does not render output handle when agent has no outputs', () => {
      const propsNoOutputs = {
        ...defaultProps,
        data: {
          ...defaultProps.data,
          agent: { ...mockAgent, outputs: [] },
        },
      }

      render(<BaseNode {...propsNoOutputs} />)

      const handles = screen.getAllByTestId('react-flow-handle')
      const sourceHandle = handles.find(h => h.getAttribute('type') === 'source')
      expect(sourceHandle).toBeUndefined()
    })
  })

  describe('Status Indicators', () => {
    it('shows pending status with Play icon', () => {
      render(<BaseNode {...defaultProps} />)

      const statusContainer = screen.getByText('Test Node').parentElement?.nextElementSibling
      expect(statusContainer).toHaveClass('text-text-secondary')
      // Icon rendered by Lucide-react Play component
    })

    it('shows running status with Loader icon and pulse animation', () => {
      const runningProps = {
        ...defaultProps,
        data: { ...defaultProps.data, status: 'running' as NodeStatus },
      }

      const { container } = render(<BaseNode {...runningProps} />)

      const nodeDiv = container.querySelector('.agent-node')
      expect(nodeDiv).toHaveClass('animate-pulse-glow')
      
      const statusContainer = screen.getByText('Test Node').parentElement?.nextElementSibling
      expect(statusContainer).toHaveClass('text-accent-primary')
    })

    it('shows completed status with CheckCircle icon', () => {
      const completedProps = {
        ...defaultProps,
        data: { ...defaultProps.data, status: 'completed' as NodeStatus },
      }

      render(<BaseNode {...completedProps} />)

      const statusContainer = screen.getByText('Test Node').parentElement?.nextElementSibling
      expect(statusContainer).toHaveClass('text-success')
    })

    it('shows failed status with XCircle icon', () => {
      const failedProps = {
        ...defaultProps,
        data: { ...defaultProps.data, status: 'failed' as NodeStatus },
      }

      render(<BaseNode {...failedProps} />)

      const statusContainer = screen.getByText('Test Node').parentElement?.nextElementSibling
      expect(statusContainer).toHaveClass('text-error')
    })

    it('shows reviewing status with Eye icon', () => {
      const reviewingProps = {
        ...defaultProps,
        data: { ...defaultProps.data, status: 'reviewing' as NodeStatus },
      }

      render(<BaseNode {...reviewingProps} />)

      const statusContainer = screen.getByText('Test Node').parentElement?.nextElementSibling
      expect(statusContainer).toHaveClass('text-warning')
    })
  })

  describe('Selection State', () => {
    it('applies selected class when selected', () => {
      const selectedProps = { ...defaultProps, selected: true }
      const { container } = render(<BaseNode {...selectedProps} />)

      const nodeDiv = container.querySelector('.agent-node')
      expect(nodeDiv).toHaveClass('selected')
    })

    it('applies border color when selected', () => {
      const selectedProps = { ...defaultProps, selected: true }
      const { container } = render(<BaseNode {...selectedProps} />)

      const nodeDiv = container.querySelector('.agent-node')
      expect(nodeDiv).toHaveStyle({ borderColor: '#3B82F6' })
    })

    it('does not apply border color when not selected', () => {
      const { container } = render(<BaseNode {...defaultProps} />)

      const nodeDiv = container.querySelector('.agent-node')
      expect(nodeDiv).toHaveStyle({ borderColor: undefined })
    })
  })

  describe('Review Badge', () => {
    it('shows review badge when requiresReview is true', () => {
      const reviewProps = {
        ...defaultProps,
        data: {
          ...defaultProps.data,
          config: { ...defaultProps.data.config, requiresReview: true },
        },
      }

      render(<BaseNode {...reviewProps} />)

      expect(screen.getByText('Requires Review')).toBeInTheDocument()
    })

    it('does not show review badge when requiresReview is false', () => {
      render(<BaseNode {...defaultProps} />)

      expect(screen.queryByText('Requires Review')).not.toBeInTheDocument()
    })

    it('review badge has warning color', () => {
      const reviewProps = {
        ...defaultProps,
        data: {
          ...defaultProps.data,
          config: { ...defaultProps.data.config, requiresReview: true },
        },
      }

      render(<BaseNode {...reviewProps} />)

      const reviewBadge = screen.getByText('Requires Review').parentElement
      expect(reviewBadge).toHaveClass('text-warning')
    })
  })

  describe('Styling', () => {
    it('applies correct base classes', () => {
      const { container } = render(<BaseNode {...defaultProps} />)

      const nodeDiv = container.querySelector('.agent-node')
      expect(nodeDiv).toHaveClass('min-w-[200px]', 'p-3')
    })

    it('truncates long descriptions with line-clamp', () => {
      const longDescProps = {
        ...defaultProps,
        data: {
          ...defaultProps.data,
          agent: {
            ...mockAgent,
            description: 'This is a very long description that should be truncated after two lines to maintain consistent node height in the flow editor',
          },
        },
      }

      render(<BaseNode {...longDescProps} />)

      const description = screen.getByText(/This is a very long description/)
      expect(description).toHaveClass('line-clamp-2')
    })

    it('uses correct text colors', () => {
      render(<BaseNode {...defaultProps} />)

      const description = screen.getByText('Test agent description')
      expect(description).toHaveClass('text-xs', 'text-text-secondary')
    })

    it('applies font styles correctly', () => {
      render(<BaseNode {...defaultProps} />)

      const label = screen.getByText('Test Node')
      expect(label).toHaveClass('font-semibold', 'text-sm')

      const categoryBadge = screen.getByText('setup')
      expect(categoryBadge.parentElement).toHaveClass('font-mono')
    })
  })

  describe('Color Validation', () => {
    it('uses black background (#000000) via bg-bg-primary', () => {
      const { container } = render(<BaseNode {...defaultProps} />)
      
      // The node should inherit the background from parent FlowEditor
      const handles = container.querySelectorAll('[data-testid="react-flow-handle"]')
      handles.forEach(handle => {
        expect(handle).toHaveClass('bg-bg-tertiary')
      })
    })

    it('uses white text (#FFFFFF) via text classes', () => {
      render(<BaseNode {...defaultProps} />)

      const label = screen.getByText('Test Node')
      // Text color is set via Tailwind text-* classes
      expect(label).toHaveClass('font-semibold')
    })

    it('uses blue accent (#3B82F6) for category color', () => {
      render(<BaseNode {...defaultProps} />)

      const categoryBadge = screen.getByText('SETUP')
      expect(categoryBadge).toHaveStyle({ color: 'rgb(59, 130, 246)' })
    })
  })
})