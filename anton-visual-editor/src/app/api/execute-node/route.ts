import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Agent prompts for different types of development tasks
const AGENT_PROMPTS: Record<string, string> = {
  'setup': `You are a project setup specialist. Initialize the project structure, create necessary configuration files, and set up the development environment.`,
  
  'frontend-developer': `You are a frontend developer. Build user interfaces with modern web technologies, focusing on user experience and responsive design.`,
  
  'backend-developer': `You are a backend developer. Create server-side logic, APIs, and handle data processing with a focus on performance and security.`,
  
  'database-developer': `You are a database architect. Design and implement database schemas, optimize queries, and ensure data integrity.`,
  
  'api-integrator': `You are an API integration specialist. Connect with third-party services, handle authentication, and manage data synchronization.`,
  
  'test-runner': `You are a testing engineer. Write and execute unit tests, integration tests, and ensure code quality.`,
  
  'playwright-e2e': `You are an E2E testing specialist using Playwright. Create comprehensive end-to-end tests for web applications.`,
  
  'code-review': `You are a senior code reviewer. Analyze code for quality, security, performance, and best practices.`,
  
  'deployment': `You are a DevOps engineer. Handle deployment processes, CI/CD pipelines, and production configurations.`,
  
  'docker-builder': `You are a containerization expert. Create Docker configurations and optimize container deployments.`,
  
  'security-audit': `You are a security specialist. Identify vulnerabilities, implement security best practices, and ensure compliance.`,
  
  'performance-optimizer': `You are a performance engineer. Optimize code, reduce load times, and improve application efficiency.`,
};

export async function POST(request: NextRequest) {
  try {
    const { node, projectContext } = await request.json();
    
    if (!node || !node.agent) {
      return NextResponse.json(
        { error: 'Node and agent type are required' },
        { status: 400 }
      );
    }

    // Check if API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      // Return simulated execution if no API key
      return NextResponse.json({
        output: `[SIMULATED] Executing ${node.agent} agent: ${node.label}\\n` +
                `Task: ${node.description || 'No description provided'}\\n` +
                `Status: Completed successfully`,
        status: 'completed',
        simulation: true,
      });
    }

    const agentPrompt = AGENT_PROMPTS[node.agent] || AGENT_PROMPTS['setup'];
    
    try {
      // Use Claude to execute the node's task
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.7,
        system: `${agentPrompt}

You are executing a specific task in a development workflow. Provide a concise, actionable response that describes what you would do to complete this task.

Format your response as:
1. A brief summary of the actions taken
2. Any code or configuration created (if applicable)
3. Next steps or dependencies

Keep responses focused and practical.`,
        messages: [
          {
            role: 'user',
            content: `Execute this task:
            
Task: ${node.label}
Description: ${node.description || 'No additional description'}
Project Context: ${projectContext || 'General software development project'}

Provide a realistic execution output for this task.`
          }
        ]
      });

      // Extract the response
      const content = response.content[0];
      if (content.type === 'text') {
        return NextResponse.json({
          output: content.text,
          status: 'completed',
          tokens_used: response.usage?.output_tokens || 0,
        });
      }
    } catch (apiError) {
      console.error('Claude API error:', apiError);
      
      // Fallback to simulated execution
      return NextResponse.json({
        output: `[SIMULATED] Executing ${node.agent} agent: ${node.label}\\n` +
                `Task: ${node.description || 'No description provided'}\\n` +
                `Status: Completed with warnings`,
        status: 'completed',
        simulation: true,
        error: 'API temporarily unavailable',
      });
    }
  } catch (error) {
    console.error('Failed to execute node:', error);
    return NextResponse.json(
      { error: 'Failed to execute node' },
      { status: 500 }
    );
  }
}