import { FlowNode, FlowEdge, DependencyGraph, LayoutPosition } from '../types';

export class LayoutEngine {
  private readonly nodeWidth = 280;
  private readonly nodeHeight = 120;
  private readonly horizontalSpacing = 400;
  private readonly verticalSpacing = 200;
  private readonly canvasMargin = 100;

  generateLayout(nodes: FlowNode[], edges: FlowEdge[], graph?: DependencyGraph): FlowNode[] {
    if (graph && graph.layers.length > 0) {
      return this.layeredLayout(nodes, graph);
    }
    
    return this.forceDirectedLayout(nodes, edges);
  }

  private layeredLayout(nodes: FlowNode[], graph: DependencyGraph): FlowNode[] {
    const positioned = new Map<string, LayoutPosition>();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    let currentX = this.canvasMargin;
    
    graph.layers.forEach((layer, layerIndex) => {
      const layerNodes = layer
        .map(id => nodeMap.get(id))
        .filter(n => n !== undefined) as FlowNode[];
      
      const totalHeight = layerNodes.length * (this.nodeHeight + this.verticalSpacing) - this.verticalSpacing;
      const startY = this.canvasMargin + (Math.max(0, 3 - layerNodes.length) * this.verticalSpacing / 2);
      
      layerNodes.forEach((node, nodeIndex) => {
        const y = startY + nodeIndex * (this.nodeHeight + this.verticalSpacing);
        
        const incomingConnections = this.getIncomingConnections(node.id, graph);
        let x = currentX;
        
        if (incomingConnections.length > 0 && layerIndex > 0) {
          const avgSourceX = incomingConnections
            .map(sourceId => positioned.get(sourceId)?.x || currentX)
            .reduce((sum, x) => sum + x, 0) / incomingConnections.length;
          
          const offsetRange = 100;
          const offset = (Math.random() - 0.5) * offsetRange;
          x = avgSourceX + this.horizontalSpacing + offset;
        }
        
        positioned.set(node.id, { x, y, layer: layerIndex });
        
        node.position = { x, y };
      });
      
      currentX = Math.max(...layerNodes.map(n => n.position.x)) + this.nodeWidth + this.horizontalSpacing;
    });
    
    this.adjustForOverlaps(nodes);
    this.centerLayout(nodes);
    
    return nodes;
  }

  private forceDirectedLayout(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
    const adjacency = this.buildAdjacencyList(edges);
    const positions = this.initializePositions(nodes.length);
    
    const iterations = 50;
    const temperature = 100;
    const coolingRate = 0.95;
    
    for (let i = 0; i < iterations; i++) {
      const forces = this.calculateForces(nodes, positions, adjacency);
      this.applyForces(positions, forces, temperature * Math.pow(coolingRate, i));
    }
    
    nodes.forEach((node, index) => {
      node.position = positions[index];
    });
    
    this.adjustForOverlaps(nodes);
    this.centerLayout(nodes);
    
    return nodes;
  }

  private buildAdjacencyList(edges: FlowEdge[]): Map<string, Set<string>> {
    const adjacency = new Map<string, Set<string>>();
    
    edges.forEach(edge => {
      if (!adjacency.has(edge.source)) {
        adjacency.set(edge.source, new Set());
      }
      adjacency.get(edge.source)!.add(edge.target);
      
      if (!adjacency.has(edge.target)) {
        adjacency.set(edge.target, new Set());
      }
    });
    
    return adjacency;
  }

