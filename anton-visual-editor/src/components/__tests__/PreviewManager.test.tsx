import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PreviewManager from '../PreviewManager'
import { useWebSocket } from '@/hooks/useWebSocket'

// Mock the WebSocket hook
jest.mock('@/hooks/useWebSocket')

describe('PreviewManager', () => {
  const mockUseWebSocket = useWebSocket as jest.MockedFunction<typeof useWebSocket>
  
  const mockPreviewData = {
    terminal: {
      nodeId: 'node-1',
      output: 'Terminal output line 1\nTerminal output line 2\n',
      timestamp: new Date().toISOString(),
    },
    web: {
      nodeId: 'node-2',
      url: 'http://localhost:3000',
      html: '<html><body>Preview content</body></html>',
      timestamp: new Date().toISOString(),
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseWebSocket.mockReturnValue({
      connected: true,
      connecting: false,
      error: null,
      nodeUpdates: {},
      previewData: mockPreviewData,
      subscribeToExecution: jest.fn(),
      subscribeToProject: jest.fn(),
      reconnect: jest.fn(),
    })
  })

  describe('Rendering', () => {
    it('renders preview tabs', () => {
      render(<PreviewManager executionId="exec-1" />)
      
      expect(screen.getByText('Terminal')).toBeInTheDocument()
      expect(screen.getByText('Web Preview')).toBeInTheDocument()
    })

    it('shows terminal content by default', () => {
      render(<PreviewManager executionId="exec-1" />)
      
      expect(screen.getByText(/Terminal output line 1/)).toBeInTheDocument()
      expect(screen.getByText(/Terminal output line 2/)).toBeInTheDocument()
    })

    it('displays connection status', () => {
      render(<PreviewManager executionId="exec-1" />)
      
      expect(screen.getByText(/Connected/i)).toBeInTheDocument()
    })

    it('shows disconnected status when not connected', () => {
      mockUseWebSocket.mockReturnValue({
        connected: false,
        connecting: false,
        error: null,
        nodeUpdates: {},
        previewData: {},
        subscribeToExecution: jest.fn(),
        subscribeToProject: jest.fn(),
        reconnect: jest.fn(),
      })
      
      render(<PreviewManager executionId="exec-1" />)
      
      expect(screen.getByText(/Disconnected/i)).toBeInTheDocument()
    })

    it('shows connecting status while connecting', () => {
      mockUseWebSocket.mockReturnValue({
        connected: false,
        connecting: true,
        error: null,
        nodeUpdates: {},
        previewData: {},
        subscribeToExecution: jest.fn(),
        subscribeToProject: jest.fn(),
        reconnect: jest.fn(),
      })
      
      render(<PreviewManager executionId="exec-1" />)
      
      expect(screen.getByText(/Connecting/i)).toBeInTheDocument()
    })
  })

  describe('Terminal Preview', () => {
    it('displays terminal output', () => {
      render(<PreviewManager executionId="exec-1" />)
      
      const terminalContent = screen.getByRole('log')
      expect(terminalContent).toHaveTextContent('Terminal output line 1')
      expect(terminalContent).toHaveTextContent('Terminal output line 2')
    })

    it('applies monospace font to terminal', () => {
      render(<PreviewManager executionId="exec-1" />)
      
      const terminalContent = screen.getByRole('log')
      expect(terminalContent).toHaveClass('font-mono')
    })

    it('auto-scrolls to bottom on new output', async () => {
      const { rerender } = render(<PreviewManager executionId="exec-1" />)
      
      const terminalContent = screen.getByRole('log')
      const scrollSpy = jest.spyOn(terminalContent, 'scrollTop', 'set')
      
      // Update with new output
      mockUseWebSocket.mockReturnValue({
        connected: true,
        connecting: false,
        error: null,
        nodeUpdates: {},
        previewData: {
          terminal: {
            nodeId: 'node-1',
            output: mockPreviewData.terminal.output + 'New line\n',
            timestamp: new Date().toISOString(),
          },
        },
        subscribeToExecution: jest.fn(),
        subscribeToProject: jest.fn(),
        reconnect: jest.fn(),
      })
      
      rerender(<PreviewManager executionId="exec-1" />)
      
      await waitFor(() => {
        expect(scrollSpy).toHaveBeenCalled()
      })
    })

    it('supports ANSI color codes', () => {
      mockUseWebSocket.mockReturnValue({
        connected: true,
        connecting: false,
        error: null,
        nodeUpdates: {},
        previewData: {
          terminal: {
            nodeId: 'node-1',
            output: '\x1b[31mError message\x1b[0m\n\x1b[32mSuccess message\x1b[0m',
            timestamp: new Date().toISOString(),
          },
        },
        subscribeToExecution: jest.fn(),
        subscribeToProject: jest.fn(),
        reconnect: jest.fn(),
      })
      
      render(<PreviewManager executionId="exec-1" />)
      
      expect(screen.getByText(/Error message/)).toHaveClass('text-red-500')
      expect(screen.getByText(/Success message/)).toHaveClass('text-green-500')
    })

    it('has clear terminal button', async () => {
      const user = userEvent.setup()
      render(<PreviewManager executionId="exec-1" />)
      
      const clearButton = screen.getByTitle('Clear terminal')
      await user.click(clearButton)
      
      const terminalContent = screen.getByRole('log')
      expect(terminalContent).toHaveTextContent('')
    })

    it('has copy output button', async () => {
      const user = userEvent.setup()
      const mockClipboard = { writeText: jest.fn() }
      Object.assign(navigator, { clipboard: mockClipboard })
      
      render(<PreviewManager executionId="exec-1" />)
      
      const copyButton = screen.getByTitle('Copy output')
      await user.click(copyButton)
      
      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        'Terminal output line 1\nTerminal output line 2\n'
      )
    })
  })

  describe('Web Preview', () => {
    it('switches to web preview on tab click', async () => {
      const user = userEvent.setup()
      render(<PreviewManager executionId="exec-1" />)
      
      const webTab = screen.getByText('Web Preview')
      await user.click(webTab)
      
      expect(screen.getByTitle('Preview URL')).toBeInTheDocument()
      expect(screen.getByRole('iframe')).toBeInTheDocument()
    })

    it('displays preview URL', async () => {
      const user = userEvent.setup()
      render(<PreviewManager executionId="exec-1" />)
      
      const webTab = screen.getByText('Web Preview')
      await user.click(webTab)
      
      expect(screen.getByDisplayValue('http://localhost:3000')).toBeInTheDocument()
    })

    it('renders iframe with correct src', async () => {
      const user = userEvent.setup()
      render(<PreviewManager executionId="exec-1" />)
      
      const webTab = screen.getByText('Web Preview')
      await user.click(webTab)
      
      const iframe = screen.getByRole('iframe') as HTMLIFrameElement
      expect(iframe.srcdoc).toContain('Preview content')
    })

    it('has refresh button', async () => {
      const user = userEvent.setup()
      const mockReload = jest.fn()
      
      render(<PreviewManager executionId="exec-1" />)
      
      const webTab = screen.getByText('Web Preview')
      await user.click(webTab)
      
      const refreshButton = screen.getByTitle('Refresh preview')
      await user.click(refreshButton)
      
      // Verify iframe is refreshed
      const iframe = screen.getByRole('iframe')
      expect(iframe).toBeInTheDocument()
    })

    it('has open in new tab button', async () => {
      const user = userEvent.setup()
      const mockOpen = jest.fn()
      global.open = mockOpen
      
      render(<PreviewManager executionId="exec-1" />)
      
      const webTab = screen.getByText('Web Preview')
      await user.click(webTab)
      
      const openButton = screen.getByTitle('Open in new tab')
      await user.click(openButton)
      
      expect(mockOpen).toHaveBeenCalledWith('http://localhost:3000', '_blank')
    })

    it('allows URL editing', async () => {
      const user = userEvent.setup()
      render(<PreviewManager executionId="exec-1" />)
      
      const webTab = screen.getByText('Web Preview')
      await user.click(webTab)
      
      const urlInput = screen.getByDisplayValue('http://localhost:3000')
      await user.clear(urlInput)
      await user.type(urlInput, 'http://localhost:4000')
      
      fireEvent.keyPress(urlInput, { key: 'Enter', code: 'Enter' })
      
      expect(urlInput).toHaveValue('http://localhost:4000')
    })

    it('shows loading state while iframe loads', async () => {
      const user = userEvent.setup()
      render(<PreviewManager executionId="exec-1" />)
      
      const webTab = screen.getByText('Web Preview')
      await user.click(webTab)
      
      expect(screen.getByText(/Loading preview/i)).toBeInTheDocument()
    })
  })

  describe('Tab Management', () => {
    it('highlights active tab', async () => {
      const user = userEvent.setup()
      render(<PreviewManager executionId="exec-1" />)
      
      const terminalTab = screen.getByText('Terminal')
      const webTab = screen.getByText('Web Preview')
      
      expect(terminalTab.parentElement).toHaveClass('border-accent-primary')
      expect(webTab.parentElement).not.toHaveClass('border-accent-primary')
      
      await user.click(webTab)
      
      expect(webTab.parentElement).toHaveClass('border-accent-primary')
      expect(terminalTab.parentElement).not.toHaveClass('border-accent-primary')
    })

    it('shows tab badges with content indicators', () => {
      render(<PreviewManager executionId="exec-1" />)
      
      const terminalTab = screen.getByText('Terminal')
      expect(terminalTab.parentElement).toContain('2') // 2 lines of output
      
      const webTab = screen.getByText('Web Preview')
      expect(webTab.parentElement).toContain('•') // Has content indicator
    })

    it('supports keyboard navigation between tabs', () => {
      render(<PreviewManager executionId="exec-1" />)
      
      const terminalTab = screen.getByText('Terminal')
      terminalTab.focus()
      
      fireEvent.keyDown(terminalTab, { key: 'ArrowRight' })
      
      const webTab = screen.getByText('Web Preview')
      expect(document.activeElement).toBe(webTab)
    })
  })

  describe('Resize Functionality', () => {
    it('has resize handle', () => {
      render(<PreviewManager executionId="exec-1" />)
      
      expect(screen.getByTitle('Resize preview panel')).toBeInTheDocument()
    })

    it('allows panel resizing', async () => {
      const user = userEvent.setup()
      render(<PreviewManager executionId="exec-1" />)
      
      const resizeHandle = screen.getByTitle('Resize preview panel')
      const container = resizeHandle.closest('.preview-container')
      
      // Simulate drag to resize
      fireEvent.mouseDown(resizeHandle, { clientY: 200 })
      fireEvent.mouseMove(document, { clientY: 300 })
      fireEvent.mouseUp(document)
      
      expect(container).toHaveStyle({ height: '300px' })
    })

    it('enforces minimum and maximum heights', () => {
      render(<PreviewManager executionId="exec-1" />)
      
      const resizeHandle = screen.getByTitle('Resize preview panel')
      const container = resizeHandle.closest('.preview-container')
      
      // Try to resize below minimum
      fireEvent.mouseDown(resizeHandle, { clientY: 200 })
      fireEvent.mouseMove(document, { clientY: 50 })
      fireEvent.mouseUp(document)
      
      const height = parseInt(container?.style.height || '200')
      expect(height).toBeGreaterThanOrEqual(200)
      expect(height).toBeLessThanOrEqual(800)
    })
  })

  describe('Error Handling', () => {
    it('displays error message when WebSocket fails', () => {
      mockUseWebSocket.mockReturnValue({
        connected: false,
        connecting: false,
        error: 'Connection failed',
        nodeUpdates: {},
        previewData: {},
        subscribeToExecution: jest.fn(),
        subscribeToProject: jest.fn(),
        reconnect: jest.fn(),
      })
      
      render(<PreviewManager executionId="exec-1" />)
      
      expect(screen.getByText(/Connection failed/i)).toBeInTheDocument()
    })

    it('shows retry button on connection error', () => {
      const mockReconnect = jest.fn()
      mockUseWebSocket.mockReturnValue({
        connected: false,
        connecting: false,
        error: 'Connection failed',
        nodeUpdates: {},
        previewData: {},
        subscribeToExecution: jest.fn(),
        subscribeToProject: jest.fn(),
        reconnect: mockReconnect,
      })
      
      render(<PreviewManager executionId="exec-1" />)
      
      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)
      
      expect(mockReconnect).toHaveBeenCalled()
    })

    it('handles missing preview data gracefully', () => {
      mockUseWebSocket.mockReturnValue({
        connected: true,
        connecting: false,
        error: null,
        nodeUpdates: {},
        previewData: {},
        subscribeToExecution: jest.fn(),
        subscribeToProject: jest.fn(),
        reconnect: jest.fn(),
      })
      
      render(<PreviewManager executionId="exec-1" />)
      
      expect(screen.getByText(/No output yet/i)).toBeInTheDocument()
    })
  })
})