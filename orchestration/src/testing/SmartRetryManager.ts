import { TestResult, TestFailure } from './TestParser';
import { ErrorAnalysis, ErrorCategory, FixSuggestion, ErrorIntelligenceSystem } from './ErrorAnalyzer';

export interface RetryStrategy {
  maxAttempts: number;
  backoff: 'linear' | 'exponential' | 'fibonacci' | 'adaptive';
  initialDelay?: number;
  maxDelay?: number;
  contextEnhancement: ContextEnhancement;
  failureThreshold?: number; // Stop retrying if failure rate exceeds this
  adaptiveConfig?: AdaptiveConfig;
}

export interface ContextEnhancement {
  includeErrors: boolean;
  includeStackTrace: boolean;
  includeSuggestions: boolean;
  includeRelatedCode: boolean;
  includeEnvironmentInfo?: boolean;
  includeDependencies?: boolean;
  includeRecentChanges?: boolean;
  customContext?: Record<string, any>;
}

export interface AdaptiveConfig {
  learningRate: number; // How quickly to adapt (0-1)
  successBonus: number; // Delay reduction on success
  failurePenalty: number; // Delay increase on failure
  minDelay: number;
  maxDelay: number;
}

export interface RetryContext {
  attempt: number;
  previousErrors: ErrorAnalysis[];
  previousSuggestions: FixSuggestion[];
  appliedFixes: string[];
  environmentChanges: Record<string, any>;
  additionalInstructions: string[];
  testModifications?: TestModification[];
  resourceAdjustments?: ResourceAdjustment[];
}

export interface TestModification {
  type: 'timeout' | 'mock' | 'setup' | 'teardown' | 'skip' | 'focus';
  target: string;
  modification: any;
  reason: string;
}

export interface ResourceAdjustment {
  type: 'memory' | 'cpu' | 'timeout' | 'concurrency';
  value: number | string;
  reason: string;
}

export interface RetryResult {
  success: boolean;
  attempt: number;
  totalAttempts: number;
  finalResult?: TestResult;
  context: RetryContext;
  improvements: string[];
  persistentFailures?: TestFailure[];
}

export class SmartRetryManager {
  private errorAnalyzer: ErrorIntelligenceSystem;
  private retryHistory: Map<string, RetryHistory> = new Map();
  private successPatterns: Map<string, SuccessPattern> = new Map();
  private delays: Map<string, number> = new Map();

  constructor(errorAnalyzer?: ErrorIntelligenceSystem) {
    this.errorAnalyzer = errorAnalyzer || new ErrorIntelligenceSystem();
    this.initializeSuccessPatterns();
  }

  private initializeSuccessPatterns(): void {
    // Pre-populate with known successful retry patterns
    this.successPatterns.set('network_retry', {
      errorCategory: ErrorCategory.NETWORK,
      successRate: 0.8,
      averageAttempts: 2.5,
      recommendedDelay: 5000,
      fixes: ['exponential backoff', 'connection pool reset']
    });

    this.successPatterns.set('timeout_increase', {
      errorCategory: ErrorCategory.TIMEOUT,
      successRate: 0.9,
      averageAttempts: 1.5,
      recommendedDelay: 0,
      fixes: ['double timeout', 'async handling']
    });

    this.successPatterns.set('dependency_install', {
      errorCategory: ErrorCategory.DEPENDENCY,
      successRate: 0.95,
      averageAttempts: 1.2,
      recommendedDelay: 1000,
      fixes: ['npm install', 'clear cache']
    });
  }

