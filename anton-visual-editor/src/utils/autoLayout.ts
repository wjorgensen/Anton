import { Node, Edge } from '@xyflow/react'

export interface LayoutOptions {
  direction: 'TB' | 'BT' | 'LR' | 'RL'
  nodeSpacing: number
  rankSpacing: number
  alignment: 'start' | 'center' | 'end'
}

export interface AutoLayoutResult {
  nodes: Node[]
  bounds: { width: number; height: number }
}

/**
 * Simple auto-layout algorithm using hierarchical positioning
 * Based on topological sort and level assignment
 */
export function autoLayout(
  nodes: Node[], 
  edges: Edge[], 
  options: LayoutOptions = {
    direction: 'LR',
    nodeSpacing: 150,
    rankSpacing: 200,
    alignment: 'center'
  }
): AutoLayoutResult {
  if (nodes.length === 0) {
    return { nodes: [], bounds: { width: 0, height: 0 } }
  }

  // Build adjacency lists
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()
  
  nodes.forEach(node => {
    outgoing.set(node.id, [])
    incoming.set(node.id, [])
  })
  
  edges.forEach(edge => {
    const sourceConnections = outgoing.get(edge.source) || []
    sourceConnections.push(edge.target)
    outgoing.set(edge.source, sourceConnections)
    
    const targetConnections = incoming.get(edge.target) || []
    targetConnections.push(edge.source)
    incoming.set(edge.target, targetConnections)
  })

  // Assign levels using BFS from root nodes (nodes with no incoming edges)
  const levels = new Map<string, number>()
  const rootNodes = nodes.filter(node => (incoming.get(node.id) || []).length === 0)
  
  if (rootNodes.length === 0) {
    // Handle cycles - pick arbitrary starting points
    rootNodes.push(nodes[0])
  }

  // BFS level assignment
  const queue = rootNodes.map(node => ({ id: node.id, level: 0 }))
  const visited = new Set<string>()

  while (queue.length > 0) {
    const { id, level } = queue.shift()!
    
    if (visited.has(id)) continue
    visited.add(id)
    
    levels.set(id, level)
    
    const children = outgoing.get(id) || []
    children.forEach(childId => {
      if (!visited.has(childId)) {
        queue.push({ id: childId, level: level + 1 })
      }
    })
  }

  // Handle unvisited nodes (disconnected components)
  nodes.forEach(node => {
    if (!levels.has(node.id)) {
      levels.set(node.id, 0)
    }
  })

  // Group nodes by level
  const levelGroups = new Map<number, string[]>()
  levels.forEach((level, nodeId) => {
    if (!levelGroups.has(level)) {
      levelGroups.set(level, [])
    }
    levelGroups.get(level)!.push(nodeId)
  })

  // Calculate positions
  const nodeWidth = 200
  const nodeHeight = 120
  const layoutedNodes: Node[] = []
  let maxWidth = 0
  let maxHeight = 0

  Array.from(levelGroups.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([level, nodeIds]) => {
      const groupSize = nodeIds.length
      const totalGroupWidth = (groupSize - 1) * options.nodeSpacing
      const startOffset = -totalGroupWidth / 2

      nodeIds.forEach((nodeId, index) => {
        const node = nodes.find(n => n.id === nodeId)!
        let x: number, y: number

        switch (options.direction) {
          case 'LR': // Left to Right
            x = level * options.rankSpacing
            y = startOffset + index * options.nodeSpacing
            break
          case 'RL': // Right to Left
            x = -level * options.rankSpacing
            y = startOffset + index * options.nodeSpacing
            break
          case 'TB': // Top to Bottom
            x = startOffset + index * options.nodeSpacing
            y = level * options.rankSpacing
            break
          case 'BT': // Bottom to Top
            x = startOffset + index * options.nodeSpacing
            y = -level * options.rankSpacing
            break
        }

        // Apply alignment
        if (options.alignment === 'start') {
          if (['LR', 'RL'].includes(options.direction)) {
            y = index * options.nodeSpacing
          } else {
            x = index * options.nodeSpacing
          }
        }

        layoutedNodes.push({
          ...node,
          position: { x, y }
        })

        maxWidth = Math.max(maxWidth, Math.abs(x) + nodeWidth)
        maxHeight = Math.max(maxHeight, Math.abs(y) + nodeHeight)
      })
    })

  return {
    nodes: layoutedNodes,
    bounds: { width: maxWidth * 2, height: maxHeight * 2 }
  }
}

