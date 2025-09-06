import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AgentLibrary from '../AgentLibrary'
import { AgentConfig } from '@/types/agent'
import { useAgents } from '@/hooks/useAgents'

// Mock the useAgents hook
jest.mock('@/hooks/useAgents')

const mockAgents: AgentConfig[] = [
    {
      id: 'setup-1',
      name: 'Environment Setup',
      icon: '⚙️',
      description: 'Sets up the development environment',
      category: 'setup',
      inputs: [],
      outputs: ['environment'],
      tags: ['config', 'initialization'],
    },
    {
      id: 'setup-2',
      name: 'Database Init',
      icon: '🗄️',
      description: 'Initializes database connections',
      category: 'setup',
      inputs: [],
      outputs: ['connection'],
      tags: ['database', 'sql'],
    },
    {
      id: 'exec-1',
      name: 'Code Runner',
      icon: '▶️',
      description: 'Executes code snippets',
      category: 'execution',
      inputs: ['code'],
      outputs: ['result'],
      tags: ['runtime', 'execute'],
    },
    {
      id: 'test-1',
      name: 'Unit Test',
      icon: '🧪',
      description: 'Runs unit tests',
      category: 'testing',
      inputs: ['testSuite'],
      outputs: ['testResults'],
      tags: ['test', 'quality'],
    },
    {
      id: 'integration-1',
      name: 'API Integration',
      icon: '🔌',
      description: 'Integrates with external APIs',
      category: 'integration',
      inputs: ['apiConfig'],
      outputs: ['response'],
      tags: ['api', 'rest'],
    },
    {
      id: 'review-1',
      name: 'Code Review',
      icon: '👁️',
      description: 'Reviews code changes',
      category: 'review',
      inputs: ['changes'],
      outputs: ['feedback'],
      tags: ['review', 'quality'],
    },
    {
      id: 'summary-1',
      name: 'Report Generator',
      icon: '📊',
      description: 'Generates summary reports',
      category: 'summary',
      inputs: ['data'],
      outputs: ['report'],
      tags: ['report', 'summary'],
    },
  ] as AgentConfig[]

