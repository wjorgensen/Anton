import { Flow, FlowNode, FlowEdge } from '../../types';

export class DependencyResolver {
  private flow: Flow;
  private adjacencyList: Map<string, Set<string>> = new Map();
  private reverseAdjacencyList: Map<string, Set<string>> = new Map();

  constructor(flow: Flow) {
    this.flow = flow;
    this.buildAdjacencyLists();
  }

  private buildAdjacencyLists(): void {
    for (const node of this.flow.nodes) {
      this.adjacencyList.set(node.id, new Set());
      this.reverseAdjacencyList.set(node.id, new Set());
    }

    for (const edge of this.flow.edges) {
      const sourceSet = this.adjacencyList.get(edge.source);
      const targetSet = this.reverseAdjacencyList.get(edge.target);

      if (sourceSet) {
        sourceSet.add(edge.target);
      }
      if (targetSet) {
        targetSet.add(edge.source);
      }
    }
  }

  createExecutionPlan(): string[][] {
    const inDegree = new Map<string, number>();
    const layers: string[][] = [];
    
    for (const node of this.flow.nodes) {
      const dependencies = this.reverseAdjacencyList.get(node.id) || new Set();
      inDegree.set(node.id, dependencies.size);
    }

    const processed = new Set<string>();

    while (processed.size < this.flow.nodes.length) {
      const currentLayer: string[] = [];
      
      for (const [nodeId, degree] of inDegree) {
        if (degree === 0 && !processed.has(nodeId)) {
          currentLayer.push(nodeId);
        }
      }

      if (currentLayer.length === 0 && processed.size < this.flow.nodes.length) {
        throw new Error('Circular dependency detected in flow');
      }

      for (const nodeId of currentLayer) {
        processed.add(nodeId);
        const dependents = this.adjacencyList.get(nodeId) || new Set();
        
        for (const dependent of dependents) {
          const currentDegree = inDegree.get(dependent) || 0;
          inDegree.set(dependent, currentDegree - 1);
        }
      }

      if (currentLayer.length > 0) {
        layers.push(currentLayer);
      }
    }

    return layers;
  }

  getNodeDependencies(nodeId: string): string[] {
    return Array.from(this.reverseAdjacencyList.get(nodeId) || new Set());
  }

  getDependentNodes(nodeId: string): string[] {
    return Array.from(this.adjacencyList.get(nodeId) || new Set());
  }

  hasCycles(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycleDFS = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = this.adjacencyList.get(nodeId) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycleDFS(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of this.flow.nodes) {
      if (!visited.has(node.id)) {
        if (hasCycleDFS(node.id)) {
          return true;
        }
      }
    }

    return false;
  }

  findOrphanNodes(): string[] {
    const orphans: string[] = [];

    for (const node of this.flow.nodes) {
      const hasIncoming = (this.reverseAdjacencyList.get(node.id)?.size || 0) > 0;
      const hasOutgoing = (this.adjacencyList.get(node.id)?.size || 0) > 0;
      
      if (!hasIncoming && !hasOutgoing && this.flow.nodes.length > 1) {
        orphans.push(node.id);
      }
    }

    return orphans;
  }

  getCriticalPath(): string[] {
    const nodeWeights = new Map<string, number>();
    
    for (const node of this.flow.nodes) {
      nodeWeights.set(node.id, node.config.timeout || 60000);
    }

    const distance = new Map<string, number>();
    const parent = new Map<string, string | null>();
    
    const topologicalOrder = this.topologicalSort();
    
    for (const nodeId of topologicalOrder) {
      distance.set(nodeId, 0);
      parent.set(nodeId, null);
    }

    const startNodes = this.flow.nodes.filter(
      node => (this.reverseAdjacencyList.get(node.id)?.size || 0) === 0
    );

    for (const startNode of startNodes) {
      distance.set(startNode.id, nodeWeights.get(startNode.id) || 0);
    }

    for (const nodeId of topologicalOrder) {
      const currentDistance = distance.get(nodeId) || 0;
      const dependents = this.adjacencyList.get(nodeId) || new Set();
      
      for (const dependent of dependents) {
        const edgeWeight = nodeWeights.get(dependent) || 0;
        const tentativeDistance = currentDistance + edgeWeight;
        
        if (tentativeDistance > (distance.get(dependent) || 0)) {
          distance.set(dependent, tentativeDistance);
          parent.set(dependent, nodeId);
        }
      }
    }

    let maxDistance = 0;
    let endNode: string | null = null;
    
    for (const [nodeId, dist] of distance) {
      if (dist > maxDistance) {
        maxDistance = dist;
        endNode = nodeId;
      }
    }

    const path: string[] = [];
    let current = endNode;
    
    while (current) {
      path.unshift(current);
      current = parent.get(current) || null;
    }

    return path;
  }

  private topologicalSort(): string[] {
    const visited = new Set<string>();
    const stack: string[] = [];

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      const neighbors = this.adjacencyList.get(nodeId) || new Set();
      
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        }
      }
      
      stack.push(nodeId);
    };

    for (const node of this.flow.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return stack.reverse();
  }

  getParallelizationScore(): number {
    const layers = this.createExecutionPlan();
    const totalNodes = this.flow.nodes.length;
    
    if (totalNodes === 0) return 0;
    
    const maxParallelNodes = Math.max(...layers.map(layer => layer.length));
    
    return maxParallelNodes / totalNodes;
  }
}