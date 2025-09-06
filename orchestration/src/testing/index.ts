// Export all testing framework components
export * from './TestParser';
export * from './ErrorAnalyzer';
export * from './SmartRetryManager';
export * from './GitIntegrationService';
export * from './TestHookManager';

// Main Testing Integration class
import { UniversalTestParser, TestResult, TestFailure } from './TestParser';
import { ErrorIntelligenceSystem, ErrorAnalysis, FailureGrouper } from './ErrorAnalyzer';
import { SmartRetryManager, RetryStrategy, RetryContext, RetryResult } from './SmartRetryManager';
import { GitIntegrationService, GitConfig, MergeStrategy } from './GitIntegrationService';
import { TestHookManager, TestEventType } from './TestHookManager';
import { spawn } from 'child_process';

export interface TestingConfig {
  workingDirectory: string;
  framework?: string;
  retryStrategy?: RetryStrategy;
  gitConfig?: GitConfig;
  hooks?: {
    enabled: boolean;
    websocketPort?: number;
  };
}

export interface TestExecutionResult {
  success: boolean;
  result: TestResult;
  retries: number;
  errorAnalyses: ErrorAnalysis[];
  appliedFixes: string[];
  gitChanges?: {
    branch?: string;
    commits?: string[];
    conflicts?: any[];
  };
}

export class TestingIntegrationPipeline {
  private parser: UniversalTestParser;
  private errorAnalyzer: ErrorIntelligenceSystem;
  private retryManager: SmartRetryManager;
  private gitService?: GitIntegrationService;
  private hookManager: TestHookManager;
  private failureGrouper: FailureGrouper;
  private config: TestingConfig;

  constructor(config: TestingConfig) {
    this.config = config;
    this.parser = new UniversalTestParser();
    this.errorAnalyzer = new ErrorIntelligenceSystem();
    this.retryManager = new SmartRetryManager(this.errorAnalyzer);
    this.failureGrouper = new FailureGrouper();
    this.hookManager = new TestHookManager();

    if (config.gitConfig) {
      this.gitService = new GitIntegrationService(config.gitConfig);
    }

    this.setupDefaultHooks();
  }

  private setupDefaultHooks(): void {
    // Register default handlers for test events
    this.hookManager.registerHandler({
      event: TestEventType.TEST_FAILED,
      handler: async (event) => {
        console.log(`Test failed in ${event.nodeId}: ${event.data.message}`);
      },
      priority: 50
    });

    this.hookManager.registerHandler({
      event: TestEventType.RETRY_EXHAUSTED,
      handler: async (event) => {
        console.error(`Retry exhausted for ${event.nodeId} after ${event.data.attempt} attempts`);
      },
      priority: 50
    });

    this.hookManager.registerHandler({
      event: TestEventType.ERROR_ANALYZED,
      handler: async (event) => {
        const analysis = event.data.analysis as ErrorAnalysis;
        if (analysis.severity === 'critical') {
          console.error(`Critical error detected: ${analysis.rootCause}`);
        }
      },
      priority: 60
    });
  }

