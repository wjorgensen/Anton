import { readFileSync } from 'fs';
import { join } from 'path';
import { RequirementAnalyzer } from './analyzer/requirementAnalyzer';
import { FlowGenerator } from './generator/flowGenerator';
import { LayoutEngine } from './layout/layoutEngine';
import { FlowValidator } from './validation/flowValidator';
import { 
  ProjectRequirements, 
  Flow, 
  PlanningResult,
  DependencyGraph 
} from './types';

export class FlowPlanningService {
  private requirementAnalyzer: RequirementAnalyzer;
  private flowGenerator: FlowGenerator;
  private layoutEngine: LayoutEngine;
  private flowValidator: FlowValidator;
  private agentDirectory: any;

  constructor(agentDirectoryPath?: string) {
    const directoryPath = agentDirectoryPath || join(__dirname, '../../agents/directory.json');
    this.agentDirectory = JSON.parse(readFileSync(directoryPath, 'utf-8'));
    
    this.requirementAnalyzer = new RequirementAnalyzer();
    this.flowGenerator = new FlowGenerator(this.agentDirectory);
    this.layoutEngine = new LayoutEngine();
    this.flowValidator = new FlowValidator(this.agentDirectory);
  }

  async planFlow(description: string): Promise<PlanningResult> {
    console.log('📋 Analyzing requirements...');
    const requirements = this.requirementAnalyzer.analyze(description);
    
    console.log('🔧 Generating flow...');
    const flow = await this.flowGenerator.generateFlow(requirements);
    
    console.log('📐 Creating visual layout...');
    const graph = this.buildDependencyGraph(flow);
    flow.nodes = this.layoutEngine.generateLayout(flow.nodes, flow.edges, graph);
    
    console.log('✅ Validating flow integrity...');
    const validation = this.flowValidator.validateFlow(flow);
    
    const metrics = this.calculateMetrics(flow, graph);
    
    return {
      flow,
      graph,
      validation,
      metrics
    };
  }

  async planFlowFromRequirements(requirements: ProjectRequirements): Promise<PlanningResult> {
    console.log('🔧 Generating flow from requirements...');
    const flow = await this.flowGenerator.generateFlow(requirements);
    
    console.log('📐 Creating visual layout...');
    const graph = this.buildDependencyGraph(flow);
    flow.nodes = this.layoutEngine.generateLayout(flow.nodes, flow.edges, graph);
    
    console.log('✅ Validating flow integrity...');
    const validation = this.flowValidator.validateFlow(flow);
    
    const metrics = this.calculateMetrics(flow, graph);
    
    return {
      flow,
      graph,
      validation,
      metrics
    };
  }

  optimizeFlow(flow: Flow): Flow {
    console.log('🚀 Optimizing flow...');
    
    flow.nodes = this.layoutEngine.optimizeLayout(flow.nodes, flow.edges);
    
    const parallelEdges = this.identifyParallelizationOpportunities(flow);
    parallelEdges.forEach(edge => {
      edge.condition = { type: 'success' };
    });
    
    const redundantEdges = this.findRedundantEdges(flow);
    flow.edges = flow.edges.filter(e => !redundantEdges.includes(e.id));
    
    return flow;
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

    graph.layers = this.topologicalSort(flow);
    graph.criticalPath = this.findCriticalPath(graph);

    return graph;
  }

  private topologicalSort(flow: Flow): string[][] {
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
      
      if (currentLayer.length === 0) {
        const remaining = flow.nodes.filter(n => !visited.has(n.id)).map(n => n.id);
        if (remaining.length > 0) {
          layers.push(remaining);
          break;
        }
        break;
      }
      
      layers.push(currentLayer);
      currentLayer.forEach(id => visited.add(id));
      
      flow.edges.forEach(edge => {
        if (currentLayer.includes(edge.source)) {
          inDegree.set(edge.target, Math.max(0, (inDegree.get(edge.target) || 1) - 1));
        }
      });
    }
    