  async createRetryContext(
    testResult: TestResult,
    previousContext?: RetryContext,
    strategy?: RetryStrategy
  ): Promise<RetryContext> {
    const attempt = previousContext ? previousContext.attempt + 1 : 1;
    const context: RetryContext = {
      attempt,
      previousErrors: previousContext?.previousErrors || [],
      previousSuggestions: previousContext?.previousSuggestions || [],
      appliedFixes: previousContext?.appliedFixes || [],
      environmentChanges: previousContext?.environmentChanges || {},
      additionalInstructions: [],
      testModifications: [],
      resourceAdjustments: []
    };

    // Analyze all failures
    const errorAnalyses: ErrorAnalysis[] = [];
    for (const failure of testResult.failures) {
      const analysis = this.errorAnalyzer.analyzeError(failure);
      errorAnalyses.push(analysis);
      context.previousErrors.push(analysis);
    }

    // Generate context enhancements based on strategy
    if (strategy?.contextEnhancement) {
      await this.enhanceContext(context, errorAnalyses, strategy.contextEnhancement);
    }

    // Add adaptive modifications based on attempt number
    this.addAdaptiveModifications(context, errorAnalyses, attempt);

    // Learn from previous attempts
    if (previousContext && previousContext.previousErrors.length > 0) {
      this.learnFromAttempt(context, previousContext, errorAnalyses);
    }

    return context;
  }

  private async enhanceContext(
    context: RetryContext,
    analyses: ErrorAnalysis[],
    enhancement: ContextEnhancement
  ): Promise<void> {
    // Group errors by category for better context
    const errorsByCategory = this.groupByCategory(analyses);

    // Add error summaries
    if (enhancement.includeErrors) {
      for (const [category, errors] of errorsByCategory) {
        const summary = this.summarizeErrors(errors);
        context.additionalInstructions.push(
          `[${category}] ${errors.length} error(s): ${summary}`
        );
      }
    }

    // Add stack traces for debugging
    if (enhancement.includeStackTrace) {
      for (const analysis of analyses) {
        if (analysis.context?.stackFrames && analysis.context.stackFrames.length > 0) {
          const topFrames = analysis.context.stackFrames.slice(0, 3);
          const stackSummary = topFrames
            .map(f => `${f.file}:${f.line}`)
            .join(' -> ');
          context.additionalInstructions.push(
            `Stack trace: ${stackSummary}`
          );
        }
      }
    }

    // Add fix suggestions
    if (enhancement.includeSuggestions) {
      const allSuggestions = analyses.flatMap(a => a.suggestions);
      const topSuggestions = this.prioritizeSuggestions(allSuggestions);
      
      for (const suggestion of topSuggestions.slice(0, 3)) {
        context.additionalInstructions.push(
          `Suggestion: ${suggestion.description}`
        );
        
        if (suggestion.code) {
          context.additionalInstructions.push(
            `Example: ${suggestion.code}`
          );
        }

        // Track that we're applying this suggestion
        context.appliedFixes.push(suggestion.description);
      }
    }

    // Add related code context
    if (enhancement.includeRelatedCode) {
      // This would require file reading capability
      context.additionalInstructions.push(
        'Consider reviewing the failing test files and their dependencies'
      );
    }

    // Add environment info
    if (enhancement.includeEnvironmentInfo) {
      context.environmentChanges['NODE_ENV'] = process.env.NODE_ENV || 'test';
      context.environmentChanges['CI'] = process.env.CI || 'false';
    }
  }

  private addAdaptiveModifications(
    context: RetryContext,
    analyses: ErrorAnalysis[],
    attempt: number
  ): void {
    // Progressive timeout increases
    const hasTimeoutErrors = analyses.some(a => a.category === ErrorCategory.TIMEOUT);
    if (hasTimeoutErrors) {
      const timeoutMultiplier = Math.pow(2, attempt - 1);
      context.resourceAdjustments?.push({
        type: 'timeout',
        value: timeoutMultiplier,
        reason: `Increase timeout by ${timeoutMultiplier}x for attempt ${attempt}`
      });
      
      context.testModifications?.push({
        type: 'timeout',
        target: 'global',
        modification: { multiplier: timeoutMultiplier },
        reason: 'Previous timeout failures'
      });
    }

    // Network error handling
    const hasNetworkErrors = analyses.some(a => a.category === ErrorCategory.NETWORK);
    if (hasNetworkErrors && attempt > 1) {
      context.testModifications?.push({
        type: 'setup',
        target: 'network',
        modification: { 
          retryConfig: { 
            retries: 3, 
            retryDelay: 1000 * attempt 
          } 
        },
        reason: 'Network instability detected'
      });
    }

    // Memory adjustments for performance errors
    const hasPerformanceErrors = analyses.some(a => a.category === ErrorCategory.PERFORMANCE);
    if (hasPerformanceErrors) {
      context.resourceAdjustments?.push({
        type: 'memory',
        value: '4096MB',
        reason: 'Performance issues detected, increasing memory allocation'
      });
    }

    // Concurrency reduction for race conditions
    const possibleRaceCondition = analyses.some(a => 
      a.category === ErrorCategory.RUNTIME && 
      a.context?.stackFrames?.some(f => f.function?.includes('async'))
    );
    if (possibleRaceCondition && attempt > 2) {
      context.resourceAdjustments?.push({
        type: 'concurrency',
        value: 1,
        reason: 'Possible race condition, running tests serially'
      });
    }
  }