  async executeTests(
    command: string,
    nodeId: string,
    flowId: string
  ): Promise<TestExecutionResult> {
    // Emit test start event
    await this.hookManager.emitTestEvent(
      TestEventType.TEST_START,
      nodeId,
      flowId,
      { command, timestamp: new Date() }
    );

    let currentAttempt = 0;
    let lastResult: TestResult | undefined;
    let retryContext: RetryContext | undefined;
    const allErrorAnalyses: ErrorAnalysis[] = [];
    const appliedFixes: string[] = [];

    const strategy = this.config.retryStrategy || {
      maxAttempts: 3,
      backoff: 'exponential',
      contextEnhancement: {
        includeErrors: true,
        includeStackTrace: true,
        includeSuggestions: true,
        includeRelatedCode: false
      }
    };

    // Create a test branch if Git is configured
    let testBranch: string | undefined;
    if (this.gitService) {
      const currentBranch = await this.gitService.getCurrentBranch();
      testBranch = `test-${nodeId}-${Date.now()}`;
      await this.gitService.createBranch(testBranch, currentBranch);
    }

    while (currentAttempt < strategy.maxAttempts) {
      currentAttempt++;

      // Calculate delay for retry
      if (currentAttempt > 1) {
        const delay = this.retryManager.calculateDelay(strategy, currentAttempt, nodeId);
        
        await this.hookManager.emitTestEvent(
          TestEventType.RETRY_SCHEDULED,
          nodeId,
          flowId,
          { attempt: currentAttempt, delay }
        );

        await this.sleep(delay);

        await this.hookManager.emitTestEvent(
          TestEventType.RETRY_STARTED,
          nodeId,
          flowId,
          { attempt: currentAttempt, context: retryContext }
        );
      }

      // Execute tests
      const output = await this.runTestCommand(
        command,
        retryContext,
        nodeId,
        flowId
      );

      // Parse test results
      lastResult = this.parser.parse(output.stdout, this.config.framework, output.exitCode);

      // Stream results to hooks
      await this.hookManager.createHookChain(nodeId, flowId)
        .testCompleted(lastResult)
        .emit();

      // Check if tests passed
      if (lastResult.failed === 0) {
        await this.hookManager.emitTestEvent(
          TestEventType.TEST_COMPLETE,
          nodeId,
          flowId,
          lastResult
        );

        if (currentAttempt > 1) {
          await this.hookManager.emitTestEvent(
            TestEventType.RETRY_SUCCESS,
            nodeId,
            flowId,
            { attempt: currentAttempt, result: lastResult }
          );
        }

        // Commit successful changes if Git is configured
        if (this.gitService && testBranch) {
          await this.gitService.commit(
            `Tests passed after ${currentAttempt} attempt(s)`,
            appliedFixes
          );
        }

        return {
          success: true,
          result: lastResult,
          retries: currentAttempt - 1,
          errorAnalyses: allErrorAnalyses,
          appliedFixes,
          gitChanges: testBranch ? {
            branch: testBranch,
            commits: await this.getRecentCommits()
          } : undefined
        };
      }

      // Analyze failures
      const errorAnalyses = await this.analyzeFailures(lastResult.failures, nodeId, flowId);
      allErrorAnalyses.push(...errorAnalyses);

      // Create retry context
      retryContext = await this.retryManager.createRetryContext(
        lastResult,
        retryContext,
        strategy
      );

      // Apply suggested fixes
      if (retryContext.appliedFixes.length > 0) {
        appliedFixes.push(...retryContext.appliedFixes);
      }

      // Check if we should continue retrying
      if (!this.retryManager.shouldRetry(lastResult, retryContext, strategy)) {
        await this.hookManager.emitTestEvent(
          TestEventType.RETRY_EXHAUSTED,
          nodeId,
          flowId,
          { 
            attempt: currentAttempt,
            reason: 'Retry conditions not met',
            context: retryContext
          }
        );
        break;
      }

      // Record the attempt
      this.retryManager.recordAttempt(nodeId, lastResult.failed === 0, retryContext);

      // Emit retry failed event
      await this.hookManager.emitTestEvent(
        TestEventType.RETRY_FAILED,
        nodeId,
        flowId,
        { 
          attempt: currentAttempt,
          result: lastResult,
          context: retryContext
        }
      );
    }

    // Tests failed after all retries
    await this.hookManager.emitTestEvent(
      TestEventType.TEST_FAILED,
      nodeId,
      flowId,
      {
        result: lastResult,
        totalAttempts: currentAttempt,
        errorAnalyses: allErrorAnalyses
      }
    );

    // Handle Git operations for failed tests
    if (this.gitService && testBranch) {
      // Commit the failed state for debugging
      await this.gitService.commit(
        `Tests failed after ${currentAttempt} attempts`,
        appliedFixes
      );

      // Switch back to original branch
      const originalBranch = testBranch.replace(/^test-.*-\d+$/, '');
      await this.gitService.switchBranch(originalBranch);
    }

    return {
      success: false,
      result: lastResult!,
      retries: currentAttempt - 1,
      errorAnalyses: allErrorAnalyses,
      appliedFixes,
      gitChanges: testBranch ? {
        branch: testBranch,
        commits: await this.getRecentCommits()
      } : undefined
    };
  }

