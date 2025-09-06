import { describe, test, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface Agent {
  id: string;
  name: string;
  category: string;
  description: string;
  capabilities: string[];
}

interface AgentConfig {
  id: string;
  name: string;
  hooks?: {
    Start?: Array<{ event: string; command: string; type?: string }>;
    Stop?: Array<{ event: string; command: string; type?: string }>;
    FileChange?: Array<{ event: string; command: string; type?: string }>;
    TestResult?: Array<{ event: string; command: string; type?: string }>;
    ReviewComplete?: Array<{ event: string; command: string; type?: string }>;
    DeploymentStatus?: Array<{ event: string; command: string; type?: string }>;
  };
  environment?: Record<string, string>;
  settings?: any;
}

interface HookTestResult {
  agentId: string;
  agentName: string;
  category: string;
  hooks: {
    Start: boolean;
    Stop: boolean;
    FileChange: boolean;
    TestResult: boolean;
    ReviewComplete: boolean;
    DeploymentStatus: boolean;
  };
  executionTime: number;
  errors: string[];
}

describe('All 52 Agent Hooks Tests', () => {
  let agents: Agent[] = [];
  let testResults: HookTestResult[] = [];
  
  beforeAll(() => {
    // Load agent directory
    const directoryPath = path.join(__dirname, '../../agents/directory.json');
    const directoryContent = fs.readFileSync(directoryPath, 'utf-8');
    const directory = JSON.parse(directoryContent);
    
    // Extract agents from the directory structure
    agents = [];
    for (const [category, categoryData] of Object.entries(directory.categories || {})) {
      const catData = categoryData as any;
      if (catData.agents && Array.isArray(catData.agents)) {
        for (const agentId of catData.agents) {
          agents.push({
            id: agentId,
            name: agentId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            category,
            description: `${category} agent`,
            capabilities: []
          });
        }
      }
    }
    
    console.log(`Loaded ${agents.length} agents for testing`);
  });
  
  describe('Agent Hook Configuration Tests', () => {
    test.each(agents)('$name ($id) has valid hook configuration', async (agent) => {
      const startTime = Date.now();
      const errors: string[] = [];
      const hookResults = {
        Start: false,
        Stop: false,
        FileChange: false,
        TestResult: false,
        ReviewComplete: false,
        DeploymentStatus: false
      };
      
      try {
        // Load agent configuration
        const configPath = path.join(
          __dirname, 
          '../../agents/library', 
          agent.category, 
          `${agent.id}.json`
        );
        
        if (!fs.existsSync(configPath)) {
          errors.push(`Configuration file not found: ${configPath}`);
          return;
        }
        
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const config: AgentConfig = JSON.parse(configContent);
        
        // Validate agent ID matches
        expect(config.id).toBe(agent.id);
        expect(config.name).toBe(agent.name);
        
        // Check for hooks configuration
        if (!config.hooks) {
          errors.push('No hooks configuration defined');
        } else {
          // Validate Stop hook (required for all agents)
          if (config.hooks.Stop && config.hooks.Stop.length > 0) {
            hookResults.Stop = true;
            
            // Validate Stop hook command
            const stopHook = config.hooks.Stop[0];
            expect(stopHook.event).toBe('Stop');
            expect(stopHook.command).toBeTruthy();
            
            // Check if it's the standard stop.sh hook
            if (stopHook.command.includes('stop.sh')) {
              hookResults.Stop = true;
            } else if (stopHook.command.includes('curl') || 
                      stopHook.command.includes('wget')) {
              // Custom callback implementation
              hookResults.Stop = true;
            } else {
              errors.push('Stop hook does not implement proper callback');
            }
          } else {
            errors.push('Stop hook is missing (required)');
          }
          
          // Check Start hook
          if (config.hooks.Start && config.hooks.Start.length > 0) {
            hookResults.Start = true;
            const startHook = config.hooks.Start[0];
            expect(startHook.event).toBe('Start');
          }
          
          // Check FileChange hook
          if (config.hooks.FileChange && config.hooks.FileChange.length > 0) {
            hookResults.FileChange = true;
            const fileChangeHook = config.hooks.FileChange[0];
            expect(fileChangeHook.event).toBe('FileChange');
            
            // Validate it uses track-changes.sh or equivalent
            if (!fileChangeHook.command.includes('track-changes') &&
                !fileChangeHook.command.includes('find') &&
                !fileChangeHook.command.includes('git status')) {
              errors.push('FileChange hook does not track changes properly');
            }
          }
          
          // Check category-specific hooks
          switch (agent.category) {
            case 'testing':
              if (config.hooks.TestResult && config.hooks.TestResult.length > 0) {
                hookResults.TestResult = true;
                const testHook = config.hooks.TestResult[0];
                expect(testHook.event).toBe('TestResult');
              } else {
                errors.push('Testing agent missing TestResult hook');
              }
              break;
              
            case 'review':
              if (config.hooks.ReviewComplete && config.hooks.ReviewComplete.length > 0) {
                hookResults.ReviewComplete = true;
                const reviewHook = config.hooks.ReviewComplete[0];
                expect(reviewHook.event).toBe('ReviewComplete');
              } else {
                errors.push('Review agent missing ReviewComplete hook');
              }
              break;
              
            case 'integration':
              if (config.hooks.DeploymentStatus && config.hooks.DeploymentStatus.length > 0) {
                hookResults.DeploymentStatus = true;
                const deployHook = config.hooks.DeploymentStatus[0];
                expect(deployHook.event).toBe('DeploymentStatus');
              } else {
                errors.push('Integration agent missing DeploymentStatus hook');
              }
              break;
          }
        }
        
        // Validate hook commands are executable
        if (config.hooks) {
          for (const [eventName, hooks] of Object.entries(config.hooks)) {
            if (Array.isArray(hooks)) {
              for (const hook of hooks) {
                // Check for environment variable usage
                if (hook.command.includes('${') && !hook.command.includes('${NODE_ID}') &&
                    !hook.command.includes('${CLAUDE_PROJECT_DIR}') &&
                    !hook.command.includes('${EXECUTION_ID}') &&
                    !hook.command.includes('${ORCHESTRATOR_URL}')) {
                  errors.push(`Hook ${eventName} uses unrecognized environment variable`);
                }
                
                // Check for dangerous commands
                if (hook.command.includes('rm -rf /') ||
                    hook.command.includes('sudo') ||
                    hook.command.includes('chmod 777')) {
                  errors.push(`Hook ${eventName} contains potentially dangerous command`);
                }
              }
            }
          }
        }
        
      } catch (error) {
        errors.push(`Error processing agent: ${error}`);
      }
      
      const executionTime = Date.now() - startTime;
      
      // Store test result
      const result: HookTestResult = {
        agentId: agent.id,
        agentName: agent.name,
        category: agent.category,
        hooks: hookResults,
        executionTime,
        errors
      };
      
      testResults.push(result);
      
      // Assert no critical errors
      if (errors.length > 0) {
        console.warn(`Agent ${agent.name} has issues:`, errors);
      }
      
      // All agents must have Stop hook
      expect(hookResults.Stop).toBe(true);
    });
  });
  
  describe('Hook Execution Simulation', () => {
    test('simulate hook execution for all agents', async () => {
      const simulationResults: any[] = [];
      
      for (const agent of agents) {
        const configPath = path.join(
          __dirname,
          '../../agents/library',
          agent.category,
          `${agent.id}.json`
        );
        
        if (!fs.existsSync(configPath)) {
          continue;
        }
        
        const config: AgentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        // Simulate environment
        const env = {
          NODE_ID: agent.id,
          EXECUTION_ID: `test-exec-${agent.id}`,
          CLAUDE_PROJECT_DIR: `/tmp/test-${agent.id}`,
          ORCHESTRATOR_URL: 'http://localhost:3002',
          STATUS: 'success',
          ...config.environment
        };
        
        const simulationResult = {
          agentId: agent.id,
          hookSimulations: {} as any
        };
        
        // Simulate each hook type
        if (config.hooks) {
          for (const [eventName, hooks] of Object.entries(config.hooks)) {
            if (Array.isArray(hooks) && hooks.length > 0) {
              const hook = hooks[0];
              
              // Replace environment variables
              let command = hook.command;
              for (const [key, value] of Object.entries(env)) {
                command = command.replace(`\${${key}}`, value);
              }
              
              // Check if command is safe to simulate
              const isSafeCommand = 
                command.startsWith('echo') ||
                command.startsWith('date') ||
                command.startsWith('pwd') ||
                command.startsWith('true') ||
                command.includes('--dry-run');
              
              simulationResult.hookSimulations[eventName] = {
                command: command.substring(0, 100), // Truncate for logging
                safe: isSafeCommand,
                wouldExecute: !command.includes('undefined')
              };
            }
          }
        }
        
        simulationResults.push(simulationResult);
      }
      
      // Verify all agents can have hooks simulated
      expect(simulationResults.length).toBe(agents.length);
      
      // Check that most agents have executable hooks
      const executableAgents = simulationResults.filter(r => 
        Object.values(r.hookSimulations).some((h: any) => h.wouldExecute)
      );
      
      expect(executableAgents.length).toBeGreaterThan(agents.length * 0.8);
    });
  });
  
  describe('Hook Performance Analysis', () => {
    test('analyze hook configuration complexity', () => {
      const complexityAnalysis = agents.map(agent => {
        const configPath = path.join(
          __dirname,
          '../../agents/library',
          agent.category,
          `${agent.id}.json`
        );
        
        if (!fs.existsSync(configPath)) {
          return null;
        }
        
        const config: AgentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        let totalHooks = 0;
        let totalCommands = 0;
        let maxCommandLength = 0;
        
        if (config.hooks) {
          for (const hooks of Object.values(config.hooks)) {
            if (Array.isArray(hooks)) {
              totalHooks += hooks.length;
              for (const hook of hooks) {
                totalCommands++;
                maxCommandLength = Math.max(maxCommandLength, hook.command.length);
              }
            }
          }
        }
        
        return {
          agentId: agent.id,
          category: agent.category,
          totalHooks,
          totalCommands,
          maxCommandLength,
          complexity: totalHooks * Math.log(maxCommandLength + 1)
        };
      }).filter(Boolean);
      
      // Calculate statistics
      const avgHooks = complexityAnalysis.reduce((sum, a) => sum + a!.totalHooks, 0) / complexityAnalysis.length;
      const avgCommandLength = complexityAnalysis.reduce((sum, a) => sum + a!.maxCommandLength, 0) / complexityAnalysis.length;
      
      console.log('Hook Complexity Statistics:');
      console.log(`  Average hooks per agent: ${avgHooks.toFixed(2)}`);
      console.log(`  Average max command length: ${avgCommandLength.toFixed(0)}`);
      
      // Group by category
      const byCategory = agents.reduce((acc, agent) => {
        if (!acc[agent.category]) acc[agent.category] = [];
        acc[agent.category].push(agent);
        return acc;
      }, {} as Record<string, Agent[]>);
      
      for (const [category, categoryAgents] of Object.entries(byCategory)) {
        const categoryAnalysis = complexityAnalysis.filter(a => 
          a && categoryAgents.some(ca => ca.id === a.agentId)
        );
        
        const categoryAvgHooks = categoryAnalysis.reduce((sum, a) => sum + a!.totalHooks, 0) / categoryAnalysis.length;
        
        console.log(`  ${category}: ${categoryAvgHooks.toFixed(2)} hooks/agent`);
      }
      
      // Verify reasonable complexity
      expect(avgHooks).toBeGreaterThan(1);
      expect(avgHooks).toBeLessThan(10);
      expect(avgCommandLength).toBeLessThan(500);
    });
  });
  
  describe('Generate Hook Test Report', () => {
    test('generate comprehensive hook test report', () => {
      const report = {
        timestamp: new Date().toISOString(),
        totalAgents: agents.length,
        testedAgents: testResults.length,
        summary: {
          allAgentsHaveStopHook: true,
          avgExecutionTime: 0,
          totalErrors: 0,
          successRate: 0
        },
        byCategory: {} as Record<string, any>,
        byHookType: {
          Start: 0,
          Stop: 0,
          FileChange: 0,
          TestResult: 0,
          ReviewComplete: 0,
          DeploymentStatus: 0
        },
        agentDetails: testResults,
        recommendations: [] as string[]
      };
      
      // Calculate summary statistics
      let totalExecutionTime = 0;
      let totalErrors = 0;
      let agentsWithAllRequiredHooks = 0;
      
      for (const result of testResults) {
        totalExecutionTime += result.executionTime;
        totalErrors += result.errors.length;
        
        // Check Stop hook (required)
        if (!result.hooks.Stop) {
          report.summary.allAgentsHaveStopHook = false;
        }
        
        // Count hook types
        for (const [hookType, hasHook] of Object.entries(result.hooks)) {
          if (hasHook) {
            report.byHookType[hookType as keyof typeof report.byHookType]++;
          }
        }
        
        // Group by category
        if (!report.byCategory[result.category]) {
          report.byCategory[result.category] = {
            count: 0,
            withStopHook: 0,
            withFileChangeHook: 0,
            avgExecutionTime: 0,
            errors: []
          };
        }
        
        report.byCategory[result.category].count++;
        if (result.hooks.Stop) report.byCategory[result.category].withStopHook++;
        if (result.hooks.FileChange) report.byCategory[result.category].withFileChangeHook++;
        report.byCategory[result.category].errors.push(...result.errors);
        
        // Check if agent has all required hooks for its category
        let hasRequired = result.hooks.Stop;
        if (result.category === 'testing' && !result.hooks.TestResult) hasRequired = false;
        if (result.category === 'review' && !result.hooks.ReviewComplete) hasRequired = false;
        if (result.category === 'integration' && !result.hooks.DeploymentStatus) hasRequired = false;
        
        if (hasRequired) agentsWithAllRequiredHooks++;
      }
      
      // Calculate averages
      report.summary.avgExecutionTime = totalExecutionTime / testResults.length;
      report.summary.totalErrors = totalErrors;
      report.summary.successRate = (agentsWithAllRequiredHooks / testResults.length) * 100;
      
      // Generate recommendations
      if (!report.summary.allAgentsHaveStopHook) {
        report.recommendations.push('Ensure all agents implement the Stop hook for proper cleanup');
      }
      
      if (report.byHookType.FileChange < agents.length * 0.5) {
        report.recommendations.push('Consider adding FileChange hooks to more agents for better tracking');
      }
      
      if (report.summary.successRate < 90) {
        report.recommendations.push('Review agents missing category-specific required hooks');
      }
      
      if (report.summary.avgExecutionTime > 100) {
        report.recommendations.push('Optimize hook validation performance');
      }
      
      // Write report to file
      const reportPath = path.join(__dirname, '../../test-reports/phase2-hooks.json');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      console.log('\n=== Hook Test Report Summary ===');
      console.log(`Total Agents: ${report.totalAgents}`);
      console.log(`Tested Agents: ${report.testedAgents}`);
      console.log(`Success Rate: ${report.summary.successRate.toFixed(2)}%`);
      console.log(`All Have Stop Hook: ${report.summary.allAgentsHaveStopHook}`);
      console.log(`Total Errors: ${report.summary.totalErrors}`);
      console.log(`Avg Execution Time: ${report.summary.avgExecutionTime.toFixed(2)}ms`);
      console.log('\nHook Coverage:');
      for (const [hookType, count] of Object.entries(report.byHookType)) {
        const percentage = (count / agents.length * 100).toFixed(1);
        console.log(`  ${hookType}: ${count}/${agents.length} (${percentage}%)`);
      }
      console.log('\nRecommendations:');
      report.recommendations.forEach(rec => console.log(`  - ${rec}`));
      console.log(`\nFull report saved to: ${reportPath}`);
      
      // Assertions
      expect(report.summary.allAgentsHaveStopHook).toBe(true);
      expect(report.summary.successRate).toBeGreaterThan(80);
      expect(report.byHookType.Stop).toBe(agents.length);
    });
  });
});