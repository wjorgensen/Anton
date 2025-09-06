import { v4 as uuidv4 } from 'uuid';
import { 
  Flow, 
  FlowNode, 
  FlowEdge, 
  ProjectRequirements, 
  PlanningContext,
  AgentSelection,
  DependencyGraph
} from '../types';

export class FlowGenerator {
  private agentDirectory: any;
  private agentLibrary: Map<string, any> = new Map();

  constructor(agentDirectory: any) {
    this.agentDirectory = agentDirectory;
    this.loadAgentLibrary();
  }

  private loadAgentLibrary() {
    for (const [category, categoryData] of Object.entries(this.agentDirectory.categories)) {
      const agents = (categoryData as any).agents || [];
      agents.forEach((agentId: string) => {
        this.agentLibrary.set(agentId, { 
          category, 
          ...(typeof categoryData === 'object' ? categoryData : {})
        });
      });
    }
  }

  async generateFlow(requirements: ProjectRequirements): Promise<Flow> {
    const flowId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const agentSelections = this.selectAgents(requirements);
    const nodes = this.createNodes(agentSelections, requirements);
    const graph = this.buildDependencyGraph(nodes, requirements);
    const edges = this.createEdges(graph);
    
    const flow: Flow = {
      id: flowId,
      version: 1,
      name: this.generateFlowName(requirements),
      description: requirements.description,
      created: timestamp,
      modified: timestamp,
      nodes: Array.from(graph.nodes.values()),
      edges,
      metadata: {
        projectType: requirements.projectType,
        estimatedTotalTime: this.calculateTotalTime(graph),
        estimatedTotalTokens: this.calculateTotalTokens(nodes),
        environment: this.generateEnvironment(requirements),
        secrets: this.identifySecrets(requirements)
      }
    };

    return flow;
  }

  private selectAgents(requirements: ProjectRequirements): AgentSelection[] {
    const selections: AgentSelection[] = [];
    
    const setupAgent = this.selectSetupAgent(requirements);
    if (setupAgent) selections.push(setupAgent);

    const executionAgents = this.selectExecutionAgents(requirements);
    selections.push(...executionAgents);

    const testingAgents = this.selectTestingAgents(requirements);
    selections.push(...testingAgents);

    const integrationAgents = this.selectIntegrationAgents(requirements);
    selections.push(...integrationAgents);

    const reviewAgents = this.selectReviewAgents(requirements);
    selections.push(...reviewAgents);

    const utilityAgents = this.selectUtilityAgents(requirements);
    selections.push(...utilityAgents);

    return selections;
  }

  private selectSetupAgent(requirements: ProjectRequirements): AgentSelection | null {
    const { technology, projectType } = requirements;
    
    const setupPriority = [
      { tech: 'nextjs', agent: 'nextjs-setup' },
      { tech: 'react', agent: 'vite-react-setup' },
      { tech: 'vue', agent: 'vue-setup' },
      { tech: 'angular', agent: 'angular-setup' },
      { tech: 'django', agent: 'django-setup' },
      { tech: 'fastapi', agent: 'fastapi-setup' },
      { tech: 'express', agent: 'express-setup' },
      { tech: 'nestjs', agent: 'nestjs-setup' },
      { tech: 'rails', agent: 'rails-setup' },
      { tech: 'spring', agent: 'spring-boot-setup' },
      { tech: 'laravel', agent: 'laravel-setup' },
      { tech: 'flutter', agent: 'flutter-setup' }
    ];

    for (const { tech, agent } of setupPriority) {
      if (technology?.frontend?.includes(tech) || 
          technology?.backend?.includes(tech) ||
          requirements.description.toLowerCase().includes(tech)) {
        return {
          agentId: agent,
          reason: `Selected ${agent} based on ${tech} technology requirement`,
          confidence: 0.9
        };
      }
    }

    if (projectType === 'web' || projectType === 'fullstack') {
      return {
        agentId: 'nextjs-setup',
        reason: 'Default setup for web/fullstack projects',
        confidence: 0.7
      };
    } else if (projectType === 'api' || projectType === 'microservice') {
      return {
        agentId: 'express-setup',
        reason: 'Default setup for API/microservice projects',
        confidence: 0.7
      };
    } else if (projectType === 'mobile') {
      return {
        agentId: 'flutter-setup',
        reason: 'Default setup for mobile projects',
        confidence: 0.7
      };
    }

    return null;
  }

