# Flow Planning Service

Part 2 of Anton v2 - An intelligent planning service that generates optimal execution flows from natural language project requirements.

## Overview

The Flow Planning Service analyzes project descriptions and automatically:
- Selects appropriate agents from the library
- Creates dependency graphs
- Optimizes parallelization  
- Generates visual flow layouts
- Validates flow integrity
- Produces executable flow.json files

## Features

### 1. Requirement Analyzer
- Natural language processing for project requirements
- Technology stack detection
- Feature extraction and categorization
- Constraint and preference detection

### 2. Flow Generator
- Intelligent agent selection based on requirements
- Dependency graph construction
- Parallelization optimization
- Automatic checkpoint insertion
- Resource allocation planning

### 3. Layout Engine
- Automatic node positioning using layered layouts
- Force-directed graph optimization
- Edge crossing minimization
- Visual clustering for related agents

### 4. Validation Service
- Flow integrity checking
- Cycle detection
- Agent compatibility validation
- Resource requirement analysis
- Improvement suggestions

## Installation

```bash
cd planning-service
npm install
```

## Usage

### Basic Usage

```typescript
import { FlowPlanningService } from './planning-service';

const planner = new FlowPlanningService();

// Generate flow from natural language description
const result = await planner.planFlow(
  'Build a Next.js e-commerce platform with authentication and testing'
);

// Access the generated flow
console.log(result.flow);
console.log(result.validation);
console.log(result.metrics);
```

### Advanced Usage

```typescript
// Generate from structured requirements
const requirements = {
  description: 'SaaS platform',
  projectType: 'fullstack',
  technology: {
    frontend: ['nextjs', 'react'],
    backend: ['nodejs'],
    database: ['postgres']
  },
  features: ['authentication', 'payment', 'api'],
  preferences: {
    testing: 'comprehensive',
    review: 'manual'
  }
};

const result = await planner.planFlowFromRequirements(requirements);

// Optimize the flow
const optimized = planner.optimizeFlow(result.flow);

// Export flow
const json = planner.exportFlow(optimized, 'json');
```

## Testing

Run the test suite with sample project descriptions:

```bash
npm test
```

This will generate flows for:
- Next.js E-commerce Platform
- Python Microservice API
- React Dashboard Application
- Mobile Flutter App
- Simple REST API
- Complex SaaS Platform

## Generated Flow Structure

```json
{
  "id": "unique-flow-id",
  "version": 1,
  "name": "Project name",
  "nodes": [
    {
      "id": "node-1",
      "agentId": "nextjs-setup",
      "category": "setup",
      "position": { "x": 100, "y": 200 },
      "config": {
        "retryOnFailure": true,
        "maxRetries": 3
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "condition": { "type": "success" }
    }
  ],
  "metadata": {
    "estimatedTotalTime": 120,
    "estimatedTotalTokens": 500000
  }
}
```

## Metrics

The service provides comprehensive metrics:
- **Total Nodes**: Number of agents in the flow
- **Total Edges**: Number of connections
- **Max Parallelism**: Maximum concurrent agents
- **Estimated Time**: Total execution time in minutes
- **Estimated Tokens**: Total token usage estimate
- **Critical Path Length**: Longest sequential path

## Validation

The service validates:
- ✅ Flow structure integrity
- ✅ Agent compatibility
- ✅ Circular dependency detection
- ✅ Resource requirements
- ✅ Category dependencies

And provides:
- ❌ Errors that must be fixed
- ⚠️ Warnings to consider
- 💡 Suggestions for improvement

## Architecture

```
planning-service/
├── src/
│   ├── analyzer/         # Requirement analysis
│   ├── generator/        # Flow generation
│   ├── layout/          # Visual positioning
│   ├── validation/      # Flow validation
│   └── types/           # TypeScript types
├── output/              # Generated flows
└── test-planning.ts     # Test suite
```

## Integration with Anton v2

This service integrates with:
- **Part 1**: Agent Library System (uses agent definitions)
- **Part 3**: Visual Flow Editor (consumes generated flows)
- **Part 4**: Orchestration Engine (executes flows)

## Next Steps

The generated flow.json files can be:
1. Visualized in the Visual Flow Editor
2. Manually adjusted if needed
3. Executed by the Orchestration Engine
4. Monitored through Live Preview System

## License

MIT