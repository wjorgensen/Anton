import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Read the planning.md file
    const planningMdPath = path.join(process.cwd(), '..', '.claude', 'planning.md');
    let planningInstructions = '';
    
    try {
      planningInstructions = await fs.readFile(planningMdPath, 'utf-8');
    } catch (err) {
      console.warn('Could not read planning.md, using embedded instructions');
      planningInstructions = getEmbeddedPlanningInstructions();
    }

    // Create the full prompt for Claude
    const fullPrompt = `${planningInstructions}

## Project Requirements

${prompt}

## Your Task

Analyze the above project requirements and generate a comprehensive execution plan with parallelization strategy. Output ONLY the JSON structure as specified in the instructions.`;

    try {
      // Execute Claude CLI with the planning prompt
      console.log('Executing Claude CLI for project planning...');
      
      // Write prompt to temp file to avoid shell escaping issues
      const tempDir = `/tmp/anton-planning-${Date.now()}`;
      await fs.mkdir(tempDir, { recursive: true });
      const promptFile = path.join(tempDir, 'prompt.txt');
      await fs.writeFile(promptFile, fullPrompt);
      
      const { stdout, stderr } = await execAsync(
        `cat "${promptFile}" | claude -p --dangerously-skip-permissions`,
        {
          timeout: 30000, // 30 second timeout
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          shell: '/bin/bash'
        }
      );

      // Clean up temp file
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

      if (stderr && !stderr.includes('Warning')) {
        console.error('Claude CLI stderr:', stderr);
      }

      // Parse the JSON output
      try {
        // Extract JSON from the response (in case there's any extra text)
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in Claude response');
        }
        
        const plan = JSON.parse(jsonMatch[0]);
        
        // Validate the structure
        if (!plan.nodes || !plan.edges || !plan.plan) {
          throw new Error('Invalid plan structure');
        }
        
        // Add timestamp
        plan.metadata = {
          ...plan.metadata,
          createdAt: new Date().toISOString(),
          generatedBy: 'claude-cli'
        };
        
        console.log(`Generated plan with ${plan.nodes.length} nodes and ${plan.executionPhases?.length || 0} phases`);
        
        return NextResponse.json(plan);
        
      } catch (parseError) {
        console.error('Failed to parse Claude output:', parseError);
        console.log('Raw output:', stdout.substring(0, 500));
        
        // Fallback to simple generation
        return generateFallbackPlan(prompt);
      }
      
    } catch (execError: any) {
      console.error('Failed to execute Claude CLI:', execError);
      
      // Fallback to simple generation
      return generateFallbackPlan(prompt);
    }
    
  } catch (error) {
    console.error('Failed to plan circuit:', error);
    return NextResponse.json(
      { error: 'Failed to plan circuit' },
      { status: 500 }
    );
  }
}

