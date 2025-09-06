import { FlowNode } from '../../types';
import { ClaudeCodeManager } from './ClaudeCodeManager';
import { 
  TestingIntegrationPipeline, 
  TestingConfig, 
  TestExecutionResult,
  TestEventType,
  createTestingPipeline
} from '../testing';
import { OrchestrationError, ErrorCode } from '../utils/ErrorHandler';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface TestingAgentConfig {
  framework?: 'jest' | 'pytest' | 'go' | 'playwright' | 'cypress' | 'vitest';
  command?: string;
  retryOnFailure?: boolean;
  maxRetries?: number;
  enableGitIntegration?: boolean;
  enableHooks?: boolean;
}

export class TestingAgentExecutor {
  private claudeManager: ClaudeCodeManager;
  private testingPipelines: Map<string, TestingIntegrationPipeline> = new Map();

  constructor(claudeManager: ClaudeCodeManager) {
    this.claudeManager = claudeManager;
  }

  async executeTestingAgent(
    node: FlowNode,
    flowId: string,
    context: any
  ): Promise<any> {
    const nodeId = node.id;
    const projectDir = path.join('/projects', flowId, nodeId);

    // Parse testing configuration from node
    const testConfig = this.parseTestingConfig(node);

    // Create testing pipeline for this node
    const pipeline = this.getOrCreatePipeline(nodeId, projectDir, testConfig);

    // Subscribe to testing events for this node
    this.subscribeToTestEvents(pipeline, nodeId, flowId);

    try {
      // First spawn Claude Code to set up the test environment
      const setupResult = await this.setupTestEnvironment(node, projectDir, context);

      if (!setupResult.success) {
        throw new OrchestrationError(
          ErrorCode.EXECUTION_TIMEOUT,
          `Failed to setup test environment: ${setupResult.error}`,
          { nodeId, flowId }
        );
      }

      // Determine test command
      const testCommand = testConfig.command || this.detectTestCommand(projectDir, testConfig.framework);

      if (!testCommand) {
        throw new OrchestrationError(
          ErrorCode.INVALID_FLOW,
          'No test command specified or detected',
          { nodeId, flowId, framework: testConfig.framework }
        );
      }

      // Execute tests with retry logic
      const result = await pipeline.executeTests(testCommand, nodeId, flowId);

      // Process test results
      const processedResult = await this.processTestResults(result, node, flowId);

      // Handle post-test actions
      await this.handlePostTestActions(result, node, flowId, projectDir);

      return {
        success: result.success,
        testResult: result.result,
        retries: result.retries,
        errorAnalyses: result.errorAnalyses,
        appliedFixes: result.appliedFixes,
        processedResult,
        statistics: pipeline.getTestStatistics()
      };

    } catch (error) {
      console.error(`Testing agent execution failed for ${nodeId}:`, error);
      
      // Get recommendations for future runs
      const recommendations = pipeline.getRecommendations(nodeId);
      
      throw new OrchestrationError(
        ErrorCode.EXECUTION_TIMEOUT,
        `Testing agent failed: ${(error as Error).message}`,
        { 
          nodeId, 
          flowId, 
          recommendations,
          statistics: pipeline.getTestStatistics()
        },
        true // recoverable
      );
    } finally {
      // Cleanup
      pipeline.unsubscribeFromEvents(`${nodeId}-executor`);
    }
  }

  private parseTestingConfig(node: FlowNode): TestingAgentConfig {
    const config: TestingAgentConfig = {
      framework: node.inputs?.framework,
      command: node.inputs?.testCommand,
      retryOnFailure: node.config?.retryOnFailure ?? true,
      maxRetries: node.config?.maxRetries ?? 3,
      enableGitIntegration: node.inputs?.enableGit ?? false,
      enableHooks: true
    };

    // Parse framework from agent type if not specified
    if (!config.framework && node.agentId) {
      if (node.agentId.includes('jest')) config.framework = 'jest';
      else if (node.agentId.includes('pytest')) config.framework = 'pytest';
      else if (node.agentId.includes('go-test')) config.framework = 'go';
      else if (node.agentId.includes('playwright')) config.framework = 'playwright';
      else if (node.agentId.includes('cypress')) config.framework = 'cypress';
      else if (node.agentId.includes('vitest')) config.framework = 'vitest';
    }

    return config;
  }