  private learnFromAttempt(
    context: RetryContext,
    previousContext: RetryContext,
    currentAnalyses: ErrorAnalysis[]
  ): void {
    // Check if the same errors are persisting
    const persistentErrors = this.findPersistentErrors(
      previousContext.previousErrors,
      currentAnalyses
    );

    if (persistentErrors.length > 0) {
      // These errors didn't respond to previous fixes
      context.additionalInstructions.push(
        `${persistentErrors.length} error(s) persisted despite fixes. Trying alternative approach.`
      );

      // Try more aggressive fixes for persistent errors
      for (const error of persistentErrors) {
        if (error.category === ErrorCategory.TIMEOUT) {
          context.testModifications?.push({
            type: 'skip',
            target: 'timeout-sensitive',
            modification: { skip: true },
            reason: 'Persistent timeout issues'
          });
        } else if (error.category === ErrorCategory.NETWORK) {
          context.testModifications?.push({
            type: 'mock',
            target: 'external-services',
            modification: { mock: true },
            reason: 'Persistent network issues'
          });
        }
      }
    }

    // Check if we're making progress
    const previousErrorCount = previousContext.previousErrors.length;
    const currentErrorCount = currentAnalyses.length;
    
    if (currentErrorCount < previousErrorCount) {
      context.additionalInstructions.push(
        `Progress: Reduced errors from ${previousErrorCount} to ${currentErrorCount}`
      );
    } else if (currentErrorCount > previousErrorCount) {
      context.additionalInstructions.push(
        `Warning: Error count increased from ${previousErrorCount} to ${currentErrorCount}`
      );
    }
  }

  calculateDelay(strategy: RetryStrategy, attempt: number, testId?: string): number {
    const baseDelay = strategy.initialDelay || 1000;
    const maxDelay = strategy.maxDelay || 60000;
    let delay = baseDelay;

    switch (strategy.backoff) {
      case 'linear':
        delay = baseDelay * attempt;
        break;
        
      case 'exponential':
        delay = baseDelay * Math.pow(2, attempt - 1);
        break;
        
      case 'fibonacci':
        delay = baseDelay * this.fibonacci(attempt);
        break;
        
      case 'adaptive':
        delay = this.calculateAdaptiveDelay(strategy, attempt, testId);
        break;
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    delay = delay + jitter;

    return Math.min(delay, maxDelay);
  }

  private calculateAdaptiveDelay(
    strategy: RetryStrategy,
    attempt: number,
    testId?: string
  ): number {
    if (!strategy.adaptiveConfig || !testId) {
      return strategy.initialDelay || 1000;
    }

    const config = strategy.adaptiveConfig;
    const currentDelay = this.delays.get(testId) || config.minDelay;

    // Get history for this test
    const history = this.retryHistory.get(testId);
    if (!history) {
      this.delays.set(testId, config.minDelay);
      return config.minDelay;
    }

    // Calculate new delay based on success rate
    const successRate = history.successes / (history.successes + history.failures);
    let newDelay = currentDelay;

    if (successRate > 0.8) {
      // High success rate, reduce delay
      newDelay = currentDelay * (1 - config.successBonus * config.learningRate);
    } else if (successRate < 0.3) {
      // Low success rate, increase delay
      newDelay = currentDelay * (1 + config.failurePenalty * config.learningRate);
    }

    // Apply bounds
    newDelay = Math.max(config.minDelay, Math.min(config.maxDelay, newDelay));
    this.delays.set(testId, newDelay);

    return newDelay;
  }

  private fibonacci(n: number): number {
    if (n <= 1) return n;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) {
      const temp = a + b;
      a = b;
      b = temp;
    }
    return b;
  }

