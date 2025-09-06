import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ClaudeInstance, FlowNode, AgentConfig, HookEvent } from '../../types';
import { EventEmitter } from 'events';

export class ClaudeCodeManager extends EventEmitter {
  private instances: Map<string, ClaudeInstance> = new Map();
  private projectsBaseDir: string;
  private hooksBaseUrl: string;

  constructor(projectsBaseDir: string = '/tmp/anton/projects', hooksBaseUrl: string = 'http://localhost:3002') {
    super();
    this.projectsBaseDir = projectsBaseDir;
    this.hooksBaseUrl = hooksBaseUrl;
  }

  async spawnAgent(node: FlowNode, agent: AgentConfig, flowId: string, inputData?: any): Promise<ClaudeInstance> {
    const instanceId = `${flowId}-${node.id}-${Date.now()}`;
    const projectDir = path.join(this.projectsBaseDir, flowId, node.id);

    const instance: ClaudeInstance = {
      id: instanceId,
      nodeId: node.id,
      projectDir,
      status: 'initializing',
      startedAt: new Date(),
      output: {},
      logs: [],
      metrics: {}
    };

    try {
      await this.setupProjectDirectory(projectDir, node, agent, inputData);
      
      await this.configureHooks(projectDir, node.id);
      
      const childProcess = await this.spawnClaudeProcess(projectDir, node.instructions);
      
      instance.process = childProcess;
      instance.status = 'running';
      
      this.instances.set(instanceId, instance);
      
      this.setupProcessListeners(childProcess, instance);
      
      this.emit('agent:spawned', { instanceId, nodeId: node.id });
      
      return instance;
    } catch (error) {
      instance.status = 'error';
      instance.stoppedAt = new Date();
      this.emit('agent:error', { instanceId, nodeId: node.id, error });
      throw error;
    }
  }

  private async setupProjectDirectory(
    projectDir: string,
    node: FlowNode,
    agent: AgentConfig,
    inputData?: any
  ): Promise<void> {
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.join(projectDir, '.claude'), { recursive: true });
    await fs.mkdir(path.join(projectDir, 'hooks'), { recursive: true });
    
    const instructions = this.buildInstructions(node, agent, inputData);
    await fs.writeFile(
      path.join(projectDir, 'instructions.md'),
      instructions,
      'utf-8'
    );
    
    if (agent.claudeMD) {
      const claudeMD = this.interpolateTemplate(agent.claudeMD, { node, inputData });
      await fs.writeFile(
        path.join(projectDir, '.claude', 'claude.md'),
        claudeMD,
        'utf-8'
      );
    }
    