  private selectExecutionAgents(requirements: ProjectRequirements): AgentSelection[] {
    const selections: AgentSelection[] = [];
    const { technology, features, projectType } = requirements;

    if (technology?.frontend?.includes('react') || projectType === 'web') {
      selections.push({
        agentId: 'react-developer',
        reason: 'Frontend development with React',
        confidence: 0.9
      });
    }

    if (technology?.frontend?.includes('vue')) {
      selections.push({
        agentId: 'vue-developer',
        reason: 'Frontend development with Vue',
        confidence: 0.9
      });
    }

    if (technology?.frontend?.includes('angular')) {
      selections.push({
        agentId: 'angular-developer',
        reason: 'Frontend development with Angular',
        confidence: 0.9
      });
    }

    if (technology?.backend?.includes('nodejs') || features?.includes('api')) {
      selections.push({
        agentId: 'nodejs-backend',
        reason: 'Backend development with Node.js',
        confidence: 0.9
      });
    }

    if (technology?.backend?.includes('python')) {
      selections.push({
        agentId: 'python-developer',
        reason: 'Backend development with Python',
        confidence: 0.9
      });
    }

    if (technology?.backend?.includes('go')) {
      selections.push({
        agentId: 'go-developer',
        reason: 'Backend development with Go',
        confidence: 0.9
      });
    }

    if (features?.includes('database') || technology?.database) {
      selections.push({
        agentId: 'database-developer',
        reason: 'Database setup and integration',
        confidence: 0.8
      });
    }

    if (features?.includes('api') && !selections.some(s => s.agentId === 'api-developer')) {
      selections.push({
        agentId: 'api-developer',
        reason: 'API development and integration',
        confidence: 0.8
      });
    }

    if (technology?.backend?.includes('graphql') || requirements.description.includes('graphql')) {
      selections.push({
        agentId: 'graphql-developer',
        reason: 'GraphQL API development',
        confidence: 0.9
      });
    }

    if (projectType === 'mobile') {
      selections.push({
        agentId: 'mobile-developer',
        reason: 'Mobile application development',
        confidence: 0.9
      });
    }

    return selections;
  }

  private selectTestingAgents(requirements: ProjectRequirements): AgentSelection[] {
    const selections: AgentSelection[] = [];
    const { technology, preferences } = requirements;

    if (preferences?.testing === 'none') {
      return selections;
    }

    if (technology?.testing?.includes('jest') || 
        technology?.frontend?.includes('react')) {
      selections.push({
        agentId: 'jest-tester',
        reason: 'Unit testing with Jest',
        confidence: 0.9
      });
    }

    if (technology?.testing?.includes('pytest') || 
        technology?.backend?.includes('python')) {
      selections.push({
        agentId: 'pytest-runner',
        reason: 'Python testing with Pytest',
        confidence: 0.9
      });
    }

    if (preferences?.testing === 'comprehensive' || 
        technology?.testing?.includes('playwright')) {
      selections.push({
        agentId: 'playwright-e2e',
        reason: 'End-to-end testing with Playwright',
        confidence: 0.8
      });
    } else if (technology?.testing?.includes('cypress')) {
      selections.push({
        agentId: 'cypress-tester',
        reason: 'End-to-end testing with Cypress',
        confidence: 0.8
      });
    }

    if (technology?.backend?.includes('go')) {
      selections.push({
        agentId: 'go-test-runner',
        reason: 'Go testing framework',
        confidence: 0.9
      });
    }

    if (requirements.features?.includes('performance')) {
      selections.push({
        agentId: 'k6-performance',
        reason: 'Performance testing with K6',
        confidence: 0.7
      });
    }

    return selections;
  }

