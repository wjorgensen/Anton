import '@testing-library/jest-dom'

// Mock @/lib/agents
jest.mock('@/lib/agents', () => ({
  loadAgents: jest.fn().mockResolvedValue([]),
  getCachedAgents: jest.fn(() => [
    {
      id: 'test-agent',
      name: 'Test Agent',
      category: 'setup',
      type: 'test',
      version: '1.0.0',
      description: 'Test agent description',
      icon: '🤖',
      color: '#3B82F6',
      instructions: {
        base: 'Test instructions',
        contextual: 'Test {{variable}}'
      },
      inputs: [{ name: 'input', type: 'string' }],
      outputs: [{ name: 'output', type: 'string' }],
      tags: ['test'],
    },
  ]),
}))

// Mock hooks
jest.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: jest.fn(() => ({
    connected: false,
    connecting: false,
    error: null,
    nodeUpdates: {},
    previewData: {},
    subscribeToExecution: jest.fn(),
    subscribeToProject: jest.fn(),
    reconnect: jest.fn(),
  })),
}))

// Mock components that are complex or not relevant for unit tests
jest.mock('@/components/FloatingToolbar', () => {
  return jest.fn(() => null)
})

jest.mock('@/components/PropertyPanel', () => {
  return jest.fn(() => null)
})

jest.mock('@/components/ContextMenu', () => ({
  __esModule: true,
  default: jest.fn(() => null),
  createNodeContextMenu: jest.fn(),
  createCanvasContextMenu: jest.fn(),
}))

jest.mock('@/components/NotificationSystem', () => ({
  __esModule: true,
  default: jest.fn(() => null),
  useNotifications: jest.fn(() => ({
    notifications: [],
    removeNotification: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  })),
}))

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return []
  }
} as any

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock DOMRect
global.DOMRect = {
  fromRect: () => ({
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => {},
  }),
} as any