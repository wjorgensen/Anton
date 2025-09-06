import { NextRequest, NextResponse } from 'next/server';

function analyzePrompt(prompt: string) {
  const promptLower = prompt.toLowerCase();
  
  const needsFrontend = promptLower.includes('frontend') || 
                        promptLower.includes('ui') || 
                        promptLower.includes('react') ||
                        promptLower.includes('vue') ||
                        promptLower.includes('interface');
                        
  const needsBackend = promptLower.includes('backend') || 
                       promptLower.includes('api') || 
                       promptLower.includes('server') ||
                       promptLower.includes('node') ||
                       promptLower.includes('database');
                       
  const needsTesting = promptLower.includes('test') || 
                       promptLower.includes('quality') ||
                       promptLower.includes('e2e') ||
                       promptLower.includes('playwright');
                       
  const needsDeployment = promptLower.includes('deploy') || 
                          promptLower.includes('docker') ||
                          promptLower.includes('kubernetes') ||
                          promptLower.includes('production');
  
  return { needsFrontend, needsBackend, needsTesting, needsDeployment };
}

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }
    
    const analysis = analyzePrompt(prompt);
    const nodes = [];
    const edges = [];
    let yPosition = 100;
    let nodeIndex = 0;
    
    const setupNode = {
      id: `node-${nodeIndex++}`,
      type: 'circuit',  // Changed to 'circuit' to match the custom node type
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
    
    if (analysis.needsBackend) {
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
      
      const dbNode = {
        id: `node-${nodeIndex++}`,
        type: 'circuit',
        label: 'Database Setup',
        description: 'Configure database and migrations',
        agent: 'database-developer',
        position: { x: 350, y: yPosition },
        data: {
          label: 'Database Setup',
          description: 'Configure database and migrations',
          agent: 'database-developer',
          status: 'pending',
          progress: 0,
        },
      };
      nodes.push(dbNode);
      
      edges.push({
        id: `edge-${edges.length}`,
        source: previousNodeId,
        target: dbNode.id,
        animated: false,
      });
      
      yPosition += 150;
      previousNodeId = backendNode.id;
    }
    
    if (analysis.needsFrontend) {
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
      
      yPosition += 150;
      previousNodeId = frontendNode.id;
    }
    
    if (analysis.needsTesting || nodes.length > 2) {
      const testNode = {
        id: `node-${nodeIndex++}`,
        type: 'circuit',
        label: 'Testing',
        description: 'Run tests and quality checks',
        agent: 'playwright-e2e',
        position: { x: 100, y: yPosition },
        data: {
          label: 'Testing',
          description: 'Run tests and quality checks',
          agent: 'playwright-e2e',
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
      
      const reviewNode = {
        id: `node-${nodeIndex++}`,
        type: 'circuit',
        label: 'Code Review',
        description: 'Review code quality',
        agent: 'code-review',
        position: { x: 350, y: yPosition },
        data: {
          label: 'Code Review',
          description: 'Review code quality',
          agent: 'code-review',
          status: 'pending',
          progress: 0,
        },
      };
      nodes.push(reviewNode);
      
      edges.push({
        id: `edge-${edges.length}`,
        source: previousNodeId,
        target: reviewNode.id,
        animated: false,
      });
      
      yPosition += 150;
      previousNodeId = testNode.id;
    }
    
    if (analysis.needsDeployment || nodes.length > 3) {
      const deployNode = {
        id: `node-${nodeIndex++}`,
        type: 'circuit',
        label: 'Deployment',
        description: 'Deploy to production',
        agent: 'deployment',
        position: { x: 225, y: yPosition },
        data: {
          label: 'Deployment',
          description: 'Deploy to production',
          agent: 'deployment',
          status: 'pending',
          progress: 0,
        },
      };
      nodes.push(deployNode);
      
      edges.push({
        id: `edge-${edges.length}`,
        source: previousNodeId,
        target: deployNode.id,
        animated: false,
      });
    }
    
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
  } catch (error) {
    console.error('Failed to generate circuit board:', error);
    return NextResponse.json(
      { error: 'Failed to generate circuit board' },
      { status: 500 }
    );
  }
}