  private selectIntegrationAgents(requirements: ProjectRequirements): AgentSelection[] {
    const selections: AgentSelection[] = [];
    const { features, preferences } = requirements;

    selections.push({
      agentId: 'git-merger',
      reason: 'Git integration and version control',
      confidence: 0.9
    });

    if (features?.includes('api')) {
      selections.push({
        agentId: 'api-integrator',
        reason: 'API integration and connection',
        confidence: 0.8
      });
    }

    if (features?.includes('database')) {
      selections.push({
        agentId: 'db-migrator',
        reason: 'Database migration management',
        confidence: 0.8
      });
    }

    if (preferences?.deployment || features?.includes('deployment')) {
      selections.push({
        agentId: 'docker-builder',
        reason: 'Docker containerization',
        confidence: 0.8
      });

      selections.push({
        agentId: 'ci-cd-runner',
        reason: 'CI/CD pipeline setup',
        confidence: 0.7
      });
    }

    return selections;
  }

  private selectReviewAgents(requirements: ProjectRequirements): AgentSelection[] {
    const selections: AgentSelection[] = [];
    const { preferences, features } = requirements;

    if (preferences?.review === 'manual' || preferences?.review === 'both') {
      selections.push({
        agentId: 'manual-review',
        reason: 'Manual code review checkpoint',
        confidence: 0.9
      });
    }

    if (preferences?.review === 'automated' || preferences?.review === 'both') {
      selections.push({
        agentId: 'code-review',
        reason: 'Automated code review',
        confidence: 0.8
      });
    }

    if (features?.includes('security') || features?.includes('authentication')) {
      selections.push({
        agentId: 'security-review',
        reason: 'Security analysis and review',
        confidence: 0.8
      });
    }

    return selections;
  }

  private selectUtilityAgents(requirements: ProjectRequirements): AgentSelection[] {
    const selections: AgentSelection[] = [];
    const { preferences, features } = requirements;

    if (preferences?.documentation || features?.includes('documentation')) {
      selections.push({
        agentId: 'documentation',
        reason: 'Documentation generation',
        confidence: 0.8
      });
    }

    if (preferences?.deployment || features?.includes('deployment')) {
      selections.push({
        agentId: 'deployment',
        reason: 'Deployment automation',
        confidence: 0.8
      });
    }

    selections.push({
      agentId: 'summarizer',
      reason: 'Project summary and reporting',
      confidence: 0.7
    });

    return selections;
  }

  private createNodes(
    selections: AgentSelection[], 
    requirements: ProjectRequirements
  ): FlowNode[] {
    return selections.map((selection, index) => {
      const agentCategory = this.getAgentCategory(selection.agentId);
      
      return {
        id: `node-${index + 1}`,
        agentId: selection.agentId,
        label: this.generateNodeLabel(selection.agentId),
        category: agentCategory,
        instructions: this.generateInstructions(selection.agentId, requirements),
        inputs: this.generateInputs(selection.agentId, requirements),
        position: { x: 0, y: 0 },
        config: {
          retryOnFailure: true,
          maxRetries: 3,
          timeout: this.getAgentTimeout(selection.agentId),
          requiresReview: this.shouldRequireReview(selection.agentId, requirements)
        },
        status: 'pending',
        estimatedTime: this.getEstimatedTime(selection.agentId)
      };
    });
  }

  private buildDependencyGraph(
    nodes: FlowNode[], 
    requirements: ProjectRequirements
  ): DependencyGraph {
    const graph: DependencyGraph = {
      nodes: new Map(),
      edges: new Map(),
      layers: [],
      criticalPath: []
    };

    nodes.forEach(node => {
      graph.nodes.set(node.id, node);
      graph.edges.set(node.id, new Set());
    });

    const categoryOrder = ['setup', 'execution', 'testing', 'integration', 'review', 'utility'];
    const nodesByCategory = new Map<string, FlowNode[]>();
    
    categoryOrder.forEach(category => {
      nodesByCategory.set(category, nodes.filter(n => n.category === category));
    });

    let previousLayer: string[] = [];
    
    for (const category of categoryOrder) {
      const categoryNodes = nodesByCategory.get(category) || [];
      
      if (categoryNodes.length === 0) continue;

      const currentLayer = categoryNodes.map(n => n.id);
      
      if (previousLayer.length > 0) {
        for (const sourceId of previousLayer) {
          for (const targetId of currentLayer) {
            const source = graph.nodes.get(sourceId)!;
            const target = graph.nodes.get(targetId)!;
            
            if (this.shouldConnect(source, target, requirements)) {
              graph.edges.get(sourceId)?.add(targetId);
            }
          }
        }
      }

      graph.layers.push(currentLayer);
      
      if (category !== 'review' && category !== 'utility') {
        previousLayer = currentLayer;
      }
    }

    graph.criticalPath = this.findCriticalPath(graph);

    return graph;
  }