/**
 * Apply force-directed layout for better visual appeal
 */
export function forceDirectedLayout(
  nodes: Node[],
  edges: Edge[],
  iterations: number = 100,
  repulsionStrength: number = 100,
  attractionStrength: number = 0.1,
  damping: number = 0.9
): Node[] {
  if (nodes.length <= 1) return nodes

  const positions = new Map<string, { x: number; y: number; vx: number; vy: number }>()
  
  // Initialize positions and velocities
  nodes.forEach(node => {
    positions.set(node.id, {
      x: node.position.x,
      y: node.position.y,
      vx: 0,
      vy: 0
    })
  })

  // Simulate force-directed layout
  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, { fx: number; fy: number }>()
    
    // Initialize forces
    nodes.forEach(node => {
      forces.set(node.id, { fx: 0, fy: 0 })
    })

    // Repulsion forces (all nodes repel each other)
    nodes.forEach(nodeA => {
      nodes.forEach(nodeB => {
        if (nodeA.id === nodeB.id) return
        
        const posA = positions.get(nodeA.id)!
        const posB = positions.get(nodeB.id)!
        const forceA = forces.get(nodeA.id)!
        
        const dx = posA.x - posB.x
        const dy = posA.y - posB.y
        const distance = Math.sqrt(dx * dx + dy * dy) || 1
        
        const force = repulsionStrength / (distance * distance)
        forceA.fx += (dx / distance) * force
        forceA.fy += (dy / distance) * force
      })
    })

    // Attraction forces (connected nodes attract)
    edges.forEach(edge => {
      const posSource = positions.get(edge.source)
      const posTarget = positions.get(edge.target)
      const forceSource = forces.get(edge.source)
      const forceTarget = forces.get(edge.target)
      
      if (!posSource || !posTarget || !forceSource || !forceTarget) return
      
      const dx = posTarget.x - posSource.x
      const dy = posTarget.y - posSource.y
      const distance = Math.sqrt(dx * dx + dy * dy) || 1
      
      const force = attractionStrength * distance
      const fx = (dx / distance) * force
      const fy = (dy / distance) * force
      
      forceSource.fx += fx
      forceSource.fy += fy
      forceTarget.fx -= fx
      forceTarget.fy -= fy
    })

    // Update positions and apply damping
    nodes.forEach(node => {
      const pos = positions.get(node.id)!
      const force = forces.get(node.id)!
      
      pos.vx = (pos.vx + force.fx) * damping
      pos.vy = (pos.vy + force.fy) * damping
      
      pos.x += pos.vx
      pos.y += pos.vy
    })
  }

  // Return updated nodes
  return nodes.map(node => ({
    ...node,
    position: {
      x: Math.round(positions.get(node.id)!.x),
      y: Math.round(positions.get(node.id)!.y)
    }
  }))
}

/**
 * Apply grid snap to nodes
 */
export function snapToGrid(nodes: Node[], gridSize: number = 25): Node[] {
  return nodes.map(node => ({
    ...node,
    position: {
      x: Math.round(node.position.x / gridSize) * gridSize,
      y: Math.round(node.position.y / gridSize) * gridSize
    }
  }))
}

/**
 * Center nodes in viewport
 */
export function centerNodes(nodes: Node[]): Node[] {
  if (nodes.length === 0) return nodes

  const bounds = {
    minX: Math.min(...nodes.map(n => n.position.x)),
    maxX: Math.max(...nodes.map(n => n.position.x)),
    minY: Math.min(...nodes.map(n => n.position.y)),
    maxY: Math.max(...nodes.map(n => n.position.y))
  }

  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2

  return nodes.map(node => ({
    ...node,
    position: {
      x: node.position.x - centerX,
      y: node.position.y - centerY
    }
  }))
}