  shouldRetry(
    testResult: TestResult,
    context: RetryContext,
    strategy: RetryStrategy
  ): boolean {
    // Check max attempts
    if (context.attempt >= strategy.maxAttempts) {
      return false;
    }

    // Check failure threshold
    if (strategy.failureThreshold) {
      const failureRate = testResult.failed / testResult.total;
      if (failureRate > strategy.failureThreshold) {
        return false;
      }
    }

    // Don't retry if all errors are non-retriable
    const allNonRetriable = context.previousErrors.every(error => {
      return error.category === ErrorCategory.ASSERTION ||
             error.category === ErrorCategory.SYNTAX ||
             error.category === ErrorCategory.LOGIC;
    });

    if (allNonRetriable && context.attempt > 1) {
      return false;
    }

    // Check for persistent errors that haven't improved
    if (context.attempt > 2) {
      const persistentCount = this.countPersistentErrors(context);
      if (persistentCount === context.previousErrors.length) {
        // No improvement after multiple attempts
        return false;
      }
    }

    return true;
  }

  recordAttempt(testId: string, success: boolean, context: RetryContext): void {
    const history = this.retryHistory.get(testId) || {
      successes: 0,
      failures: 0,
      totalAttempts: 0,
      contexts: []
    };

    history.totalAttempts++;
    if (success) {
      history.successes++;
    } else {
      history.failures++;
    }
    history.contexts.push(context);

    // Keep only last 10 contexts
    if (history.contexts.length > 10) {
      history.contexts.shift();
    }

    this.retryHistory.set(testId, history);

    // Learn from this attempt
    if (!success && context.previousErrors.length > 0) {
      for (const error of context.previousErrors) {
        this.updateSuccessPatterns(error, success, context);
      }
    }
  }

  private updateSuccessPatterns(
    error: ErrorAnalysis,
    success: boolean,
    context: RetryContext
  ): void {
    const patternKey = `${error.category}_${context.attempt}`;
    const pattern = this.successPatterns.get(patternKey) || {
      errorCategory: error.category,
      successRate: 0,
      averageAttempts: 0,
      recommendedDelay: 1000,
      fixes: []
    };

    // Update success rate with exponential moving average
    const alpha = 0.2; // Learning rate
    pattern.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * pattern.successRate;
    pattern.averageAttempts = alpha * context.attempt + (1 - alpha) * pattern.averageAttempts;

    // Update fixes that worked
    if (success && context.appliedFixes.length > 0) {
      pattern.fixes = [...new Set([...pattern.fixes, ...context.appliedFixes])];
    }

    this.successPatterns.set(patternKey, pattern);
  }