  private shouldConnect(
    source: FlowNode, 
    target: FlowNode, 
    requirements: ProjectRequirements
  ): boolean {
    if (source.category === 'setup' && target.category === 'execution') {
      return true;
    }

    if (source.category === 'execution' && target.category === 'testing') {
      const sourceType = source.agentId.split('-')[0];
      const targetType = target.agentId.split('-')[0];
      
      if (sourceType === 'react' && targetType === 'jest') return true;
      if (sourceType === 'python' && targetType === 'pytest') return true;
      if (sourceType === 'nodejs' && targetType === 'jest') return true;
      if (sourceType === 'go' && targetType === 'go') return true;
      
      return target.agentId.includes('e2e') || target.agentId.includes('playwright');
    }

    if (source.category === 'testing' && target.category === 'integration') {
      return true;
    }

    if (source.category === 'integration' && target.category === 'review') {
      return true;
    }

    if ((source.category === 'review' || source.category === 'integration') && 
        target.category === 'utility') {
      return true;
    }

    return false;
  }

  private createEdges(graph: DependencyGraph): FlowEdge[] {
    const edges: FlowEdge[] = [];
    let edgeId = 1;

    graph.edges.forEach((targets, sourceId) => {
      targets.forEach(targetId => {
        edges.push({
          id: `edge-${edgeId++}`,
          source: sourceId,
          target: targetId,
          condition: {
            type: 'success'
          }
        });
      });
    });

    return edges;
  }

  private findCriticalPath(graph: DependencyGraph): string[] {
    const path: string[] = [];
    const visited = new Set<string>();
    
    const getMaxTimeNode = (layer: string[]): string | null => {
      let maxTime = 0;
      let maxNode: string | null = null;
      
      for (const nodeId of layer) {
        if (visited.has(nodeId)) continue;
        
        const node = graph.nodes.get(nodeId);
        if (node && (node.estimatedTime || 0) > maxTime) {
          maxTime = node.estimatedTime || 0;
          maxNode = nodeId;
        }
      }
      
      return maxNode;
    };

    for (const layer of graph.layers) {
      const criticalNode = getMaxTimeNode(layer);
      if (criticalNode) {
        path.push(criticalNode);
        visited.add(criticalNode);
      }
    }

    return path;
  }

  private getAgentCategory(agentId: string): FlowNode['category'] {
    for (const [category, data] of Object.entries(this.agentDirectory.categories)) {
      if ((data as any).agents.includes(agentId)) {
        return category as FlowNode['category'];
      }
    }
    return 'execution';
  }

