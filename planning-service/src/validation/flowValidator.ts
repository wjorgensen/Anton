import { Flow, FlowNode, FlowEdge, ValidationResult, DependencyGraph } from '../types';

export class FlowValidator {
  private agentDirectory: any;

  constructor(agentDirectory: any) {
    this.agentDirectory = agentDirectory;
  }

  validateFlow(flow: Flow): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    this.validateBasicStructure(flow, errors);
    this.validateNodes(flow.nodes, errors, warnings);
    this.validateEdges(flow.edges, flow.nodes, errors, warnings);
    this.validateDependencies(flow, errors, warnings);
    this.validateCycles(flow, errors);
    this.validateAgentCompatibility(flow, warnings);
    this.validateResourceRequirements(flow, warnings);
    this.generateSuggestions(flow, suggestions);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  private validateBasicStructure(flow: Flow, errors: string[]) {
    if (!flow.id) {
      errors.push('Flow must have a unique ID');
    }

    if (!flow.name) {
      errors.push('Flow must have a name');
    }

    if (!flow.nodes || flow.nodes.length === 0) {
      errors.push('Flow must contain at least one node');
    }

    if (!flow.edges) {
      errors.push('Flow must have edges array (can be empty)');
    }

    if (!flow.version || flow.version < 1) {
      errors.push('Flow must have a valid version number');
    }
  }