  getRecommendations(testId: string): {
    recommendedStrategy: Partial<RetryStrategy>;
    confidence: number;
    reasoning: string[];
  } {
    const history = this.retryHistory.get(testId);
    const recommendations: string[] = [];
    let confidence = 0.5;

    const strategy: Partial<RetryStrategy> = {
      maxAttempts: 3,
      backoff: 'exponential',
      initialDelay: 1000
    };

    if (!history) {
      recommendations.push('No history available, using default strategy');
      return { recommendedStrategy: strategy, confidence, reasoning: recommendations };
    }

    const successRate = history.successes / history.totalAttempts;
    
    // Adjust based on success rate
    if (successRate > 0.8) {
      strategy.maxAttempts = 2;
      strategy.backoff = 'linear';
      recommendations.push('High success rate, using lighter retry strategy');
      confidence = 0.8;
    } else if (successRate < 0.3) {
      strategy.maxAttempts = 5;
      strategy.backoff = 'adaptive';
      recommendations.push('Low success rate, using adaptive strategy with more attempts');
      confidence = 0.7;
    }

    // Check for patterns in failures
    if (history.contexts.length > 0) {
      const lastContext = history.contexts[history.contexts.length - 1];
      const categories = lastContext.previousErrors.map(e => e.category);
      
      if (categories.includes(ErrorCategory.NETWORK)) {
        strategy.initialDelay = 5000;
        recommendations.push('Network errors detected, increasing initial delay');
      }
      
      if (categories.includes(ErrorCategory.TIMEOUT)) {
        strategy.contextEnhancement = {
          includeErrors: true,
          includeStackTrace: false,
          includeSuggestions: true,
          includeRelatedCode: false
        };
        recommendations.push('Timeout errors detected, enhancing context with suggestions');
      }
    }

    return {
      recommendedStrategy: strategy,
      confidence,
      reasoning: recommendations
    };
  }

  private groupByCategory(analyses: ErrorAnalysis[]): Map<ErrorCategory, ErrorAnalysis[]> {
    const grouped = new Map<ErrorCategory, ErrorAnalysis[]>();
    
    for (const analysis of analyses) {
      const group = grouped.get(analysis.category) || [];
      group.push(analysis);
      grouped.set(analysis.category, group);
    }
    
    return grouped;
  }

  private summarizeErrors(errors: ErrorAnalysis[]): string {
    if (errors.length === 0) return 'No errors';
    if (errors.length === 1) return errors[0].rootCause || 'Unknown cause';
    
    const causes = errors
      .map(e => e.rootCause)
      .filter(Boolean);
    
    if (causes.length > 0) {
      return causes.slice(0, 3).join(', ');
    }
    
    return `${errors.length} errors detected`;
  }

  private prioritizeSuggestions(suggestions: FixSuggestion[]): FixSuggestion[] {
    return suggestions
      .sort((a, b) => {
        // First by priority
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        // Then by confidence
        return b.confidence - a.confidence;
      })
      .filter((suggestion, index, self) => 
        // Remove duplicates
        index === self.findIndex(s => s.description === suggestion.description)
      );
  }

  private findPersistentErrors(
    previousErrors: ErrorAnalysis[],
    currentErrors: ErrorAnalysis[]
  ): ErrorAnalysis[] {
    return currentErrors.filter(current =>
      previousErrors.some(prev =>
        prev.category === current.category &&
        prev.rootCause === current.rootCause
      )
    );
  }

  private countPersistentErrors(context: RetryContext): number {
    if (context.previousErrors.length < 2) return 0;
    
    const lastError = context.previousErrors[context.previousErrors.length - 1];
    const previousError = context.previousErrors[context.previousErrors.length - 2];
    
    if (lastError.category === previousError.category &&
        lastError.rootCause === previousError.rootCause) {
      return 1;
    }
    
    return 0;
  }

  getStatistics(): {
    totalRetries: number;
    successRate: number;
    averageAttempts: number;
    successPatterns: SuccessPattern[];
  } {
    let totalRetries = 0;
    let totalSuccesses = 0;
    let totalAttempts = 0;

    for (const [, history] of this.retryHistory) {
      totalRetries += history.totalAttempts;
      totalSuccesses += history.successes;
      totalAttempts += history.totalAttempts;
    }

    return {
      totalRetries,
      successRate: totalAttempts > 0 ? totalSuccesses / totalAttempts : 0,
      averageAttempts: this.retryHistory.size > 0 ? totalAttempts / this.retryHistory.size : 0,
      successPatterns: Array.from(this.successPatterns.values())
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, 10)
    };
  }

  clearHistory(): void {
    this.retryHistory.clear();
    this.delays.clear();
  }
}

interface RetryHistory {
  successes: number;
  failures: number;
  totalAttempts: number;
  contexts: RetryContext[];
}

interface SuccessPattern {
  errorCategory: ErrorCategory;
  successRate: number;
  averageAttempts: number;
  recommendedDelay: number;
  fixes: string[];
}