import { Request, Response } from 'express';
import { ClaudeCodeManager } from '../core/ClaudeCodeManager';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface PlanningResult {
  nodes: any[];
  edges: any[];
  metadata?: any;
  error?: string;
}

// Store planning results temporarily
const planningResults = new Map<string, PlanningResult>();

export async function planProject(req: Request, res: Response) {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const planningId = uuidv4();
    const claudeManager = new ClaudeCodeManager();
    
    // Read planning instructions
    const planningMdPath = path.join(process.cwd(), '..', '.claude', 'planning.md');
    let planningInstructions = '';
    
    try {
      planningInstructions = await fs.readFile(planningMdPath, 'utf-8');
    } catch (err) {
      console.warn('Could not read planning.md, using default instructions');
      planningInstructions = getDefaultPlanningInstructions();
    }

    // Create the planning node configuration
    const planningNode = {
      id: `planning-${planningId}`,
      label: 'Project Planning',
      instructions: `${planningInstructions}

## Project Requirements

${prompt}

## Your Task

Analyze the above project requirements and generate a comprehensive execution plan. 
Output ONLY valid JSON with this structure:
{
  "nodes": [
    {
      "id": "node-0",
      "type": "circuit",
      "label": "Node Label",
      "description": "What this node does",
      "agent": "agent-type",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Node Label",
        "description": "What this node does",
        "agent": "agent-type",
        "status": "pending",
        "progress": 0
      }
    }
  ],
  "edges": [
    {
      "id": "edge-0",
      "source": "node-0",
      "target": "node-1",
      "animated": false
    }
  ],
  "metadata": {
    "createdAt": "${new Date().toISOString()}",
    "version": 1
  }
}

Include at minimum:
1. A setup/initialization node
2. An execution/implementation node
3. A testing/validation node

Be thorough and create all necessary nodes for the project requirements.`
    };

    const planningAgent = {
      id: 'planner',
      name: 'Project Planner',
      category: 'planning',
      type: 'planner',
      description: 'Plans project execution',
      instructions: {
        base: planningInstructions,
        contextual: ''
      },
      inputs: [],
      outputs: ['plan'],
      claudeMD: ''
    };

    // Set up webhook listener for this planning session
    planningResults.set(planningId, { nodes: [], edges: [] });

    // Spawn Claude to do the planning
    const instance = await claudeManager.spawnAgent(
      planningNode,
      planningAgent,
      planningId,
      { prompt }
    );

    // Listen for completion
    claudeManager.once('agent:stopped', async (event) => {
      if (event.instanceId === instance.id) {
        try {
          // Read the output.json file
          const outputPath = path.join(instance.projectDir, 'output.json');
          const output = await fs.readFile(outputPath, 'utf-8');
          const plan = JSON.parse(output);
          
          planningResults.set(planningId, plan);
        } catch (error) {
          console.error('Failed to read planning output:', error);
          planningResults.set(planningId, { 
            nodes: [], 
            edges: [], 
            error: 'Failed to parse planning output' 
          });
        }
      }
    });

    // Listen for errors
    claudeManager.once('agent:error', (event) => {
      if (event.instanceId === instance.id) {
        planningResults.set(planningId, { 
          nodes: [], 
          edges: [], 
          error: event.error?.message || 'Planning failed' 
        });
      }
    });

    // Return planning ID immediately - client will poll for results
    res.json({ 
      planningId,
      status: 'running',
      message: 'Planning in progress. Poll /api/plan-project/:id for results.'
    });
    
  } catch (error) {
    console.error('Failed to start planning:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to start planning' 
    });
  }
}

export async function getPlanningResult(req: Request, res: Response) {
  const { id } = req.params;
  
  if (!planningResults.has(id)) {
    return res.status(404).json({ error: 'Planning session not found' });
  }
  
  const result = planningResults.get(id)!;
  
  // Check if planning is complete
  if (result.error) {
    res.status(500).json({ error: result.error });
    planningResults.delete(id); // Clean up
  } else if (result.nodes.length > 0) {
    res.json(result);
    planningResults.delete(id); // Clean up
  } else {
    // Still running
    res.json({ status: 'running' });
  }
}

function getDefaultPlanningInstructions(): string {
  return `You are an AI project planner that creates visual workflow plans.

Given a project description, create a circuit board plan with nodes representing different development stages.

Available agent types:
- setup: Project initialization
- frontend-developer: UI/UX development
- backend-developer: Server and API development
- database-developer: Database design
- api-integrator: Third-party API integration
- test-runner: Automated testing
- code-review: Code quality review
- deployment: Production deployment

Position nodes logically:
- Start nodes at x=100, y=100
- Space nodes vertically by 150px
- Parallel tasks at same y level, different x (350px apart)
- Sequential tasks connect vertically

Create edges to show dependencies. Parallel tasks can have the same source.`;
}