describe('AgentLibrary', () => {
  const mockOnDragStart = jest.fn()
  const mockUseAgents = useAgents as jest.MockedFunction<typeof useAgents>

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAgents.mockReturnValue({
      agents: mockAgents,
      loading: false,
      error: null,
      getAgentsByCategory: jest.fn((category) => mockAgents.filter(agent => agent.category === category)),
      getAgentById: jest.fn((id) => mockAgents.find(agent => agent.id === id)),
    })
  })

  describe('Rendering', () => {
    it('renders the agent library header', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      expect(screen.getByText('Agent Library')).toBeInTheDocument()
    })

    it('renders search input', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const searchInput = screen.getByPlaceholderText('Search agents...')
      expect(searchInput).toBeInTheDocument()
    })

    it('renders all category headers', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      expect(screen.getByText('Setup Agents')).toBeInTheDocument()
      expect(screen.getByText('Execution Agents')).toBeInTheDocument()
      expect(screen.getByText('Testing Agents')).toBeInTheDocument()
      expect(screen.getByText('Integration Agents')).toBeInTheDocument()
      expect(screen.getByText('Review Agents')).toBeInTheDocument()
      expect(screen.getByText('Summary Agents')).toBeInTheDocument()
    })

    it('shows agent count for each category', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      // Setup has 2 agents
      const setupHeader = screen.getByText('Setup Agents').parentElement
      expect(within(setupHeader!).getByText('(2)')).toBeInTheDocument()

      // Execution has 1 agent
      const execHeader = screen.getByText('Execution Agents').parentElement
      expect(within(execHeader!).getByText('(1)')).toBeInTheDocument()
    })

    it('renders footer with instructions', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      expect(screen.getByText('Drag agents to canvas to add them to your flow')).toBeInTheDocument()
    })
  })

  describe('Category Expansion', () => {
    it('initially expands setup and execution categories', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      expect(screen.getByText('Environment Setup')).toBeInTheDocument()
      expect(screen.getByText('Code Runner')).toBeInTheDocument()
    })

    it('initially collapses other categories', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      expect(screen.queryByText('Unit Test')).not.toBeInTheDocument()
      expect(screen.queryByText('API Integration')).not.toBeInTheDocument()
      expect(screen.queryByText('Code Review')).not.toBeInTheDocument()
      expect(screen.queryByText('Report Generator')).not.toBeInTheDocument()
    })

    it('toggles category expansion on click', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      // Initially collapsed
      expect(screen.queryByText('Unit Test')).not.toBeInTheDocument()

      // Click to expand
      const testingHeader = screen.getByText('Testing Agents').parentElement!
      fireEvent.click(testingHeader)

      expect(screen.getByText('Unit Test')).toBeInTheDocument()

      // Click to collapse
      fireEvent.click(testingHeader)
      expect(screen.queryByText('Unit Test')).not.toBeInTheDocument()
    })

    it('shows chevron right for collapsed categories', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const testingHeader = screen.getByText('Testing Agents').parentElement!
      const chevron = within(testingHeader).getByRole('img', { hidden: true })
      expect(chevron.parentElement).toHaveClass('w-4', 'h-4')
    })

    it('shows chevron down for expanded categories', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const setupHeader = screen.getByText('Setup Agents').parentElement!
      const chevron = within(setupHeader).getByRole('img', { hidden: true })
      expect(chevron.parentElement).toHaveClass('w-4', 'h-4')
    })
  })

  describe('Search Functionality', () => {
    it('filters agents by name', async () => {
      const user = userEvent.setup()
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const searchInput = screen.getByPlaceholderText('Search agents...')
      await user.type(searchInput, 'Environment')

      expect(screen.getByText('Environment Setup')).toBeInTheDocument()
      expect(screen.queryByText('Code Runner')).not.toBeInTheDocument()
      expect(screen.queryByText('Database Init')).not.toBeInTheDocument()
    })

    it('filters agents by description', async () => {
      const user = userEvent.setup()
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const searchInput = screen.getByPlaceholderText('Search agents...')
      await user.type(searchInput, 'database')

      // Expand setup category to see results
      const setupHeader = screen.getByText('Setup Agents').parentElement!
      if (!screen.queryByText('Database Init')) {
        fireEvent.click(setupHeader)
      }

      expect(screen.getByText('Database Init')).toBeInTheDocument()
      expect(screen.queryByText('Environment Setup')).not.toBeInTheDocument()
    })

    it('filters agents by tags', async () => {
      const user = userEvent.setup()
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const searchInput = screen.getByPlaceholderText('Search agents...')
      await user.type(searchInput, 'quality')

      // Expand categories to see results
      const testingHeader = screen.getByText('Testing Agents').parentElement!
      fireEvent.click(testingHeader)
      const reviewHeader = screen.getByText('Review Agents').parentElement!
      fireEvent.click(reviewHeader)

      expect(screen.getByText('Unit Test')).toBeInTheDocument()
      expect(screen.getByText('Code Review')).toBeInTheDocument()
    })

    it('is case insensitive', async () => {
      const user = userEvent.setup()
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const searchInput = screen.getByPlaceholderText('Search agents...')
      await user.type(searchInput, 'ENVIRONMENT')

      expect(screen.getByText('Environment Setup')).toBeInTheDocument()
    })

    it('hides empty categories when searching', async () => {
      const user = userEvent.setup()
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const searchInput = screen.getByPlaceholderText('Search agents...')
      await user.type(searchInput, 'Environment Setup')

      // Only setup category should be visible
      expect(screen.getByText('Setup Agents')).toBeInTheDocument()
      expect(screen.queryByText('Testing Agents')).not.toBeInTheDocument()
      expect(screen.queryByText('Integration Agents')).not.toBeInTheDocument()
    })

    it('updates category counts based on search results', async () => {
      const user = userEvent.setup()
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const searchInput = screen.getByPlaceholderText('Search agents...')
      await user.type(searchInput, 'Init')

      const setupHeader = screen.getByText('Setup Agents').parentElement
      expect(within(setupHeader!).getByText('(1)')).toBeInTheDocument()
    })
  })

  describe('Drag and Drop', () => {
    it('makes agent items draggable', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const agentItem = screen.getByText('Environment Setup').closest('.cursor-move')
      expect(agentItem).toHaveAttribute('draggable', 'true')
    })

    it('calls onDragStart with agent data', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const agentItem = screen.getByText('Environment Setup').closest('.cursor-move')!
      const dragEvent = new Event('dragstart', { bubbles: true }) as any

      fireEvent(agentItem, dragEvent)

      expect(mockOnDragStart).toHaveBeenCalledWith(
        dragEvent,
        expect.objectContaining({
          id: 'setup-1',
          name: 'Environment Setup',
          icon: '⚙️',
        })
      )
    })

    it('applies hover styles on agent items', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const agentItem = screen.getByText('Environment Setup').closest('.cursor-move')
      expect(agentItem).toHaveClass('hover:border-accent-primary')
      expect(agentItem).toHaveClass('hover:shadow-lg')
      expect(agentItem).toHaveClass('hover:shadow-accent-glow/20')
    })
  })

  describe('Agent Display', () => {
    it('displays agent icon', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      expect(screen.getByText('⚙️')).toBeInTheDocument()
      expect(screen.getByText('▶️')).toBeInTheDocument()
    })

    it('displays agent name', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      expect(screen.getByText('Environment Setup')).toBeInTheDocument()
      expect(screen.getByText('Code Runner')).toBeInTheDocument()
    })

    it('displays agent description', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      expect(screen.getByText('Sets up the development environment')).toBeInTheDocument()
      expect(screen.getByText('Executes code snippets')).toBeInTheDocument()
    })

    it('displays up to 3 tags per agent', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const envSetupItem = screen.getByText('Environment Setup').closest('.cursor-move')!
      expect(within(envSetupItem).getByText('config')).toBeInTheDocument()
      expect(within(envSetupItem).getByText('initialization')).toBeInTheDocument()
    })

    it('applies hover effect to agent name', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const agentName = screen.getByText('Environment Setup')
      expect(agentName.parentElement).toHaveClass('group-hover:text-accent-primary')
    })
  })

  describe('Category Colors', () => {
    it('applies correct color to setup category', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const setupHeader = screen.getByText('Setup Agents')
      expect(setupHeader).toHaveStyle({ color: '#3B82F6' })
    })

    it('applies correct color to execution category', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const execHeader = screen.getByText('Execution Agents')
      expect(execHeader).toHaveStyle({ color: '#10B981' })
    })

    it('applies correct color to testing category', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const testHeader = screen.getByText('Testing Agents')
      expect(testHeader).toHaveStyle({ color: '#F59E0B' })
    })

    it('applies correct color to integration category', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const intHeader = screen.getByText('Integration Agents')
      expect(intHeader).toHaveStyle({ color: '#8B5CF6' })
    })

    it('applies correct color to review category', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const reviewHeader = screen.getByText('Review Agents')
      expect(reviewHeader).toHaveStyle({ color: '#EC4899' })
    })

    it('applies correct color to summary category', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const summaryHeader = screen.getByText('Summary Agents')
      expect(summaryHeader).toHaveStyle({ color: '#6B7280' })
    })
  })

  describe('Drag and Drop Functionality', () => {
    it('makes agent items draggable', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)
      
      const agentItem = screen.getByText('Environment Setup').closest('.cursor-move')!
      expect(agentItem).toHaveAttribute('draggable', 'true')
    })

    it('calls onDragStart with correct agent data when dragging starts', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)
      
      const agentItem = screen.getByText('Environment Setup').closest('.cursor-move')!
      const dragStartEvent = new Event('dragstart', { bubbles: true }) as any
      dragStartEvent.dataTransfer = { effectAllowed: '' }
      
      fireEvent(agentItem, dragStartEvent)
      
      expect(mockOnDragStart).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: 'setup-1',
          name: 'Environment Setup',
          category: 'setup',
        })
      )
    })

    it('sets dragEffect to move on drag start', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)
      
      const agentItem = screen.getByText('Code Runner').closest('.cursor-move')!
      const dragStartEvent = new Event('dragstart', { bubbles: true }) as any
      dragStartEvent.dataTransfer = { effectAllowed: '' }
      
      fireEvent(agentItem, dragStartEvent)
      
      expect(mockOnDragStart).toHaveBeenCalledWith(
        expect.objectContaining({
          dataTransfer: expect.objectContaining({ effectAllowed: '' })
        }),
        expect.anything()
      )
    })

    it('applies drag cursor style to draggable items', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)
      
      const agentItems = screen.getAllByRole('article')
      agentItems.forEach(item => {
        expect(item).toHaveClass('cursor-move')
      })
    })

    it('maintains drag functionality after search filter', async () => {
      const user = userEvent.setup()
      render(<AgentLibrary onDragStart={mockOnDragStart} />)
      
      const searchInput = screen.getByPlaceholderText('Search agents...')
      await user.type(searchInput, 'Code')
      
      const filteredAgent = screen.getByText('Code Runner').closest('.cursor-move')!
      expect(filteredAgent).toHaveAttribute('draggable', 'true')
      
      const dragStartEvent = new Event('dragstart', { bubbles: true }) as any
      dragStartEvent.dataTransfer = { effectAllowed: '' }
      
      fireEvent(filteredAgent, dragStartEvent)
      
      expect(mockOnDragStart).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'Code Runner' })
      )
    })

    it('supports keyboard navigation for drag operations', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)
      
      const agentItem = screen.getByText('Environment Setup').closest('.cursor-move')!
      agentItem.focus()
      
      expect(document.activeElement).toBe(agentItem)
      expect(agentItem).toHaveAttribute('draggable', 'true')
    })
  })

  describe('Styling', () => {
    it('has correct width', () => {
      const { container } = render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const libraryContainer = container.firstChild
      expect(libraryContainer).toHaveClass('w-80')
    })

    it('has full height', () => {
      const { container } = render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const libraryContainer = container.firstChild
      expect(libraryContainer).toHaveClass('h-full')
    })

    it('has dark background', () => {
      const { container } = render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const libraryContainer = container.firstChild
      expect(libraryContainer).toHaveClass('bg-bg-secondary')
    })

    it('has border on the right', () => {
      const { container } = render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const libraryContainer = container.firstChild
      expect(libraryContainer).toHaveClass('border-r', 'border-border-primary')
    })

    it('agent items have correct background and border', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const agentItem = screen.getByText('Environment Setup').closest('.cursor-move')
      expect(agentItem).toHaveClass('bg-bg-primary')
      expect(agentItem).toHaveClass('border', 'border-border-primary')
    })

    it('tags have correct styling', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const tag = screen.getByText('config')
      expect(tag).toHaveClass('px-1.5', 'py-0.5', 'text-xs', 'bg-bg-tertiary', 'rounded')
    })

    it('search input has correct styling', () => {
      render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const searchInput = screen.getByPlaceholderText('Search agents...')
      expect(searchInput).toHaveClass('bg-bg-primary')
      expect(searchInput).toHaveClass('border', 'border-border-primary')
      expect(searchInput).toHaveClass('focus:border-accent-primary')
    })

    it('scrollable content area', () => {
      const { container } = render(<AgentLibrary onDragStart={mockOnDragStart} />)

      const scrollArea = container.querySelector('.overflow-y-auto')
      expect(scrollArea).toBeInTheDocument()
      expect(scrollArea).toHaveClass('flex-1')
    })
  })
})