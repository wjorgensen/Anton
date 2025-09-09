import { spawn, ChildProcess, exec } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { ClaudeMessage, PlanGenerationResult, PlanRequest } from '../types';
// @ts-ignore
import { getAgentList } from '../../agents/scan-agents.js';

const execAsync = promisify(exec);

export class PlanningService extends EventEmitter {
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private outputDir: string;
  private projectsDir: string;

  constructor() {
    super();
    this.outputDir = process.env.PLANNING_OUTPUT_DIR || path.join(process.cwd(), 'planning-outputs');
    this.projectsDir = path.join(process.cwd(), 'projects');
    this.ensureOutputDir();
    this.ensureProjectsDir();
  }

  private async ensureOutputDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create output directory:', error);
    }
  }

  private async ensureProjectsDir() {
    try {
      await fs.mkdir(this.projectsDir, { recursive: true });
      // Ensure blank directory exists
      const blankDir = path.join(this.projectsDir, 'blank');
      await fs.mkdir(blankDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create projects directory:', error);
    }
  }

  async generatePlan(request: PlanRequest): Promise<PlanGenerationResult> {
    const sessionId = uuidv4();
    
    try {
      // Emit planning started event
      this.emit('planning-started', {
        sessionId,
        step: 'initializing',
        message: 'Starting planning process'
      });
      
      // Emit validation step
      this.emit('planning-step', {
        sessionId,
        step: 'validating',
        message: 'Validating project description'
      });
      
      // Run pre-planning validation
      const prePlanResult = await this.runPrePlanning(request.prompt, sessionId);
      
      if (!prePlanResult.isProjectDescription) {
        throw new Error('The provided prompt does not describe a software project. Please provide a description of an application, tool, or system you want to build.');
      }
      
      // Create project directory with the validated name
      const projectDir = path.join(this.projectsDir, prePlanResult.name as string);
      
      // Check if project already exists
      if (await this.dirExists(projectDir)) {
        throw new Error(`Project '${prePlanResult.name}' already exists. Please use a different project name or delete the existing project.`);
      }
      
      // Create project structure
      await fs.mkdir(projectDir, { recursive: true });
      await fs.mkdir(path.join(projectDir, '.anton', 'plan'), { recursive: true });
      
      // Initialize git repository
      await this.initializeGitRepo(projectDir);
      
      // Emit project setup complete
      this.emit('planning-step', {
        sessionId,
        step: 'project-created',
        message: `Project '${prePlanResult.name}' created successfully`,
        projectName: prePlanResult.name,
        projectDir
      });
      
      // Use project directory as the working directory
      const testRunDir = projectDir;

      // Copy Anton agents system prompts
      const systemDir = path.join(process.cwd(), 'anton-agents', 'system');
      
      // Create .claude directory in test run
      const claudeDir = path.join(testRunDir, '.claude');
      await fs.mkdir(claudeDir, { recursive: true });
      
      // Copy planner system prompt
      if (await this.fileExists(path.join(systemDir, 'planner.md'))) {
        await fs.copyFile(
          path.join(systemDir, 'planner.md'),
          path.join(claudeDir, 'claude.md')
        );
      }

      // Prepare instructions with the prompt
      const instructions = await this.prepareInstructions(request.prompt);
      
      // Write instructions to file
      const instructionsPath = path.join(testRunDir, 'instructions.md');
      await fs.writeFile(instructionsPath, instructions);

      // Emit planning step
      this.emit('planning-step', {
        sessionId,
        step: 'planning',
        message: 'Generating execution plan'
      });
      
      // Spawn Claude planning process
      const planningMessages: ClaudeMessage[] = [];
      await this.runClaudePlanning(testRunDir, instructions, sessionId, planningMessages);

      // Run plan fixer if enabled
      if (request.runFixer !== false) {
        // Emit review step
        this.emit('planning-step', {
          sessionId,
          step: 'reviewing',
          message: 'Reviewing and optimizing plan'
        });
        
        await this.runPlanFixer(testRunDir, request.prompt, sessionId, planningMessages);
      }

      // Read the generated plan
      const planPath = path.join(testRunDir, '.anton', 'plan', 'plan.json');
      const planContent = await fs.readFile(planPath, 'utf-8');
      const plan = JSON.parse(planContent);

      // Emit planning completed event
      this.emit('planning-completed', {
        sessionId,
        projectName: prePlanResult.name as string,
        outputDir: testRunDir,
        nodeCount: plan.nodes?.length || 0
      });

      return {
        sessionId,
        plan,
        messages: planningMessages,
        outputDir: testRunDir,
        success: true,
        projectName: prePlanResult.name as string
      };

    } catch (error) {
      logger.error('Plan generation failed:', error);
      
      // Emit planning failed event
      this.emit('planning-failed', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        step: this.getCurrentStep(error)
      });
      
      throw error;
    }
  }
  
  private getCurrentStep(error: any): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('does not describe a software project')) {
      return 'validating';
    } else if (errorMessage.includes('already exists')) {
      return 'project-creation';
    } else if (errorMessage.includes('Pre-planning')) {
      return 'validating';
    } else if (errorMessage.includes('fixer')) {
      return 'reviewing';
    }
    return 'planning';
  }

  private async runClaudePlanning(
    testRunDir: string, 
    instructions: string, 
    sessionId: string,
    messages: ClaudeMessage[]
  ): Promise<void> {
    // Check for system prompt before creating promise
    const systemPromptPath = path.join(testRunDir, '.claude', 'claude.md');
    const hasSystemPrompt = await this.fileExists(systemPromptPath);
    
    return new Promise((resolve, reject) => {
      const args = [
        '-p', instructions,
        '--output-format', 'stream-json',
        '--permission-mode', 'acceptEdits',
        '--verbose'
      ];

      // Add system prompt if it exists
      if (hasSystemPrompt) {
        args.push('--append-system-prompt', systemPromptPath);
      }
      
      // cwd is set in spawn options, not as an argument

      logger.info('Spawning Claude planning process', { sessionId, args });
      
      const claudeProcess = spawn('claude', args, {
        cwd: testRunDir,
        env: { ...process.env }
      });

      this.activeProcesses.set(sessionId, claudeProcess);

      let outputBuffer = '';

      claudeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        outputBuffer += chunk;
        
        // Parse streaming JSON messages
        const lines = outputBuffer.split('\n');
        outputBuffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              messages.push(message);
              this.emit('planning-message', { sessionId, message });
            } catch (err) {
              // Not valid JSON yet, continue buffering
            }
          }
        }
      });

      claudeProcess.stderr.on('data', (data) => {
        logger.error('Claude planning stderr:', data.toString());
      });

      claudeProcess.on('close', (code) => {
        this.activeProcesses.delete(sessionId);
        if (code === 0) {
          logger.info('Claude planning completed successfully', { sessionId });
          this.emit('planning-step', {
            sessionId,
            step: 'planning',
            message: 'Plan generation completed',
            status: 'complete'
          });
          resolve();
        } else {
          reject(new Error(`Claude planning process exited with code ${code}`));
        }
      });

      claudeProcess.on('error', (error) => {
        this.activeProcesses.delete(sessionId);
        logger.error('Claude planning process error:', error);
        reject(error);
      });
    });
  }

  private async runPlanFixer(
    testRunDir: string, 
    originalPrompt: string,
    sessionId: string,
    messages: ClaudeMessage[]
  ): Promise<void> {
    // Copy plan-fixer system prompt
    const systemDir = path.join(process.cwd(), 'anton-agents', 'system');
    const claudeDir = path.join(testRunDir, '.claude');
    const planFixerSource = path.join(systemDir, 'plan-fixer.md');
    const planFixerDest = path.join(claudeDir, 'plan-fixer.md');
    
    if (await this.fileExists(planFixerSource)) {
      await fs.copyFile(planFixerSource, planFixerDest);
    }
    
    const fixerInstructions = await this.prepareFixerInstructions(originalPrompt);
    const hasFixerPrompt = await this.fileExists(planFixerDest);
    
    return new Promise((resolve, reject) => {
      const args = [
        '-p', fixerInstructions,
        '--output-format', 'stream-json',
        '--permission-mode', 'acceptEdits',
        '--verbose'
      ];
      
      if (hasFixerPrompt) {
        args.push('--append-system-prompt', planFixerDest);
      }
      
      // cwd is set in spawn options, not as an argument

      logger.info('Spawning Claude plan fixer process', { sessionId });
      
      const claudeProcess = spawn('claude', args, {
        cwd: testRunDir,
        env: { ...process.env }
      });

      const fixerSessionId = `${sessionId}-fixer`;
      this.activeProcesses.set(fixerSessionId, claudeProcess);

      let outputBuffer = '';

      claudeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        outputBuffer += chunk;
        
        const lines = outputBuffer.split('\n');
        outputBuffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              messages.push(message);
              this.emit('fixer-message', { sessionId, message });
            } catch (err) {
              // Continue buffering
            }
          }
        }
      });

      claudeProcess.stderr.on('data', (data) => {
        logger.error('Claude fixer stderr:', data.toString());
      });

      claudeProcess.on('close', (code) => {
        this.activeProcesses.delete(fixerSessionId);
        if (code === 0) {
          logger.info('Claude plan fixer completed successfully', { sessionId });
          this.emit('planning-step', {
            sessionId,
            step: 'reviewing',
            message: 'Plan review and optimization completed',
            status: 'complete'
          });
          resolve();
        } else {
          reject(new Error(`Claude fixer process exited with code ${code}`));
        }
      });

      claudeProcess.on('error', (error) => {
        this.activeProcesses.delete(fixerSessionId);
        logger.error('Claude fixer process error:', error);
        reject(error);
      });
    });
  }

  private async prepareInstructions(prompt: string): Promise<string> {
    // Get the dynamic agent list
    const agentList = await getAgentList();
    
    // Read the instructions template
    const instructionsPath = path.join(process.cwd(), 'anton-agents', 'prompts', 'planner-instructions.md');
    const instructionsTemplate = await fs.readFile(instructionsPath, 'utf-8');
    
    // Replace placeholders
    const instructions = instructionsTemplate
      .replace('[AGENT_LIST_PLACEHOLDER]', agentList)
      .replace('[PROJECT_PROMPT_PLACEHOLDER]', prompt);
    
    return instructions;
  }

  private async prepareFixerInstructions(originalPrompt: string): Promise<string> {
    // Get the dynamic agent list
    const agentList = await getAgentList();
    
    // Read the fixer instructions template
    const fixerInstructionsPath = path.join(process.cwd(), 'anton-agents', 'prompts', 'plan-fixer-instructions.md');
    const fixerTemplate = await fs.readFile(fixerInstructionsPath, 'utf-8');
    
    // Replace placeholders
    const instructions = fixerTemplate
      .replace('[AGENT_LIST_PLACEHOLDER]', agentList)
      .replace('[PROJECT_PROMPT_PLACEHOLDER]', originalPrompt);
    
    return instructions;
  }

  private async dirExists(dir: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dir);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  // Currently unused but kept for potential future use
  // private async copyDir(src: string, dest: string): Promise<void> {
  //   await fs.mkdir(dest, { recursive: true });
  //   const entries = await fs.readdir(src, { withFileTypes: true });
  //   
  //   for (const entry of entries) {
  //     const srcPath = path.join(src, entry.name);
  //     const destPath = path.join(dest, entry.name);
  //     
  //     if (entry.isDirectory()) {
  //       await this.copyDir(srcPath, destPath);
  //     } else {
  //       await fs.copyFile(srcPath, destPath);
  //     }
  //   }
  // }

  cancelPlan(sessionId: string): boolean {
    const process = this.activeProcesses.get(sessionId);
    if (process) {
      process.kill('SIGTERM');
      this.activeProcesses.delete(sessionId);
      return true;
    }
    return false;
  }

  private async runPrePlanning(prompt: string, sessionId: string): Promise<{ isProjectDescription: boolean; name: string | null }> {
    const blankDir = path.join(this.projectsDir, 'blank');
    const claudeDir = path.join(blankDir, '.claude');
    
    // Create temporary .claude directory in blank folder
    await fs.mkdir(claudeDir, { recursive: true });
    
    try {
      // Copy pre-planner system prompt
      const systemPromptSource = path.join(process.cwd(), 'anton-agents', 'system', 'pre-planner.md');
      const systemPromptDest = path.join(claudeDir, 'pre-planner.md');
      
      if (await this.fileExists(systemPromptSource)) {
        await fs.copyFile(systemPromptSource, systemPromptDest);
      }
      
      // Prepare instructions with the user prompt
      const instructions = `# Pre-Planning Validation Task

Analyze the following user prompt and determine:
1. Whether it describes a software project that can be planned and built
2. An appropriate project name (50 characters max, lowercase with hyphens)

User Prompt:
${prompt}

Respond with JSON only in this format:
- If valid project: {"isProjectDescription": true, "name": "project-name"}
- If not valid: {"isProjectDescription": false, "name": null}`;
      
      return new Promise((resolve, reject) => {
        const args = [
          '-p', instructions,
          '--permission-mode', 'acceptEdits',
          '--append-system-prompt', systemPromptDest
        ];
        
        logger.info('Running pre-planning validation', { sessionId });
        
        const claudeProcess = spawn('claude', args, {
          cwd: blankDir,
          env: { ...process.env },
          stdio: ['pipe', 'pipe', 'pipe']  // Explicitly set stdio
        });
        
        const prePlanSessionId = `${sessionId}-preplan`;
        this.activeProcesses.set(prePlanSessionId, claudeProcess);
        
        let outputBuffer = '';
        let jsonResponse = '';
        
        claudeProcess.stdout.on('data', (data) => {
          const chunk = data.toString();
          outputBuffer += chunk;
          
          // Look for JSON response directly in the output (since we're not using stream-json)
          const jsonMatch = outputBuffer.match(/\{[^}]*"isProjectDescription"[^}]*\}/s);
          if (jsonMatch) {
            jsonResponse = jsonMatch[0];
          }
        });
        
        claudeProcess.stderr.on('data', (data) => {
          logger.error('Pre-planner stderr:', data.toString());
        });
        
        claudeProcess.on('close', async (code) => {
          this.activeProcesses.delete(prePlanSessionId);
          
          // Clean up temporary .claude directory
          try {
            await fs.rm(claudeDir, { recursive: true, force: true });
          } catch (err) {
            logger.warn('Failed to clean up temporary .claude directory:', err);
          }
          
          if (code === 0 && jsonResponse) {
            try {
              const result = JSON.parse(jsonResponse);
              logger.info('Pre-planning validation complete', { result });
              
              // Emit validation result
              this.emit('planning-step', {
                sessionId,
                step: 'validating',
                message: result.isProjectDescription 
                  ? `Project validated: ${result.name}`
                  : 'Invalid project description',
                status: 'complete',
                isValid: result.isProjectDescription,
                projectName: result.name
              });
              
              resolve(result);
            } catch (err) {
              reject(new Error('Failed to parse pre-planner response'));
            }
          } else {
            reject(new Error(`Pre-planning validation failed with code ${code}`));
          }
        });
        
        claudeProcess.on('error', (error) => {
          this.activeProcesses.delete(prePlanSessionId);
          logger.error('Pre-planner process error:', error);
          reject(error);
        });
      });
    } catch (error) {
      // Clean up on error
      try {
        await fs.rm(claudeDir, { recursive: true, force: true });
      } catch (err) {
        logger.warn('Failed to clean up temporary .claude directory:', err);
      }
      throw error;
    }
  }
  
  private async initializeGitRepo(projectDir: string): Promise<void> {
    try {
      // Initialize git repository
      await execAsync('git init', { cwd: projectDir });
      
      // Create .gitignore
      const gitignoreContent = '.anton\n';
      await fs.writeFile(path.join(projectDir, '.gitignore'), gitignoreContent);
      
      // Make initial commit
      await execAsync('git add .gitignore', { cwd: projectDir });
      await execAsync('git commit -m "Initial commit with .gitignore"', { cwd: projectDir });
      
      logger.info('Git repository initialized', { projectDir });
    } catch (error) {
      logger.error('Failed to initialize git repository:', error);
      throw new Error('Failed to initialize git repository');
    }
  }

  cleanup() {
    for (const [, process] of this.activeProcesses) {
      process.kill('SIGTERM');
    }
    this.activeProcesses.clear();
  }
}