function generateFallbackPlan(prompt: string) {
  const promptLower = prompt.toLowerCase();
  
  // Simple analysis
  const needsFrontend = promptLower.includes('frontend') || 
                        promptLower.includes('ui') || 
                        promptLower.includes('react');
                        
  const needsBackend = promptLower.includes('backend') || 
                       promptLower.includes('api') || 
                       promptLower.includes('server');
                       
  const needsDatabase = promptLower.includes('database') || 
                        promptLower.includes('data') ||
                        needsBackend;
                        
  const needsTesting = promptLower.includes('test') || 
                       needsBackend || needsFrontend;

  const nodes = [];
  const edges = [];
  const executionPhases = [];
  let nodeIndex = 0;
  
  // Phase 1: Setup
  const setupNode = {
    id: `node-${nodeIndex++}`,
    type: 'circuit',
    label: 'Project Setup',
    description: 'Initialize project structure and dependencies',
    agent: 'setup',
    position: { x: 300, y: 100 },
    estimatedTime: 10,
    dependencies: [],
    canRunInParallel: [],
    data: {
      label: 'Project Setup',
      description: 'Initialize project structure and dependencies',
      agent: 'setup',
      status: 'pending',
      progress: 0
    }
  };
  nodes.push(setupNode);
  executionPhases.push({
    phase: 1,
    name: 'Initialization',
    nodes: [setupNode.id],
    parallel: false,
    description: 'Project setup and initialization'
  });
  
  // Phase 2: Parallel Development
  const phase2Nodes = [];
  let phase2Y = 250;
  let phase2X = 100;
  
  if (needsDatabase) {
    const dbNode = {
      id: `node-${nodeIndex++}`,
      type: 'circuit',
      label: 'Database Setup',
      description: 'Configure database schema and connections',
      agent: 'database-developer',
      position: { x: phase2X, y: phase2Y },
      estimatedTime: 15,
      dependencies: [setupNode.id],
      canRunInParallel: [],
      data: {
        label: 'Database Setup',
        description: 'Configure database schema and connections',
        agent: 'database-developer',
        status: 'pending',
        progress: 0
      }
    };
    nodes.push(dbNode);
    phase2Nodes.push(dbNode.id);
    edges.push({
      id: `edge-${edges.length}`,
      source: setupNode.id,
      target: dbNode.id,
      animated: false
    });
    phase2X += 200;
  }
  
  if (needsBackend) {
    const backendNode = {
      id: `node-${nodeIndex++}`,
      type: 'circuit',
      label: 'Backend Development',
      description: 'Implement API endpoints and business logic',
      agent: 'backend-developer',
      position: { x: phase2X, y: phase2Y },
      estimatedTime: 30,
      dependencies: [setupNode.id],
      canRunInParallel: phase2Nodes,
      data: {
        label: 'Backend Development',
        description: 'Implement API endpoints and business logic',
        agent: 'backend-developer',
        status: 'pending',
        progress: 0
      }
    };
    nodes.push(backendNode);
    phase2Nodes.push(backendNode.id);
    edges.push({
      id: `edge-${edges.length}`,
      source: setupNode.id,
      target: backendNode.id,
      animated: false
    });
    phase2X += 200;
  }
  
  if (needsFrontend) {
    const frontendNode = {
      id: `node-${nodeIndex++}`,
      type: 'circuit',
      label: 'Frontend Development',
      description: 'Build user interface and interactions',
      agent: 'frontend-developer',
      position: { x: phase2X, y: phase2Y },
      estimatedTime: 30,
      dependencies: [setupNode.id],
      canRunInParallel: phase2Nodes,
      data: {
        label: 'Frontend Development',
        description: 'Build user interface and interactions',
        agent: 'frontend-developer',
        status: 'pending',
        progress: 0
      }
    };
    nodes.push(frontendNode);
    phase2Nodes.push(frontendNode.id);
    edges.push({
      id: `edge-${edges.length}`,
      source: setupNode.id,
      target: frontendNode.id,
      animated: false
    });
  }
  
  if (phase2Nodes.length > 0) {
    executionPhases.push({
      phase: 2,
      name: 'Development',
      nodes: phase2Nodes,
      parallel: true,
      description: 'Parallel development of core components'
    });
  }
  
  // Phase 3: Testing
  if (needsTesting && phase2Nodes.length > 0) {
    const testNode = {
      id: `node-${nodeIndex++}`,
      type: 'circuit',
      label: 'Testing',
      description: 'Run unit and integration tests',
      agent: 'test-runner',
      position: { x: 300, y: 400 },
      estimatedTime: 20,
      dependencies: phase2Nodes,
      canRunInParallel: [],
      data: {
        label: 'Testing',
        description: 'Run unit and integration tests',
        agent: 'test-runner',
        status: 'pending',
        progress: 0
      }
    };
    nodes.push(testNode);
    
    // Add edges from all phase 2 nodes to testing
    phase2Nodes.forEach(sourceId => {
      edges.push({
        id: `edge-${edges.length}`,
        source: sourceId,
        target: testNode.id,
        animated: false
      });
    });
    
    executionPhases.push({
      phase: 3,
      name: 'Testing',
      nodes: [testNode.id],
      parallel: false,
      description: 'Quality assurance and testing'
    });
  }
  
  return NextResponse.json({
    plan: {
      projectName: 'Generated Project',
      description: prompt,
      estimatedDuration: '1-2 hours',
      parallelizationStrategy: 'Parallel development after setup'
    },
    nodes,
    edges,
    executionPhases,
    metadata: {
      totalNodes: nodes.length,
      parallelGroups: phase2Nodes.length > 1 ? 1 : 0,
      criticalPath: nodes.map(n => n.id),
      estimatedSavings: phase2Nodes.length > 1 ? '30-40% time saved' : 'No parallelization',
      createdAt: new Date().toISOString(),
      version: 1,
      generatedBy: 'fallback'
    }
  });
}

function getEmbeddedPlanningInstructions() {
  return `You are a project planning agent. Given requirements, output a JSON plan with nodes, edges, and execution phases.

Output format:
{
  "plan": {
    "projectName": "string",
    "description": "string",
    "estimatedDuration": "string",
    "parallelizationStrategy": "string"
  },
  "nodes": [...],
  "edges": [...],
  "executionPhases": [...],
  "metadata": {...}
}

Available agents: setup, frontend-developer, backend-developer, database-developer, test-runner, code-review

Create parallel execution phases where possible.`;
}