  private initializePositions(count: number): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    const radius = count * 50;
    
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count;
      positions.push({
        x: this.canvasMargin + radius + radius * Math.cos(angle),
        y: this.canvasMargin + radius + radius * Math.sin(angle)
      });
    }
    
    return positions;
  }

  private calculateForces(
    nodes: FlowNode[],
    positions: { x: number; y: number }[],
    adjacency: Map<string, Set<string>>
  ): { x: number; y: number }[] {
    const forces = positions.map(() => ({ x: 0, y: 0 }));
    const k = Math.sqrt((1000 * 1000) / nodes.length);
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const repulsion = (k * k) / distance;
        forces[i].x -= (repulsion * dx) / distance;
        forces[i].y -= (repulsion * dy) / distance;
        forces[j].x += (repulsion * dx) / distance;
        forces[j].y += (repulsion * dy) / distance;
      }
    }
    
    adjacency.forEach((targets, source) => {
      const sourceIndex = nodes.findIndex(n => n.id === source);
      if (sourceIndex === -1) return;
      
      targets.forEach(target => {
        const targetIndex = nodes.findIndex(n => n.id === target);
        if (targetIndex === -1) return;
        
        const dx = positions[targetIndex].x - positions[sourceIndex].x;
        const dy = positions[targetIndex].y - positions[sourceIndex].y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const attraction = (distance * distance) / k;
        forces[sourceIndex].x += (attraction * dx) / distance;
        forces[sourceIndex].y += (attraction * dy) / distance;
        forces[targetIndex].x -= (attraction * dx) / distance;
        forces[targetIndex].y -= (attraction * dy) / distance;
      });
    });
    
    return forces;
  }

  private applyForces(
    positions: { x: number; y: number }[],
    forces: { x: number; y: number }[],
    temperature: number
  ) {
    positions.forEach((pos, i) => {
      const force = forces[i];
      const magnitude = Math.sqrt(force.x * force.x + force.y * force.y);
      
      if (magnitude > 0) {
        const scale = Math.min(temperature, magnitude) / magnitude;
        pos.x += force.x * scale;
        pos.y += force.y * scale;
      }
    });
  }

  private adjustForOverlaps(nodes: FlowNode[]) {
    const iterations = 10;
    const pushForce = 50;
    
    for (let iter = 0; iter < iterations; iter++) {
      let hasOverlap = false;
      
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          
          const dx = n2.position.x - n1.position.x;
          const dy = n2.position.y - n1.position.y;
          
          const minDistX = this.nodeWidth + 50;
          const minDistY = this.nodeHeight + 50;
          
          if (Math.abs(dx) < minDistX && Math.abs(dy) < minDistY) {
            hasOverlap = true;
            
            const overlapX = minDistX - Math.abs(dx);
            const overlapY = minDistY - Math.abs(dy);
            
            const pushX = dx === 0 ? pushForce : (overlapX * Math.sign(dx)) / 2;
            const pushY = dy === 0 ? pushForce : (overlapY * Math.sign(dy)) / 2;
            
            n1.position.x -= pushX;
            n1.position.y -= pushY;
            n2.position.x += pushX;
            n2.position.y += pushY;
          }
        }
      }
      
      if (!hasOverlap) break;
    }
  }

  private centerLayout(nodes: FlowNode[]) {
    if (nodes.length === 0) return;
    
    const bounds = this.calculateBounds(nodes);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    const targetCenterX = 800;
    const targetCenterY = 400;
    
    const offsetX = targetCenterX - centerX;
    const offsetY = targetCenterY - centerY;
    
    nodes.forEach(node => {
      node.position.x += offsetX;
      node.position.y += offsetY;
    });
  }

  private calculateBounds(nodes: FlowNode[]) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x + this.nodeWidth);
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y + this.nodeHeight);
    });
    
    return { minX, maxX, minY, maxY };
  }

  private getIncomingConnections(nodeId: string, graph: DependencyGraph): string[] {
    const incoming: string[] = [];
    
    graph.edges.forEach((targets, sourceId) => {
      if (targets.has(nodeId)) {
        incoming.push(sourceId);
      }
    });
    
    return incoming;
  }

  optimizeLayout(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
    this.minimizeCrossings(nodes, edges);
    this.alignNodes(nodes, edges);
    this.compactLayout(nodes);
    
    return nodes;
  }

  private minimizeCrossings(nodes: FlowNode[], edges: FlowEdge[]) {
    const nodesByLayer = this.groupNodesByXPosition(nodes);
    
    nodesByLayer.forEach(layer => {
      let bestOrder = [...layer];
      let minCrossings = this.countCrossings(bestOrder, edges);
      
      for (let i = 0; i < layer.length; i++) {
        for (let j = i + 1; j < layer.length; j++) {
          const testOrder = [...layer];
          [testOrder[i], testOrder[j]] = [testOrder[j], testOrder[i]];
          
          const crossings = this.countCrossings(testOrder, edges);
          if (crossings < minCrossings) {
            minCrossings = crossings;
            bestOrder = testOrder;
          }
        }
      }
      
      bestOrder.forEach((node, index) => {
        node.position.y = this.canvasMargin + index * (this.nodeHeight + this.verticalSpacing);
      });
    });
  }

  private groupNodesByXPosition(nodes: FlowNode[]): FlowNode[][] {
    const layers = new Map<number, FlowNode[]>();
    
    nodes.forEach(node => {
      const layerX = Math.round(node.position.x / this.horizontalSpacing) * this.horizontalSpacing;
      if (!layers.has(layerX)) {
        layers.set(layerX, []);
      }
      layers.get(layerX)!.push(node);
    });
    
    return Array.from(layers.values());
  }

  private countCrossings(layer: FlowNode[], edges: FlowEdge[]): number {
    let crossings = 0;
    const positions = new Map(layer.map((n, i) => [n.id, i]));
    
    const relevantEdges = edges.filter(e => 
      positions.has(e.source) || positions.has(e.target)
    );
    
    for (let i = 0; i < relevantEdges.length; i++) {
      for (let j = i + 1; j < relevantEdges.length; j++) {
        const e1 = relevantEdges[i];
        const e2 = relevantEdges[j];
        
        const s1 = positions.get(e1.source) ?? -1;
        const t1 = positions.get(e1.target) ?? -1;
        const s2 = positions.get(e2.source) ?? -1;
        const t2 = positions.get(e2.target) ?? -1;
        
        if (s1 >= 0 && t1 >= 0 && s2 >= 0 && t2 >= 0) {
          if ((s1 - s2) * (t1 - t2) < 0) {
            crossings++;
          }
        }
      }
    }
    
    return crossings;
  }

  private alignNodes(nodes: FlowNode[], edges: FlowEdge[]) {
    const alignment = new Map<string, number>();
    
    edges.forEach(edge => {
      const source = nodes.find(n => n.id === edge.source);
      const target = nodes.find(n => n.id === edge.target);
      
      if (source && target) {
        const avgY = (source.position.y + target.position.y) / 2;
        
        if (!alignment.has(edge.source)) {
          alignment.set(edge.source, avgY);
        } else {
          alignment.set(edge.source, (alignment.get(edge.source)! + avgY) / 2);
        }
        
        if (!alignment.has(edge.target)) {
          alignment.set(edge.target, avgY);
        } else {
          alignment.set(edge.target, (alignment.get(edge.target)! + avgY) / 2);
        }
      }
    });
    
    nodes.forEach(node => {
      if (alignment.has(node.id)) {
        const targetY = alignment.get(node.id)!;
        node.position.y = node.position.y * 0.3 + targetY * 0.7;
      }
    });
  }

  private compactLayout(nodes: FlowNode[]) {
    const bounds = this.calculateBounds(nodes);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    
    if (width > 2000 || height > 1500) {
      const scaleX = Math.min(1, 2000 / width);
      const scaleY = Math.min(1, 1500 / height);
      const scale = Math.min(scaleX, scaleY);
      
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      
      nodes.forEach(node => {
        node.position.x = centerX + (node.position.x - centerX) * scale;
        node.position.y = centerY + (node.position.y - centerY) * scale;
      });
    }
  }
}