  private validateNodes(nodes: FlowNode[], errors: string[], warnings: string[]) {
    const nodeIds = new Set<string>();
    const agentIds = new Set<string>();

    nodes.forEach(node => {
      if (!node.id) {
        errors.push('Every node must have a unique ID');
      } else if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID found: ${node.id}`);
      } else {
        nodeIds.add(node.id);
      }

      if (!node.agentId) {
        errors.push(`Node ${node.id} must have an agentId`);
      } else if (!this.isValidAgent(node.agentId)) {
        errors.push(`Node ${node.id} references invalid agent: ${node.agentId}`);
      } else {
        agentIds.add(node.agentId);
      }

      if (!node.category) {
        errors.push(`Node ${node.id} must have a category`);
      }

      if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
        errors.push(`Node ${node.id} must have valid position coordinates`);
      }

      if (node.config) {
        if (node.config.maxRetries && node.config.maxRetries > 10) {
          warnings.push(`Node ${node.id} has high retry count (${node.config.maxRetries})`);
        }

        if (node.config.timeout && node.config.timeout > 3600) {
          warnings.push(`Node ${node.id} has very long timeout (${node.config.timeout}s)`);
        }
      }
    });

    const hasSetup = nodes.some(n => n.category === 'setup');
    if (!hasSetup) {
      warnings.push('Flow has no setup agent - project initialization may be incomplete');
    }

    const hasTesting = nodes.some(n => n.category === 'testing');
    if (!hasTesting) {
      warnings.push('Flow has no testing agents - consider adding tests for quality assurance');
    }
  }

  private validateEdges(edges: FlowEdge[], nodes: FlowNode[], errors: string[], warnings: string[]) {
    const nodeIds = new Set(nodes.map(n => n.id));
    const edgeIds = new Set<string>();

    edges.forEach(edge => {
      if (!edge.id) {
        errors.push('Every edge must have a unique ID');
      } else if (edgeIds.has(edge.id)) {
        errors.push(`Duplicate edge ID found: ${edge.id}`);
      } else {
        edgeIds.add(edge.id);
      }

      if (!edge.source || !nodeIds.has(edge.source)) {
        errors.push(`Edge ${edge.id} has invalid source node: ${edge.source}`);
      }

      if (!edge.target || !nodeIds.has(edge.target)) {
        errors.push(`Edge ${edge.id} has invalid target node: ${edge.target}`);
      }

      if (edge.source === edge.target) {
        errors.push(`Edge ${edge.id} creates a self-loop on node ${edge.source}`);
      }

      if (edge.condition && edge.condition.type === 'custom' && !edge.condition.expression) {
        warnings.push(`Edge ${edge.id} has custom condition without expression`);
      }
    });

    const duplicateEdges = this.findDuplicateEdges(edges);
    duplicateEdges.forEach(dup => {
      warnings.push(`Duplicate edge from ${dup.source} to ${dup.target}`);
    });
  }

  private validateDependencies(flow: Flow, errors: string[], warnings: string[]) {
    const graph = this.buildDependencyGraph(flow);
    
    const orphanNodes = this.findOrphanNodes(graph, flow.nodes);
    orphanNodes.forEach(nodeId => {
      const node = flow.nodes.find(n => n.id === nodeId);
      if (node && node.category !== 'setup') {
        warnings.push(`Node ${nodeId} (${node.agentId}) has no incoming connections`);
      }
    });

    const deadEnds = this.findDeadEnds(graph, flow.nodes);
    deadEnds.forEach(nodeId => {
      const node = flow.nodes.find(n => n.id === nodeId);
      if (node && node.category !== 'utility' && node.category !== 'review') {
        warnings.push(`Node ${nodeId} (${node.agentId}) has no outgoing connections`);
      }
    });

    const categoryDependencies = this.validateCategoryDependencies(flow);
    categoryDependencies.forEach(issue => warnings.push(issue));
  }

  private validateCycles(flow: Flow, errors: string[]) {
    const cycles = this.detectCycles(flow);
    
    cycles.forEach(cycle => {
      errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
    });
  }

  private detectCycles(flow: Flow): string[][] {
    const cycles: string[][] = [];
    const adjacency = new Map<string, Set<string>>();
    
    flow.edges.forEach(edge => {
      if (!adjacency.has(edge.source)) {
        adjacency.set(edge.source, new Set());
      }
      adjacency.get(edge.source)!.add(edge.target);
    });

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = adjacency.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true;
          }
        } else if (recStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart);
          cycle.push(neighbor);
          cycles.push(cycle);
          return true;
        }
      }

      path.pop();
      recStack.delete(node);
      return false;
    };

    flow.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    });

    return cycles;
  }

  private validateAgentCompatibility(flow: Flow, warnings: string[]) {
    const agentPairs = this.getConnectedAgentPairs(flow);
    
    agentPairs.forEach(([source, target]) => {
      const sourceNode = flow.nodes.find(n => n.id === source);
      const targetNode = flow.nodes.find(n => n.id === target);
      
      if (sourceNode && targetNode) {
        const compatibility = this.checkAgentCompatibility(
          sourceNode.agentId, 
          targetNode.agentId
        );
        
        if (!compatibility.compatible) {
          warnings.push(
            `Potential incompatibility between ${sourceNode.agentId} and ${targetNode.agentId}: ${compatibility.reason}`
          );
        }
      }
    });
  }

  private checkAgentCompatibility(sourceAgent: string, targetAgent: string): {
    compatible: boolean;
    reason?: string;
  } {
    if (sourceAgent.includes('python') && targetAgent.includes('jest')) {
      return {
        compatible: false,
        reason: 'Python agent output may not be testable with Jest (JavaScript test framework)'
      };
    }

    if (sourceAgent.includes('flutter') && targetAgent.includes('playwright')) {
      return {
        compatible: false,
        reason: 'Flutter mobile apps cannot be tested with Playwright (web browser automation)'
      };
    }

    if (sourceAgent.includes('rust') && targetAgent.includes('pytest')) {
      return {
        compatible: false,
        reason: 'Rust code should be tested with Rust testing tools, not Python pytest'
      };
    }

    return { compatible: true };
  }

  private validateResourceRequirements(flow: Flow, warnings: string[]) {
    let totalEstimatedTime = 0;
    let totalEstimatedTokens = 0;
    let maxParallel = 0;
    
    const layers = this.identifyLayers(flow);
    
    layers.forEach(layer => {
      let layerTime = 0;
      let layerTokens = 0;
      
      layer.forEach(nodeId => {
        const node = flow.nodes.find(n => n.id === nodeId);
        if (node) {
          layerTime = Math.max(layerTime, node.estimatedTime || 15);
          layerTokens += 50000;
        }
      });
      
      totalEstimatedTime += layerTime;
      totalEstimatedTokens += layerTokens;
      maxParallel = Math.max(maxParallel, layer.length);
    });

    if (totalEstimatedTime > 300) {
      warnings.push(`Flow estimated to take ${totalEstimatedTime} minutes - consider breaking into smaller flows`);
    }

    if (totalEstimatedTokens > 1000000) {
      warnings.push(`Flow estimated to use ${totalEstimatedTokens} tokens - high resource usage`);
    }

    if (maxParallel > 10) {
      warnings.push(`Flow requires ${maxParallel} parallel agents - may exceed system capacity`);
    }
  }

  private generateSuggestions(flow: Flow, suggestions: string[]) {
    const nodesByCategory = this.groupNodesByCategory(flow.nodes);

    if (!nodesByCategory.has('testing') || nodesByCategory.get('testing')!.length === 0) {
      suggestions.push('Consider adding testing agents to ensure code quality');
    }

    if (!nodesByCategory.has('review')) {
      suggestions.push('Consider adding review agents for quality gates');
    }

    const executionNodes = nodesByCategory.get('execution') || [];
    if (executionNodes.length > 5) {
      suggestions.push('Consider grouping related execution tasks to reduce complexity');
    }

    const hasDocumentation = flow.nodes.some(n => n.agentId === 'documentation');
    if (!hasDocumentation) {
      suggestions.push('Consider adding documentation agent to generate project docs');
    }

    const hasDeployment = flow.nodes.some(n => 
      n.agentId === 'deployment' || n.agentId === 'docker-builder'
    );
    if (!hasDeployment) {
      suggestions.push('Consider adding deployment automation for production readiness');
    }

    const parallelizationOpportunities = this.findParallelizationOpportunities(flow);
    if (parallelizationOpportunities.length > 0) {
      suggestions.push(
        `Nodes ${parallelizationOpportunities.join(', ')} could potentially run in parallel`
      );
    }
  }

  private isValidAgent(agentId: string): boolean {
    for (const category of Object.values(this.agentDirectory.categories)) {
      if ((category as any).agents?.includes(agentId)) {
        return true;
      }
    }
    return false;
  }

  private findDuplicateEdges(edges: FlowEdge[]): { source: string; target: string }[] {
    const seen = new Set<string>();
    const duplicates: { source: string; target: string }[] = [];
    
    edges.forEach(edge => {
      const key = `${edge.source}->${edge.target}`;
      if (seen.has(key)) {
        duplicates.push({ source: edge.source, target: edge.target });
      } else {
        seen.add(key);
      }
    });
    
    return duplicates;
  }

  private buildDependencyGraph(flow: Flow): DependencyGraph {
    const graph: DependencyGraph = {
      nodes: new Map(flow.nodes.map(n => [n.id, n])),
      edges: new Map(),
      layers: [],
      criticalPath: []
    };

    flow.edges.forEach(edge => {
      if (!graph.edges.has(edge.source)) {
        graph.edges.set(edge.source, new Set());
      }
      graph.edges.get(edge.source)!.add(edge.target);
    });

    return graph;
  }

  private findOrphanNodes(graph: DependencyGraph, nodes: FlowNode[]): string[] {
    const hasIncoming = new Set<string>();
    
    graph.edges.forEach(targets => {
      targets.forEach(target => hasIncoming.add(target));
    });
    
    return nodes
      .map(n => n.id)
      .filter(id => !hasIncoming.has(id) && graph.edges.has(id));
  }

  private findDeadEnds(graph: DependencyGraph, nodes: FlowNode[]): string[] {
    return nodes
      .map(n => n.id)
      .filter(id => !graph.edges.has(id) || graph.edges.get(id)!.size === 0);
  }

  private validateCategoryDependencies(flow: Flow): string[] {
    const issues: string[] = [];
    const categoryOrder = ['setup', 'execution', 'testing', 'integration', 'review', 'utility'];
    
    flow.edges.forEach(edge => {
      const sourceNode = flow.nodes.find(n => n.id === edge.source);
      const targetNode = flow.nodes.find(n => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        const sourceIndex = categoryOrder.indexOf(sourceNode.category);
        const targetIndex = categoryOrder.indexOf(targetNode.category);
        
        if (targetIndex < sourceIndex - 1) {
          issues.push(
            `Unusual flow: ${sourceNode.category} (${sourceNode.agentId}) -> ${targetNode.category} (${targetNode.agentId})`
          );
        }
      }
    });
    
    return issues;
  }

  private getConnectedAgentPairs(flow: Flow): [string, string][] {
    return flow.edges.map(edge => [edge.source, edge.target]);
  }

  private identifyLayers(flow: Flow): string[][] {
    const layers: string[][] = [];
    const visited = new Set<string>();
    const inDegree = new Map<string, number>();
    
    flow.nodes.forEach(node => {
      inDegree.set(node.id, 0);
    });
    
    flow.edges.forEach(edge => {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    });
    
    while (visited.size < flow.nodes.length) {
      const currentLayer = Array.from(inDegree.entries())
        .filter(([id, degree]) => degree === 0 && !visited.has(id))
        .map(([id]) => id);
      
      if (currentLayer.length === 0) break;
      
      layers.push(currentLayer);
      currentLayer.forEach(id => visited.add(id));
      
      flow.edges.forEach(edge => {
        if (currentLayer.includes(edge.source)) {
          inDegree.set(edge.target, (inDegree.get(edge.target) || 1) - 1);
        }
      });
    }
    
    return layers;
  }

  private groupNodesByCategory(nodes: FlowNode[]): Map<string, FlowNode[]> {
    const groups = new Map<string, FlowNode[]>();
    
    nodes.forEach(node => {
      if (!groups.has(node.category)) {
        groups.set(node.category, []);
      }
      groups.get(node.category)!.push(node);
    });
    
    return groups;
  }

  private findParallelizationOpportunities(flow: Flow): string[] {
    const opportunities: string[] = [];
    const layers = this.identifyLayers(flow);
    
    layers.forEach(layer => {
      const executionNodes = layer.filter(nodeId => {
        const node = flow.nodes.find(n => n.id === nodeId);
        return node && node.category === 'execution';
      });
      
      if (executionNodes.length === 1) {
        const node = flow.nodes.find(n => n.id === executionNodes[0]);
        if (node) {
          const similarNodes = flow.nodes.filter(n => 
            n.category === 'execution' && 
            n.id !== node.id &&
            !this.hasDependencyPath(flow, node.id, n.id) &&
            !this.hasDependencyPath(flow, n.id, node.id)
          );
          
          if (similarNodes.length > 0) {
            opportunities.push(node.agentId);
            similarNodes.forEach(n => opportunities.push(n.agentId));
          }
        }
      }
    });
    
    return [...new Set(opportunities)];
  }

  private hasDependencyPath(flow: Flow, from: string, to: string): boolean {
    const visited = new Set<string>();
    const queue = [from];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === to) return true;
      
      if (!visited.has(current)) {
        visited.add(current);
        
        flow.edges
          .filter(e => e.source === current)
          .forEach(e => queue.push(e.target));
      }
    }
    
    return false;
  }
}