  private getOrCreatePipeline(
    nodeId: string,
    workingDirectory: string,
    config: TestingAgentConfig
  ): TestingIntegrationPipeline {
    const existingPipeline = this.testingPipelines.get(nodeId);
    if (existingPipeline) {
      return existingPipeline;
    }

    const testingConfig: TestingConfig = {
      workingDirectory,
      framework: config.framework,
      retryStrategy: config.retryOnFailure ? {
        maxAttempts: config.maxRetries || 3,
        backoff: 'exponential',
        initialDelay: 1000,
        maxDelay: 30000,
        contextEnhancement: {
          includeErrors: true,
          includeStackTrace: true,
          includeSuggestions: true,
          includeRelatedCode: true,
          includeEnvironmentInfo: true
        },
        adaptiveConfig: {
          learningRate: 0.3,
          successBonus: 0.2,
          failurePenalty: 0.5,
          minDelay: 500,
          maxDelay: 60000
        }
      } : undefined,
      gitConfig: config.enableGitIntegration ? {
        workingDirectory,
        defaultBranch: 'main',
        author: {
          name: 'Anton Testing Agent',
          email: 'testing@anton.ai'
        }
      } : undefined,
      hooks: {
        enabled: config.enableHooks ?? true
      }
    };

    const pipeline = createTestingPipeline(testingConfig);
    this.testingPipelines.set(nodeId, pipeline);
    
    return pipeline;
  }

  private subscribeToTestEvents(
    pipeline: TestingIntegrationPipeline,
    nodeId: string,
    flowId: string
  ): void {
    const subscriberId = `${nodeId}-executor`;

    pipeline.subscribeToEvents(
      subscriberId,
      [
        TestEventType.TEST_START,
        TestEventType.TEST_COMPLETE,
        TestEventType.TEST_FAILED,
        TestEventType.ERROR_ANALYZED,
        TestEventType.RETRY_SCHEDULED,
        TestEventType.RETRY_EXHAUSTED,
        TestEventType.SUGGESTION_GENERATED
      ],
      (event) => {
        // Log important events
        switch (event.type) {
          case TestEventType.TEST_START:
            console.log(`[${nodeId}] Tests starting...`);
            break;
          case TestEventType.TEST_COMPLETE:
            console.log(`[${nodeId}] Tests completed successfully`);
            break;
          case TestEventType.TEST_FAILED:
            console.error(`[${nodeId}] Tests failed:`, event.data.message);
            break;
          case TestEventType.ERROR_ANALYZED:
            const analysis = event.data.analysis;
            console.log(`[${nodeId}] Error analysis: ${analysis.category} - ${analysis.rootCause}`);
            break;
          case TestEventType.SUGGESTION_GENERATED:
            console.log(`[${nodeId}] Suggestions generated:`, event.data.suggestions);
            break;
          case TestEventType.RETRY_SCHEDULED:
            console.log(`[${nodeId}] Retry scheduled: attempt ${event.data.attempt}`);
            break;
          case TestEventType.RETRY_EXHAUSTED:
            console.error(`[${nodeId}] All retry attempts exhausted`);
            break;
        }
      }
    );
  }