    if (inputData) {
      await fs.writeFile(
        path.join(projectDir, 'input.json'),
        JSON.stringify(inputData, null, 2),
        'utf-8'
      );
    }
  }

  private buildInstructions(node: FlowNode, agent: AgentConfig, inputData?: any): string {
    let instructions = agent.instructions.base;
    
    if (node.instructions) {
      instructions += '\n\n## Specific Instructions\n\n' + node.instructions;
    }
    
    if (agent.instructions.contextual) {
      const contextual = this.interpolateTemplate(agent.instructions.contextual, {
        node,
        inputData
      });
      instructions += '\n\n## Context\n\n' + contextual;
    }
    
    if (inputData) {
      instructions += '\n\n## Input Data\n\nPlease read the input data from `input.json` and use it for your task.';
    }
    
    instructions += '\n\n## Output Requirements\n\nWhen you complete your task, write the output to `output.json` in the project directory.';
    
    return instructions;
  }

  private interpolateTemplate(template: string, context: any): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const keys = path.split('.');
      let value = context;
      for (const key of keys) {
        value = value?.[key];
      }
      return value !== undefined ? String(value) : match;
    });
  }

  private async configureHooks(projectDir: string, nodeId: string): Promise<void> {
    const hooksConfig = {
      hooks: {
        Stop: [
          {
            hooks: [{
              type: 'command',
              command: `${projectDir}/hooks/stop.sh ${nodeId} $STATUS`
            }]
          }
        ],
        PostToolUse: [
          {
            matcher: 'Write|Edit|MultiEdit',
            hooks: [{
              type: 'command',
              command: `${projectDir}/hooks/track-changes.sh ${nodeId}`
            }]
          }
        ],
        Error: [
          {
            hooks: [{
              type: 'command',
              command: `${projectDir}/hooks/error.sh ${nodeId} "$ERROR_MESSAGE"`
            }]
          }
        ]
      }
    };

    await fs.writeFile(
      path.join(projectDir, '.claude', 'hooks.json'),
      JSON.stringify(hooksConfig, null, 2),
      'utf-8'
    );

    await this.createHookScripts(projectDir, nodeId);
  }

  private async createHookScripts(projectDir: string, nodeId: string): Promise<void> {
    const stopScript = `#!/bin/bash
NODE_ID="${nodeId}"
STATUS="$1"
OUTPUT=$(cat ${projectDir}/output.json 2>/dev/null || echo '{}')

curl -X POST ${this.hooksBaseUrl}/api/agent-complete \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"nodeId\\": \\"$NODE_ID\\",
    \\"status\\": \\"$STATUS\\",
    \\"output\\": $OUTPUT,
    \\"timestamp\\": $(date +%s)
  }"
`;

    const trackChangesScript = `#!/bin/bash
NODE_ID="${nodeId}"
git -C ${projectDir} add -A 2>/dev/null
CHANGES=$(git -C ${projectDir} diff --cached --name-only 2>/dev/null || echo "")

if [ ! -z "$CHANGES" ]; then
  curl -X POST ${this.hooksBaseUrl}/api/file-changed \\
    -H "Content-Type: application/json" \\
    -d "{
      \\"nodeId\\": \\"$NODE_ID\\",
      \\"files\\": $(echo "$CHANGES" | jq -R -s -c 'split("\\n") | map(select(length > 0))'),
      \\"timestamp\\": $(date +%s)
    }"
fi
`;

    const errorScript = `#!/bin/bash
NODE_ID="${nodeId}"
ERROR_MESSAGE="$1"

curl -X POST ${this.hooksBaseUrl}/api/agent-error \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"nodeId\\": \\"$NODE_ID\\",
    \\"error\\": \\"$ERROR_MESSAGE\\",
    \\"timestamp\\": $(date +%s)
  }"
`;

    await fs.writeFile(path.join(projectDir, 'hooks', 'stop.sh'), stopScript, { mode: 0o755 });
    await fs.writeFile(path.join(projectDir, 'hooks', 'track-changes.sh'), trackChangesScript, { mode: 0o755 });
    await fs.writeFile(path.join(projectDir, 'hooks', 'error.sh'), errorScript, { mode: 0o755 });
  }

  private async spawnClaudeProcess(projectDir: string, instructions: string): Promise<ChildProcess> {
    // Using claude CLI with correct parameters for headless execution
    const childProcess = spawn('claude', [
      '-p', // Print mode for non-interactive output
      '--dangerously-skip-permissions', // Skip permission prompts for automation
      '--output-format', 'text', // Ensure text output
      instructions
    ], {
      cwd: projectDir,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: projectDir,
        NO_COLOR: '1' // Disable color output for cleaner parsing
      },
      stdio: ['pipe', 'pipe', 'pipe'] // Ensure all streams are piped
    });

    return childProcess;
  }

  private setupProcessListeners(process: ChildProcess, instance: ClaudeInstance): void {
    process.stdout?.on('data', (data) => {
      const output = data.toString();
      instance.logs.push(`[STDOUT] ${output}`);
      this.emit('agent:output', { instanceId: instance.id, output, stream: 'stdout' });
    });

    process.stderr?.on('data', (data) => {
      const output = data.toString();
      instance.logs.push(`[STDERR] ${output}`);
      this.emit('agent:output', { instanceId: instance.id, output, stream: 'stderr' });
    });

    process.on('exit', (code) => {
      instance.status = code === 0 ? 'stopped' : 'error';
      instance.stoppedAt = new Date();
      instance.metrics.duration = instance.stoppedAt.getTime() - instance.startedAt.getTime();
      
      this.emit('agent:stopped', {
        instanceId: instance.id,
        nodeId: instance.nodeId,
        exitCode: code
      });
    });

    process.on('error', (error) => {
      instance.status = 'error';
      instance.stoppedAt = new Date();
      this.emit('agent:error', {
        instanceId: instance.id,
        nodeId: instance.nodeId,
        error
      });
    });
  }

  async stopAgent(instanceId: string, graceful: boolean = true): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance || !instance.process) {
      throw new Error(`Instance ${instanceId} not found or not running`);
    }

    if (graceful) {
      instance.process.kill('SIGTERM');
      
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          instance.process?.kill('SIGKILL');
          resolve();
        }, 10000);

        instance.process.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    } else {
      instance.process.kill('SIGKILL');
    }

    instance.status = 'stopped';
    instance.stoppedAt = new Date();
  }

  async stopAllAgents(): Promise<void> {
    const promises = Array.from(this.instances.keys()).map(id => 
      this.stopAgent(id).catch(err => 
        console.error(`Failed to stop agent ${id}:`, err)
      )
    );
    await Promise.all(promises);
  }

  getInstance(instanceId: string): ClaudeInstance | undefined {
    return this.instances.get(instanceId);
  }

  getNodeInstance(nodeId: string): ClaudeInstance | undefined {
    return Array.from(this.instances.values()).find(i => i.nodeId === nodeId);
  }

  getAllInstances(): ClaudeInstance[] {
    return Array.from(this.instances.values());
  }

  getRunningInstances(): ClaudeInstance[] {
    return this.getAllInstances().filter(i => i.status === 'running');
  }

  async cleanup(flowId: string): Promise<void> {
    const flowDir = path.join(this.projectsBaseDir, flowId);
    try {
      await fs.rm(flowDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to cleanup flow directory ${flowDir}:`, error);
    }
  }
}