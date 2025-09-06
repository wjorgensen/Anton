import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import ReviewNode from '../ReviewNode'
import { NodeProps } from '@xyflow/react'

describe('ReviewNode', () => {
  const defaultProps: NodeProps = {
    id: 'review-node-1',
    data: {
      label: 'Code Review',
      agentConfig: {
        name: 'Review Agent',
        description: 'Reviews code changes',
      },
      reviewScope: 'full',
      status: 'pending',
      requiresApproval: false,
      timeout: undefined,
      feedback: [],
      approvers: [],
      currentReviewer: undefined,
    },
    selected: false,
    type: 'review',
    xPos: 0,
    yPos: 0,
    dragging: false,
    isConnectable: true,
    zIndex: 1,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    width: 250,
    height: 150,
  }

  describe('Rendering', () => {
    it('renders review node with label', () => {
      render(<ReviewNode {...defaultProps} />)

      expect(screen.getByText('Code Review')).toBeInTheDocument()
    })

    it('renders with agent name when label not provided', () => {
      const propsNoLabel = {
        ...defaultProps,
        data: { ...defaultProps.data, label: undefined },
      }

      render(<ReviewNode {...propsNoLabel} />)

      expect(screen.getByText('Review Agent')).toBeInTheDocument()
    })

    it('renders with default text when no label or agent name', () => {
      const propsNoLabelOrName = {
        ...defaultProps,
        data: { 
          ...defaultProps.data, 
          label: undefined,
          agentConfig: { name: undefined },
        },
      }

      render(<ReviewNode {...propsNoLabelOrName} />)

      expect(screen.getByText('Manual Review')).toBeInTheDocument()
    })

    it('displays review scope', () => {
      render(<ReviewNode {...defaultProps} />)

      expect(screen.getByText('Scope:')).toBeInTheDocument()
      expect(screen.getByText('full')).toBeInTheDocument()
    })

    it('renders input and output handles', () => {
      render(<ReviewNode {...defaultProps} />)

      const handles = screen.getAllByTestId('react-flow-handle')
      expect(handles).toHaveLength(2)
      
      const targetHandle = handles.find(h => h.getAttribute('type') === 'target')
      const sourceHandle = handles.find(h => h.getAttribute('type') === 'source')
      
      expect(targetHandle).toBeInTheDocument()
      expect(sourceHandle).toBeInTheDocument()
    })
  })

  describe('Status States', () => {
    it('shows pending status with correct color and icon', () => {
      render(<ReviewNode {...defaultProps} />)

      expect(screen.getByText('Pending Review')).toBeInTheDocument()
      const header = screen.getByText('Pending Review').closest('div')
      expect(header?.parentElement).toHaveStyle({ backgroundColor: '#66666620' })
    })

    it('shows reviewing status with blue color', () => {
      const reviewingProps = {
        ...defaultProps,
        data: { ...defaultProps.data, status: 'reviewing' },
      }

      render(<ReviewNode {...reviewingProps} />)

      expect(screen.getByText('Under Review')).toBeInTheDocument()
      const header = screen.getByText('Under Review').closest('div')
      expect(header?.parentElement).toHaveStyle({ backgroundColor: '#3B82F620' })
    })

    it('shows approved status with green color', () => {
      const approvedProps = {
        ...defaultProps,
        data: { ...defaultProps.data, status: 'approved' },
      }

      render(<ReviewNode {...approvedProps} />)

      expect(screen.getByText('Approved')).toBeInTheDocument()
      const header = screen.getByText('Approved').closest('div')
      expect(header?.parentElement).toHaveStyle({ backgroundColor: '#10B98120' })
    })

    it('shows rejected status with red color', () => {
      const rejectedProps = {
        ...defaultProps,
        data: { ...defaultProps.data, status: 'rejected' },
      }

      render(<ReviewNode {...rejectedProps} />)

      expect(screen.getByText('Rejected')).toBeInTheDocument()
      const header = screen.getByText('Rejected').closest('div')
      expect(header?.parentElement).toHaveStyle({ backgroundColor: '#EF444420' })
    })

    it('shows changes-requested status with orange color', () => {
      const changesProps = {
        ...defaultProps,
        data: { ...defaultProps.data, status: 'changes-requested' },
      }

      render(<ReviewNode {...changesProps} />)

      expect(screen.getByText('Changes Requested')).toBeInTheDocument()
      const header = screen.getByText('Changes Requested').closest('div')
      expect(header?.parentElement).toHaveStyle({ backgroundColor: '#F59E0B20' })
    })
  })

  describe('Approval Requirements', () => {
    it('shows approval required indicator when requiresApproval is true', () => {
      const approvalProps = {
        ...defaultProps,
        data: { ...defaultProps.data, requiresApproval: true },
      }

      render(<ReviewNode {...approvalProps} />)

      const alertIcon = screen.getByTitle('Requires manual approval')
      expect(alertIcon).toBeInTheDocument()
      expect(alertIcon).toHaveClass('text-warning')
    })

    it('does not show approval indicator when requiresApproval is false', () => {
      render(<ReviewNode {...defaultProps} />)

      const alertIcon = screen.queryByTitle('Requires manual approval')
      expect(alertIcon).not.toBeInTheDocument()
    })
  })

  describe('Review Stats', () => {
    it('shows approver count when approvers present', () => {
      const approversProps = {
        ...defaultProps,
        data: {
          ...defaultProps.data,
          approvers: ['user1', 'user2', 'user3'],
        },
      }

      render(<ReviewNode {...approversProps} />)

      expect(screen.getByText('3 approved')).toBeInTheDocument()
    })

    it('shows feedback count when feedback present', () => {
      const feedbackProps = {
        ...defaultProps,
        data: {
          ...defaultProps.data,
          feedback: [
            { id: '1', message: 'Good', severity: 'info', timestamp: '2024-01-01' },
            { id: '2', message: 'Fix this', severity: 'warning', timestamp: '2024-01-02' },
          ],
        },
      }

      render(<ReviewNode {...feedbackProps} />)

      expect(screen.getByText('2 comments')).toBeInTheDocument()
    })

    it('does not show stats section when no approvers or feedback', () => {
      render(<ReviewNode {...defaultProps} />)

      expect(screen.queryByText(/approved/)).not.toBeInTheDocument()
      expect(screen.queryByText(/comments/)).not.toBeInTheDocument()
    })
  })

  describe('Current Reviewer', () => {
    it('shows current reviewer when status is reviewing', () => {
      const reviewerProps = {
        ...defaultProps,
        data: {
          ...defaultProps.data,
          status: 'reviewing',
          currentReviewer: 'john.doe',
        },
      }

      render(<ReviewNode {...reviewerProps} />)

      expect(screen.getByText('Reviewer:')).toBeInTheDocument()
      expect(screen.getByText('john.doe')).toBeInTheDocument()
    })

    it('does not show reviewer when status is not reviewing', () => {
      const reviewerProps = {
        ...defaultProps,
        data: {
          ...defaultProps.data,
          status: 'pending',
          currentReviewer: 'john.doe',
        },
      }

      render(<ReviewNode {...reviewerProps} />)

      expect(screen.queryByText('Reviewer:')).not.toBeInTheDocument()
    })
  })

  describe('Timeout Indicator', () => {
    it('shows timeout when reviewing with timeout set', () => {
      const timeoutProps = {
        ...defaultProps,
        data: {
          ...defaultProps.data,
          status: 'reviewing',
          timeout: 30,
        },
      }

      const { container } = render(<ReviewNode {...timeoutProps} />)

      const timeoutIndicator = container.querySelector('.absolute.-top-2.-right-2')
      expect(timeoutIndicator).toBeInTheDocument()
      expect(screen.getByText('30m')).toBeInTheDocument()
    })

    it('does not show timeout when not reviewing', () => {
      const timeoutProps = {
        ...defaultProps,
        data: {
          ...defaultProps.data,
          status: 'pending',
          timeout: 30,
        },
      }

      const { container } = render(<ReviewNode {...timeoutProps} />)

      const timeoutIndicator = container.querySelector('.absolute.-top-2.-right-2')
      expect(timeoutIndicator).not.toBeInTheDocument()
    })
  })

  describe('Feedback Preview', () => {
    it('shows feedback preview on hover', () => {
      const feedbackProps = {
        ...defaultProps,
        data: {
          ...defaultProps.data,
          feedback: [
            { id: '1', message: 'Good implementation', severity: 'info', timestamp: '2024-01-01' },
            { id: '2', message: 'Fix variable naming', severity: 'warning', timestamp: '2024-01-02' },
            { id: '3', message: 'Security issue', severity: 'error', timestamp: '2024-01-03' },
          ],
        },
      }

      const { container } = render(<ReviewNode {...feedbackProps} />)

      const nodeDiv = container.querySelector('.relative.min-w-\\[250px\\]')
      fireEvent.mouseEnter(nodeDiv!)

      expect(screen.getByText('Recent Feedback')).toBeInTheDocument()
      expect(screen.getByText('Good implementation')).toBeInTheDocument()
      expect(screen.getByText('Fix variable naming')).toBeInTheDocument()
      expect(screen.getByText('Security issue')).toBeInTheDocument()
    })

    it('hides feedback preview on mouse leave', () => {
      const feedbackProps = {
        ...defaultProps,
        data: {
          ...defaultProps.data,
          feedback: [
            { id: '1', message: 'Good implementation', severity: 'info', timestamp: '2024-01-01' },
          ],
        },
      }

      const { container } = render(<ReviewNode {...feedbackProps} />)

      const nodeDiv = container.querySelector('.relative.min-w-\\[250px\\]')
      
      fireEvent.mouseEnter(nodeDiv!)
      expect(screen.getByText('Recent Feedback')).toBeInTheDocument()
      
      fireEvent.mouseLeave(nodeDiv!)
      expect(screen.queryByText('Recent Feedback')).not.toBeInTheDocument()
    })

    it('applies correct severity colors to feedback items', () => {
      const feedbackProps = {
        ...defaultProps,
        data: {
          ...defaultProps.data,
          feedback: [
            { id: '1', message: 'Info message', severity: 'info', timestamp: '2024-01-01' },
            { id: '2', message: 'Warning message', severity: 'warning', timestamp: '2024-01-02' },
            { id: '3', message: 'Error message', severity: 'error', timestamp: '2024-01-03' },
          ],
        },
      }

      const { container } = render(<ReviewNode {...feedbackProps} />)

      const nodeDiv = container.querySelector('.relative.min-w-\\[250px\\]')
      fireEvent.mouseEnter(nodeDiv!)

      const infoItem = screen.getByText('Info message').parentElement
      expect(infoItem).toHaveClass('border-info', 'bg-info/10')

      const warningItem = screen.getByText('Warning message').parentElement
      expect(warningItem).toHaveClass('border-warning', 'bg-warning/10')

      const errorItem = screen.getByText('Error message').parentElement
      expect(errorItem).toHaveClass('border-error', 'bg-error/10')
    })
  })

  describe('Selection State', () => {
    it('applies accent border and glow when selected', () => {
      const selectedProps = { ...defaultProps, selected: true }
      const { container } = render(<ReviewNode {...selectedProps} />)

      const nodeDiv = container.querySelector('.relative.min-w-\\[250px\\]')
      expect(nodeDiv).toHaveClass('border-accent-primary', 'shadow-lg', 'shadow-accent-glow')
    })

    it('applies default border when not selected', () => {
      const { container } = render(<ReviewNode {...defaultProps} />)

      const nodeDiv = container.querySelector('.relative.min-w-\\[250px\\]')
      expect(nodeDiv).toHaveClass('border-border-primary')
      expect(nodeDiv).not.toHaveClass('border-accent-primary')
    })
  })

  describe('Hover Effects', () => {
    it('applies hover background color', () => {
      const { container } = render(<ReviewNode {...defaultProps} />)

      const nodeDiv = container.querySelector('.relative.min-w-\\[250px\\]')
      expect(nodeDiv).toHaveClass('hover:bg-bg-tertiary')
    })

    it('has smooth transition for hover effects', () => {
      const { container } = render(<ReviewNode {...defaultProps} />)

      const nodeDiv = container.querySelector('.relative.min-w-\\[250px\\]')
      expect(nodeDiv).toHaveClass('transition-all', 'duration-200')
    })
  })

  describe('Styling Validation', () => {
    it('uses correct background colors', () => {
      const { container } = render(<ReviewNode {...defaultProps} />)

      const nodeDiv = container.querySelector('.relative.min-w-\\[250px\\]')
      expect(nodeDiv).toHaveClass('bg-bg-secondary')
    })

    it('handle styles use accent primary color', () => {
      render(<ReviewNode {...defaultProps} />)

      const handles = screen.getAllByTestId('react-flow-handle')
      handles.forEach(handle => {
        expect(handle).toHaveClass('!bg-accent-primary')
      })
    })

    it('applies correct text colors', () => {
      render(<ReviewNode {...defaultProps} />)

      const label = screen.getByText('Code Review')
      expect(label).toHaveClass('text-text-primary')

      const scopeLabel = screen.getByText('Scope:')
      expect(scopeLabel.parentElement).toHaveClass('text-text-secondary')
    })

    it('review scope value uses accent color', () => {
      render(<ReviewNode {...defaultProps} />)

      const scopeValue = screen.getByText('full')
      expect(scopeValue).toHaveClass('text-accent-primary')
    })
  })
})