  private async setupTestEnvironment(
    node: FlowNode,
    projectDir: string,
    context: any
  ): Promise<{ success: boolean; error?: string }> {
    // Create test-specific instructions for Claude
    const testInstructions = `
${node.instructions}

Additional Testing Context:
- This is a testing agent execution
- Working directory: ${projectDir}
- Previous context: ${JSON.stringify(context, null, 2)}
- Focus on setting up the test environment and ensuring all dependencies are installed
- Do not run tests yet, just prepare the environment
    `.trim();

    // Write instructions to the project directory
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'instructions.md'),
      testInstructions
    );

    // Write input context if provided
    if (context && Object.keys(context).length > 0) {
      await fs.writeFile(
        path.join(projectDir, 'input.json'),
        JSON.stringify(context, null, 2)
      );
    }

    // Spawn Claude to set up the environment
    const instance = await this.claudeManager.spawnAgent(node, projectDir);
    
    // Wait for setup to complete (with timeout)
    const setupTimeout = 60000; // 1 minute for setup
    const startTime = Date.now();

    while (Date.now() - startTime < setupTimeout) {
      const status = await this.claudeManager.getAgentStatus(instance.id);
      
      if (status === 'completed') {
        return { success: true };
      } else if (status === 'failed') {
        const output = await this.claudeManager.getAgentOutput(instance.id);
        return { 
          success: false, 
          error: output?.error || 'Setup failed' 
        };
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return { 
      success: false, 
      error: 'Setup timeout exceeded' 
    };
  }

  private async detectTestCommand(
    projectDir: string,
    framework?: string
  ): Promise<string | undefined> {
    // Try to detect test command from package.json or other config files
    try {
      const packageJsonPath = path.join(projectDir, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      if (packageJson.scripts?.test) {
        return `npm test`;
      }
    } catch {
      // No package.json or no test script
    }

    // Framework-specific defaults
    switch (framework) {
      case 'jest':
        return 'npx jest';
      case 'vitest':
        return 'npx vitest run';
      case 'pytest':
        return 'python -m pytest';
      case 'go':
        return 'go test ./...';
      case 'playwright':
        return 'npx playwright test';
      case 'cypress':
        return 'npx cypress run';
      default:
        return undefined;
    }
  }

  private async processTestResults(
    result: TestExecutionResult,
    node: FlowNode,
    flowId: string
  ): Promise<any> {
    const processed: any = {
      summary: {
        total: result.result.total,
        passed: result.result.passed,
        failed: result.result.failed,
        skipped: result.result.skipped,
        duration: result.result.duration,
        successRate: result.result.total > 0 
          ? (result.result.passed / result.result.total) * 100 
          : 0
      },
      retryInfo: {
        attempts: result.retries + 1,
        appliedFixes: result.appliedFixes
      }
    };

    // Add failure details if tests failed
    if (result.result.failed > 0) {
      processed.failures = result.result.failures.map(f => ({
        test: f.testName,
        suite: f.suiteName,
        error: f.error.message,
        file: f.file,
        line: f.line
      }));

      // Add error analysis insights
      processed.errorInsights = result.errorAnalyses.map(a => ({
        category: a.category,
        severity: a.severity,
        rootCause: a.rootCause,
        topSuggestions: a.suggestions.slice(0, 3).map(s => s.description)
      }));
    }

    // Add coverage if available
    if (result.result.coverage) {
      processed.coverage = {
        lines: result.result.coverage.lines.percentage,
        branches: result.result.coverage.branches?.percentage,
        functions: result.result.coverage.functions?.percentage
      };
    }

    return processed;
  }

  private async handlePostTestActions(
    result: TestExecutionResult,
    node: FlowNode,
    flowId: string,
    projectDir: string
  ): Promise<void> {
    // Write test results to output file
    const outputPath = path.join(projectDir, 'output.json');
    await fs.writeFile(
      outputPath,
      JSON.stringify({
        success: result.success,
        summary: result.result,
        retries: result.retries,
        timestamp: new Date().toISOString()
      }, null, 2)
    );

    // If tests failed and we have suggestions, write them to a file
    if (!result.success && result.errorAnalyses.length > 0) {
      const suggestionsPath = path.join(projectDir, 'test-suggestions.md');
      const suggestionsContent = this.generateSuggestionsMarkdown(result.errorAnalyses);
      await fs.writeFile(suggestionsPath, suggestionsContent);
    }

    // Clean up pipeline if tests completed (success or final failure)
    this.testingPipelines.delete(node.id);
  }

  private generateSuggestionsMarkdown(analyses: any[]): string {
    let markdown = '# Test Failure Analysis and Suggestions\n\n';
    
    for (const analysis of analyses) {
      markdown += `## Error: ${analysis.category}\n`;
      markdown += `**Root Cause:** ${analysis.rootCause || 'Unknown'}\n`;
      markdown += `**Severity:** ${analysis.severity}\n\n`;
      
      if (analysis.suggestions && analysis.suggestions.length > 0) {
        markdown += '### Suggestions:\n';
        for (const suggestion of analysis.suggestions) {
          markdown += `- ${suggestion.description}\n`;
          if (suggestion.code) {
            markdown += `  \`\`\`\n  ${suggestion.code}\n  \`\`\`\n`;
          }
        }
        markdown += '\n';
      }
    }
    
    return markdown;
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    for (const pipeline of this.testingPipelines.values()) {
      pipeline.clearHistory();
    }
    this.testingPipelines.clear();
  }
}