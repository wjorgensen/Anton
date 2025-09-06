import React from 'react'

export const ReactFlow = jest.fn(({ children, onNodeClick, onNodeDoubleClick, onNodesChange, onEdgesChange, onConnect, onDrop, onDragOver, ...props }) => {
  const div = React.createElement('div', {
    'data-testid': 'react-flow',
    onNodeClick,
    onNodeDoubleClick,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onDrop,
    onDragOver,
    ...props
  }, children)
  return div
})

export const ReactFlowProvider = jest.fn(({ children }) => {
  return React.createElement('div', { 'data-testid': 'react-flow-provider' }, children)
})

export const Background = jest.fn((props) => {
  const { variant, color, gap, size, ...restProps } = props || {}
  return React.createElement('div', { 'data-testid': 'react-flow-background', ...restProps })
})

export const Controls = jest.fn((props) => {
  const { showZoom, showFitView, showInteractive, ...restProps } = props || {}
  return React.createElement('div', { 'data-testid': 'react-flow-controls', ...restProps })
})

export const MiniMap = jest.fn((props) => {
  const { nodeColor, maskColor, showInteractive, ...restProps } = props || {}
  return React.createElement('div', { 'data-testid': 'react-flow-minimap', ...restProps })
})

export const Panel = jest.fn(({ children, ...props }) => {
  return React.createElement('div', { 'data-testid': 'react-flow-panel', ...props }, children)
})

export const Handle = jest.fn((props) => {
  return React.createElement('div', { 'data-testid': 'react-flow-handle', ...props })
})

export const useReactFlow = jest.fn(() => ({
  screenToFlowPosition: jest.fn((coords) => coords),
  getNodes: jest.fn(() => []),
  getEdges: jest.fn(() => []),
  setNodes: jest.fn(),
  setEdges: jest.fn(),
  fitView: jest.fn(),
  getViewport: jest.fn(() => ({ x: 0, y: 0, zoom: 1 })),
  setViewport: jest.fn(),
}))

export const BackgroundVariant = {
  Lines: 'lines',
  Dots: 'dots',
  Cross: 'cross',
}

export const Position = {
  Top: 'top',
  Right: 'right',
  Bottom: 'bottom',
  Left: 'left',
}

export const MarkerType = {
  Arrow: 'arrow',
  ArrowClosed: 'arrowclosed',
}

export const useNodesState = jest.fn((initialNodes) => [
  initialNodes || [],
  jest.fn(),
  jest.fn(),
])

export const useEdgesState = jest.fn((initialEdges) => [
  initialEdges || [],
  jest.fn(),
  jest.fn(),
])

export const useOnViewportChange = jest.fn()
export const useOnSelectionChange = jest.fn()
export const useKeyPress = jest.fn(() => false)
export const useUpdateNodeInternals = jest.fn(() => jest.fn())
export const getRectOfNodes = jest.fn(() => ({ x: 0, y: 0, width: 100, height: 100 }))
export const getTransformForBounds = jest.fn(() => [1, 0, 0])
export const getNodesBounds = jest.fn(() => ({ x: 0, y: 0, width: 100, height: 100 }))