  private generateNodeLabel(agentId: string): string {
    return agentId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private generateInstructions(agentId: string, requirements: ProjectRequirements): string {
    const baseInstructions = `Execute ${agentId} agent for project: ${requirements.description}`;
    
    const contextualInstructions: string[] = [];
    
    if (requirements.technology) {
      contextualInstructions.push(
        `Technology stack: ${JSON.stringify(requirements.technology)}`
      );
    }
    
    if (requirements.features) {
      contextualInstructions.push(
        `Required features: ${requirements.features.join(', ')}`
      );
    }
    
    if (requirements.preferences) {
      contextualInstructions.push(
        `Preferences: ${JSON.stringify(requirements.preferences)}`
      );
    }

    return `${baseInstructions}\n\n${contextualInstructions.join('\n')}`;
  }

  private generateInputs(agentId: string, requirements: ProjectRequirements): Record<string, any> {
    const inputs: Record<string, any> = {};

    if (agentId.includes('setup')) {
      inputs.projectName = requirements.description.split(' ').slice(0, 3).join('-').toLowerCase();
      inputs.features = requirements.features || [];
      
      if (requirements.technology?.database) {
        inputs.database = requirements.technology.database[0];
      }
      
      if (requirements.features?.includes('authentication')) {
        inputs.authentication = 'nextauth';
      }
      
      inputs.testing = requirements.preferences?.testing !== 'none';
    }

    if (agentId.includes('developer')) {
      inputs.features = requirements.features || [];
      inputs.technology = requirements.technology || {};
    }

    if (agentId.includes('tester') || agentId.includes('runner')) {
      inputs.testingLevel = requirements.preferences?.testing || 'basic';
      inputs.coverage = requirements.preferences?.testing === 'comprehensive' ? 80 : 60;
    }

    return inputs;
  }

  private getAgentTimeout(agentId: string): number {
    if (agentId.includes('setup')) return 600;
    if (agentId.includes('e2e')) return 900;
    if (agentId.includes('performance')) return 1200;
    if (agentId.includes('build')) return 600;
    return 300;
  }

  private shouldRequireReview(agentId: string, requirements: ProjectRequirements): boolean {
    if (requirements.preferences?.review === 'manual') {
      return agentId.includes('developer') || agentId.includes('integration');
    }
    
    if (requirements.features?.includes('security')) {
      return agentId.includes('auth') || agentId.includes('payment');
    }
    
    return false;
  }

  private getEstimatedTime(agentId: string): number {
    const timeMap: Record<string, number> = {
      'setup': 10,
      'developer': 30,
      'tester': 15,
      'runner': 10,
      'e2e': 20,
      'performance': 25,
      'integrator': 15,
      'merger': 5,
      'migrator': 10,
      'builder': 15,
      'review': 10,
      'documentation': 10,
      'deployment': 20,
      'summarizer': 5
    };

    for (const [key, time] of Object.entries(timeMap)) {
      if (agentId.includes(key)) {
        return time;
      }
    }

    return 15;
  }

  private calculateTotalTime(graph: DependencyGraph): number {
    let totalTime = 0;
    
    for (const layer of graph.layers) {
      let maxLayerTime = 0;
      
      for (const nodeId of layer) {
        const node = graph.nodes.get(nodeId);
        if (node) {
          maxLayerTime = Math.max(maxLayerTime, node.estimatedTime || 0);
        }
      }
      
      totalTime += maxLayerTime;
    }

    return totalTime;
  }

  private calculateTotalTokens(nodes: FlowNode[]): number {
    const baseTokensPerAgent = 50000;
    return nodes.length * baseTokensPerAgent;
  }

  private generateEnvironment(requirements: ProjectRequirements): Record<string, string> {
    const env: Record<string, string> = {
      NODE_ENV: 'development',
      PROJECT_TYPE: requirements.projectType || 'fullstack'
    };

    if (requirements.technology?.database?.includes('postgres')) {
      env.DATABASE_URL = 'postgresql://user:password@localhost:5432/dbname';
    }

    if (requirements.features?.includes('authentication')) {
      env.AUTH_SECRET = 'development-secret';
      env.NEXTAUTH_URL = 'http://localhost:3000';
    }

    return env;
  }

  private identifySecrets(requirements: ProjectRequirements): string[] {
    const secrets: string[] = [];

    if (requirements.features?.includes('authentication')) {
      secrets.push('AUTH_SECRET', 'JWT_SECRET');
    }

    if (requirements.features?.includes('payment')) {
      secrets.push('STRIPE_SECRET_KEY', 'PAYMENT_API_KEY');
    }

    if (requirements.technology?.database) {
      secrets.push('DATABASE_URL', 'DB_PASSWORD');
    }

    if (requirements.features?.includes('api')) {
      secrets.push('API_KEY', 'API_SECRET');
    }

    return secrets;
  }

  private generateFlowName(requirements: ProjectRequirements): string {
    const { projectType, technology } = requirements;
    
    let name = projectType ? `${projectType} project` : 'Project';
    
    if (technology?.frontend?.[0]) {
      name = `${technology.frontend[0]} ${name}`;
    } else if (technology?.backend?.[0]) {
      name = `${technology.backend[0]} ${name}`;
    }
    
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}