import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const SYSTEM_PROMPT = `You are an AI architect that plans software development workflows as circuit boards.

Given a user's project description, create a detailed circuit board plan with nodes representing different development stages or parallel tasks.

You must respond with ONLY valid JSON (no markdown, no explanation) in this exact format:
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
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "version": 1
  }
}

Available agent types:
- setup: Project initialization
- frontend-developer: UI/UX development
- backend-developer: Server and API development
- database-developer: Database design and implementation
- api-integrator: Third-party API integration
- test-runner: Automated testing
- playwright-e2e: End-to-end testing with Playwright
- code-review: Code quality review
- deployment: Production deployment
- docker-builder: Containerization
- security-audit: Security analysis
- performance-optimizer: Performance tuning

Position nodes logically:
- Start nodes at x=100, y=100
- Space nodes vertically by 150px
- Parallel tasks should be at the same y level but different x (350px apart)
- Center converging nodes

Create edges to show dependencies. Parallel tasks can have the same source.

Be creative and thorough - analyze the requirements and create all necessary nodes for a complete implementation.`;

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Check if API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('ANTHROPIC_API_KEY not configured, falling back to rule-based generation');
      
      // Fallback to simple generation if no API key
      return generateSimpleCircuitBoard(prompt);
    }

    try {
      // Use Claude to generate the circuit board
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.7,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Create a circuit board plan for this project:\n\n${prompt}\n\nRespond with ONLY valid JSON, no markdown.`
          }
        ]
      });

      // Extract the JSON from Claude's response
      const content = response.content[0];
      if (content.type === 'text') {
        try {
          // Parse the JSON response
          const circuitBoard = JSON.parse(content.text);
          
          // Add current timestamps
          circuitBoard.metadata = {
            ...circuitBoard.metadata,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1
          };
          
          return NextResponse.json(circuitBoard);
        } catch (parseError) {
          console.error('Failed to parse Claude response:', parseError);
          console.log('Claude response:', content.text);
          
          // Fallback to simple generation if parsing fails
          return generateSimpleCircuitBoard(prompt);
        }
      }
    } catch (apiError) {
      console.error('Claude API error:', apiError);
      
      // Fallback to simple generation if API fails
      return generateSimpleCircuitBoard(prompt);
    }
  } catch (error) {
    console.error('Failed to generate circuit board:', error);
    return NextResponse.json(
      { error: 'Failed to generate circuit board' },
      { status: 500 }
    );
  }
}

// Fallback simple generation (same as before)
function generateSimpleCircuitBoard(prompt: string) {
  const promptLower = prompt.toLowerCase();
  
  const needsFrontend = promptLower.includes('frontend') || 
                        promptLower.includes('ui') || 
                        promptLower.includes('react') ||
                        promptLower.includes('interface');
                        
  const needsBackend = promptLower.includes('backend') || 
                       promptLower.includes('api') || 
                       promptLower.includes('server') ||
                       promptLower.includes('database');
                       
  const needsTesting = promptLower.includes('test') || 
                       promptLower.includes('quality');
                       
  const needsDeployment = promptLower.includes('deploy') || 
                          promptLower.includes('production');

  const nodes = [];
  const edges = [];
  let yPosition = 100;
  let nodeIndex = 0;
  
  // Always start with setup
  const setupNode = {
    id: `node-${nodeIndex++}`,
    type: 'circuit',
    label: 'Project Setup',
    description: 'Initialize project structure',
    agent: 'setup',
    position: { x: 100, y: yPosition },
    data: {
      label: 'Project Setup',
      description: 'Initialize project structure',
      agent: 'setup',
      status: 'pending',
      progress: 0,
    },
  };
  nodes.push(setupNode);
  yPosition += 150;
  
  let previousNodeId = setupNode.id;
  
  // Add nodes based on requirements
  if (needsBackend) {
    const backendNode = {
      id: `node-${nodeIndex++}`,
      type: 'circuit',
      label: 'Backend Development',
      description: 'API and server implementation',
      agent: 'backend-developer',
      position: { x: 100, y: yPosition },
      data: {
        label: 'Backend Development',
        description: 'API and server implementation',
        agent: 'backend-developer',
        status: 'pending',
        progress: 0,
      },
    };
    nodes.push(backendNode);
    
    edges.push({
      id: `edge-${edges.length}`,
      source: previousNodeId,
      target: backendNode.id,
      animated: false,
    });
    
    previousNodeId = backendNode.id;
    yPosition += 150;
  }
  
  if (needsFrontend) {
    const frontendNode = {
      id: `node-${nodeIndex++}`,
      type: 'circuit',
      label: 'Frontend Development',
      description: 'UI components and interactions',
      agent: 'frontend-developer',
      position: { x: 100, y: yPosition },
      data: {
        label: 'Frontend Development',
        description: 'UI components and interactions',
        agent: 'frontend-developer',
        status: 'pending',
        progress: 0,
      },
    };
    nodes.push(frontendNode);
    
    edges.push({
      id: `edge-${edges.length}`,
      source: previousNodeId,
      target: frontendNode.id,
      animated: false,
    });
    
    previousNodeId = frontendNode.id;
    yPosition += 150;
  }
  
  // Always add testing
  const testNode = {
    id: `node-${nodeIndex++}`,
    type: 'circuit',
    label: 'Testing',
    description: 'Automated testing',
    agent: 'test-runner',
    position: { x: 100, y: yPosition },
    data: {
      label: 'Testing',
      description: 'Automated testing',
      agent: 'test-runner',
      status: 'pending',
      progress: 0,
    },
  };
  nodes.push(testNode);
  
  edges.push({
    id: `edge-${edges.length}`,
    source: previousNodeId,
    target: testNode.id,
    animated: false,
  });
  
  const circuitBoard = {
    nodes,
    edges,
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  };
  
  return NextResponse.json(circuitBoard);
}