import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

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
    const { node, projectContext, workingDirectory } = await request.json();
    
    if (!node || !node.agent) {
      return NextResponse.json(
        { error: 'Node and agent type are required' },
        { status: 400 }
      );
    }

    // Get the appropriate agent prompt
    const agentPrompt = AGENT_PROMPTS[node.agent] || AGENT_PROMPTS['setup'];
    
    // Create a working directory for this node if it doesn't exist
    const nodeWorkDir = workingDirectory || `/tmp/anton-${Date.now()}`;
    await fs.mkdir(nodeWorkDir, { recursive: true });
    
    // Create a prompt file for Claude Code to execute
    const promptContent = `${agentPrompt}

Task: ${node.label}
Description: ${node.description || 'No additional description'}
Project Context: ${projectContext || 'General software development project'}

Execute this task and provide:
1. A brief summary of the actions taken
2. Any code or configuration created
3. Next steps or dependencies

Working Directory: ${nodeWorkDir}`;

    const promptFile = path.join(nodeWorkDir, 'prompt.txt');
    await fs.writeFile(promptFile, promptContent);

    try {
      // Execute Claude using stdin to avoid quoting issues
      // Using the -p flag for prompting and --dangerously-skip-permissions for headless execution
      const promptText = await fs.readFile(promptFile, 'utf-8');
      const command = `cd "${nodeWorkDir}" && echo '${promptText.replace(/'/g, "'\\''")}' | claude -p --dangerously-skip-permissions`;
      
      console.log(`Executing native Claude CLI in directory: ${nodeWorkDir}`);
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: 60000, // 60 second timeout
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        shell: '/bin/bash'
      });

      if (stderr && !stderr.includes('Warning')) {
        console.error('Claude Code stderr:', stderr);
      }

      // Parse the output
      let output;
      try {
        output = JSON.parse(stdout);
      } catch {
        // If not JSON, treat as plain text
        output = { result: stdout, status: 'completed' };
      }

      // Read any generated files
      const files = await fs.readdir(nodeWorkDir);
      const generatedFiles = files.filter(f => f !== 'prompt.txt');

      return NextResponse.json({
        output: output.result || stdout,
        status: 'completed',
        workingDirectory: nodeWorkDir,
        generatedFiles,
        native: true,
      });

    } catch (execError: any) {
      console.error('Failed to execute native Claude Code:', execError);
      
      // Check if Claude Code is installed
      if (execError.message.includes('command not found') || execError.message.includes('not recognized')) {
        return NextResponse.json({
          error: 'Claude Code is not installed or not in PATH',
          suggestion: 'Please ensure Claude Code is installed and accessible from the command line',
          status: 'failed',
        }, { status: 500 });
      }
      
      // Return error but continue execution
      return NextResponse.json({
        output: `Error executing task: ${execError.message}`,
        status: 'failed',
        error: execError.message,
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