  private async runTestCommand(
    command: string,
    context: RetryContext | undefined,
    nodeId: string,
    flowId: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      // Modify command based on context
      let modifiedCommand = command;
      if (context?.resourceAdjustments) {
        for (const adjustment of context.resourceAdjustments) {
          if (adjustment.type === 'timeout' && typeof adjustment.value === 'number') {
            // Add timeout multiplier to command if supported
            if (command.includes('jest')) {
              modifiedCommand = `${modifiedCommand} --testTimeout=${30000 * adjustment.value}`;
            } else if (command.includes('mocha')) {
              modifiedCommand = `${modifiedCommand} --timeout ${10000 * adjustment.value}`;
            }
          }
        }
      }

      const [cmd, ...args] = modifiedCommand.split(' ');
      const testProcess = spawn(cmd, args, {
        cwd: this.config.workingDirectory,
        env: {
          ...process.env,
          ...context?.environmentChanges
        }
      });

      testProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // Stream output to hooks for real-time monitoring
        this.hookManager.streamTestOutput(nodeId, flowId, output, false);
      });

      testProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        
        // Stream error output to hooks
        this.hookManager.streamTestOutput(nodeId, flowId, output, true);
      });

      testProcess.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0
        });
      });

      testProcess.on('error', (error) => {
        stderr += `\nProcess error: ${error.message}`;
        resolve({
          stdout,
          stderr,
          exitCode: 1
        });
      });
    });
  }

  private async analyzeFailures(
    failures: TestFailure[],
    nodeId: string,
    flowId: string
  ): Promise<ErrorAnalysis[]> {
    const analyses: ErrorAnalysis[] = [];
    
    // Group related failures
    const groupedFailures = this.failureGrouper.groupFailures(failures);

    for (const [pattern, group] of groupedFailures) {
      // Analyze the first failure in each group
      const analysis = this.errorAnalyzer.analyzeError(group[0]);
      
      // Enhance with group information
      if (group.length > 1) {
        const commonCause = this.failureGrouper.findCommonCause(group);
        if (commonCause) {
          analysis.rootCause = commonCause;
        }
      }

      analyses.push(analysis);

      // Emit error analysis event
      await this.hookManager.emitErrorAnalysis(
        nodeId,
        flowId,
        group[0],
        analysis
      );

      // Learn from this error for future retries
      this.errorAnalyzer.learnFromError(group[0]);
    }

    return analyses;
  }

  private async getRecentCommits(): Promise<string[]> {
    if (!this.gitService) return [];
    
    try {
      const commits = await this.gitService.getRecentCommits(5);
      return commits.map(c => c.hash);
    } catch {
      return [];
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API
  attachWebSocket(ws: any): void {
    if (this.config.hooks?.enabled) {
      this.hookManager.attachWebSocket(ws);
    }
  }

  getTestStatistics(): any {
    return {
      errorStats: this.errorAnalyzer.getErrorStatistics(),
      retryStats: this.retryManager.getStatistics(),
      hookStats: this.hookManager.getStatistics()
    };
  }

  getRecommendations(testId: string): any {
    return this.retryManager.getRecommendations(testId);
  }

  subscribeToEvents(
    subscriberId: string,
    events: TestEventType[],
    callback: (event: any) => void
  ): void {
    this.hookManager.subscribe(subscriberId, events, callback);
  }

  unsubscribeFromEvents(subscriberId: string): void {
    this.hookManager.unsubscribe(subscriberId);
  }

  clearHistory(): void {
    this.errorAnalyzer.clearDatabase();
    this.retryManager.clearHistory();
    this.hookManager.clear();
  }
}

// Export a factory function for easy creation
export function createTestingPipeline(config: TestingConfig): TestingIntegrationPipeline {
  return new TestingIntegrationPipeline(config);
}