    return layers;
  }

  private findCriticalPath(graph: DependencyGraph): string[] {
    const nodeTime = new Map<string, number>();
    const nodeParent = new Map<string, string | null>();
    
    graph.nodes.forEach((node, id) => {
      nodeTime.set(id, node.estimatedTime || 15);
      nodeParent.set(id, null);
    });
    
    const topOrder: string[] = [];
    graph.layers.forEach(layer => topOrder.push(...layer));
    
    const dist = new Map<string, number>();
    topOrder.forEach(id => dist.set(id, nodeTime.get(id) || 0));
    
    for (const sourceId of topOrder) {
      const targets = graph.edges.get(sourceId) || new Set();
      for (const targetId of targets) {
        const newDist = (dist.get(sourceId) || 0) + (nodeTime.get(targetId) || 0);
        if (newDist > (dist.get(targetId) || 0)) {
          dist.set(targetId, newDist);
          nodeParent.set(targetId, sourceId);
        }
      }
    }
    
    let maxDist = 0;
    let endNode: string | null = null;
    dist.forEach((d, id) => {
      if (d > maxDist) {
        maxDist = d;
        endNode = id;
      }
    });
    
    const path: string[] = [];
    let current: string | null | undefined = endNode;
    while (current) {
      path.unshift(current);
      current = nodeParent.get(current) || null;
    }
    
    return path;
  }

  private calculateMetrics(flow: Flow, graph: DependencyGraph): PlanningResult['metrics'] {
    const maxParallelism = Math.max(...graph.layers.map(l => l.length));
    
    const estimatedTime = graph.layers.reduce((total, layer) => {
      const maxLayerTime = Math.max(...layer.map(id => {
        const node = flow.nodes.find(n => n.id === id);
        return node?.estimatedTime || 15;
      }));
      return total + maxLayerTime;
    }, 0);
    
    const estimatedTokens = flow.nodes.length * 50000;
    
    const criticalPathLength = graph.criticalPath.reduce((total, nodeId) => {
      const node = flow.nodes.find(n => n.id === nodeId);
      return total + (node?.estimatedTime || 15);
    }, 0);

    return {
      totalNodes: flow.nodes.length,
      totalEdges: flow.edges.length,
      maxParallelism,
      estimatedTime,
      estimatedTokens,
      criticalPathLength
    };
  }

  private identifyParallelizationOpportunities(flow: Flow): typeof flow.edges {
    const opportunities: typeof flow.edges = [];
    
    flow.nodes.forEach(node1 => {
      flow.nodes.forEach(node2 => {
        if (node1.id !== node2.id && 
            node1.category === node2.category &&
            !this.hasPath(flow, node1.id, node2.id) &&
            !this.hasPath(flow, node2.id, node1.id)) {
          
          const existingEdge = flow.edges.find(e => 
            (e.source === node1.id && e.target === node2.id) ||
            (e.source === node2.id && e.target === node1.id)
          );
          
          if (existingEdge) {
            opportunities.push(existingEdge);
          }
        }
      });
    });
    
    return opportunities;
  }

  private hasPath(flow: Flow, from: string, to: string): boolean {
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

  private findRedundantEdges(flow: Flow): string[] {
    const redundant: string[] = [];
    
    flow.edges.forEach(edge => {
      const alternativePaths = flow.edges.filter(e => 
        e.id !== edge.id && 
        e.source === edge.source
      );
      
      for (const altEdge of alternativePaths) {
        if (this.hasPath(flow, altEdge.target, edge.target)) {
          redundant.push(edge.id);
          break;
        }
      }
    });
    
    return redundant;
  }

  exportFlow(flow: Flow, format: 'json' | 'yaml' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(flow, null, 2);
    }
    
    throw new Error('YAML export not yet implemented');
  }
}

export * from './types';
export { RequirementAnalyzer } from './analyzer/requirementAnalyzer';
export { FlowGenerator } from './generator/flowGenerator';
export { LayoutEngine } from './layout/layoutEngine';
export { FlowValidator } from './validation/flowValidator';