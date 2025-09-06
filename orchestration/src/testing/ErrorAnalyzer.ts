import { TestFailure, TestError } from './TestParser';

export enum ErrorCategory {
  SYNTAX = 'syntax',
  LOGIC = 'logic',
  RUNTIME = 'runtime',
  ASSERTION = 'assertion',
  TIMEOUT = 'timeout',
  NETWORK = 'network',
  DEPENDENCY = 'dependency',
  CONFIGURATION = 'configuration',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  UNKNOWN = 'unknown'
}

export interface ErrorAnalysis {
  category: ErrorCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number; // 0-1
  rootCause?: string;
  suggestions: FixSuggestion[];
  relatedErrors: RelatedError[];
  patterns: ErrorPattern[];
  context?: ErrorContext;
}

export interface FixSuggestion {
  type: 'code' | 'config' | 'dependency' | 'environment' | 'documentation';
  description: string;
  confidence: number; // 0-1
  code?: string;
  explanation?: string;
  documentation?: string[];
  priority: number; // 1-10, higher is more important
}

export interface RelatedError {
  message: string;
  similarity: number; // 0-1
  occurrences: number;
  firstSeen?: Date;
  lastSeen?: Date;
}

export interface ErrorPattern {
  pattern: string;
  type: ErrorCategory;
  frequency: number;
  examples: string[];
}

export interface ErrorContext {
  codeSnippet?: string;
  variables?: Record<string, any>;
  environmentInfo?: Record<string, string>;
  stackFrames?: StackFrame[];
  dependencies?: string[];
  recentChanges?: string[];
}

export interface StackFrame {
  file: string;
  line: number;
  column?: number;
  function?: string;
  code?: string;
}

export class ErrorIntelligenceSystem {
  private errorDatabase: Map<string, ErrorPattern> = new Map();
  private suggestionTemplates: Map<ErrorCategory, FixSuggestion[]> = new Map();
  private commonPatterns: RegExp[] = [];

  constructor() {
    this.initializePatterns();
    this.initializeSuggestions();
  }

  private initializePatterns(): void {
    // Syntax errors
    this.addPattern({
      pattern: 'unexpected token|syntax error|parse error',
      type: ErrorCategory.SYNTAX,
      frequency: 0,
      examples: []
    });

    // Type errors
    this.addPattern({
      pattern: 'type error|cannot read property|undefined is not|null is not|is not a function',
      type: ErrorCategory.RUNTIME,
      frequency: 0,
      examples: []
    });

    // Import/Module errors
    this.addPattern({
      pattern: 'cannot find module|module not found|import error|require error',
      type: ErrorCategory.DEPENDENCY,
      frequency: 0,
      examples: []
    });

    // Network errors
    this.addPattern({
      pattern: 'ECONNREFUSED|ETIMEDOUT|network error|fetch failed|axios error',
      type: ErrorCategory.NETWORK,
      frequency: 0,
      examples: []
    });

    // Timeout errors
    this.addPattern({
      pattern: 'timeout|exceeded|deadline|timed out',
      type: ErrorCategory.TIMEOUT,
      frequency: 0,
      examples: []
    });

    // Assertion errors
    this.addPattern({
      pattern: 'assertion failed|expect.*to|should.*equal|assert',
      type: ErrorCategory.ASSERTION,
      frequency: 0,
      examples: []
    });

    // Configuration errors
    this.addPattern({
      pattern: 'config|configuration|environment variable|settings',
      type: ErrorCategory.CONFIGURATION,
      frequency: 0,
      examples: []
    });

    // Security errors
    this.addPattern({
      pattern: 'permission denied|unauthorized|forbidden|authentication|CORS',
      type: ErrorCategory.SECURITY,
      frequency: 0,
      examples: []
    });

    // Performance errors
    this.addPattern({
      pattern: 'memory|heap|stack overflow|performance|slow',
      type: ErrorCategory.PERFORMANCE,
      frequency: 0,
      examples: []
    });
  }

  private initializeSuggestions(): void {
    // Syntax error suggestions
    this.suggestionTemplates.set(ErrorCategory.SYNTAX, [
      {
        type: 'code',
        description: 'Check for missing semicolons, brackets, or parentheses',
        confidence: 0.8,
        priority: 9,
        explanation: 'Syntax errors are often caused by missing or mismatched delimiters'
      },
      {
        type: 'code',
        description: 'Verify proper use of async/await syntax',
        confidence: 0.6,
        priority: 7,
        explanation: 'Async functions require proper await usage and error handling'
      }
    ]);

    // Runtime error suggestions
    this.suggestionTemplates.set(ErrorCategory.RUNTIME, [
      {
        type: 'code',
        description: 'Add null/undefined checks before accessing properties',
        confidence: 0.9,
        priority: 10,
        code: 'if (object && object.property) { /* use property */ }',
        explanation: 'Defensive programming prevents runtime errors'
      },
      {
        type: 'code',
        description: 'Use optional chaining (?.) for safe property access',
        confidence: 0.8,
        priority: 8,
        code: 'object?.property?.subProperty',
        explanation: 'Optional chaining safely handles null/undefined values'
      }
    ]);

    // Dependency error suggestions
    this.suggestionTemplates.set(ErrorCategory.DEPENDENCY, [
      {
        type: 'dependency',
        description: 'Run npm install or yarn install to install missing dependencies',
        confidence: 0.9,
        priority: 10,
        explanation: 'Missing modules often indicate uninstalled dependencies'
      },
      {
        type: 'code',
        description: 'Check import paths and ensure they are correct',
        confidence: 0.8,
        priority: 9,
        explanation: 'Relative imports should use ./ or ../ prefixes'
      }
    ]);

    // Network error suggestions
    this.suggestionTemplates.set(ErrorCategory.NETWORK, [
      {
        type: 'environment',
        description: 'Check if the service is running and accessible',
        confidence: 0.9,
        priority: 10,
        explanation: 'Network errors often indicate service availability issues'
      },
      {
        type: 'code',
        description: 'Implement retry logic with exponential backoff',
        confidence: 0.7,
        priority: 8,
        code: 'await retry(async () => fetch(url), { retries: 3, backoff: true })',
        explanation: 'Retry logic helps handle transient network issues'
      }
    ]);

    // Timeout error suggestions
    this.suggestionTemplates.set(ErrorCategory.TIMEOUT, [
      {
        type: 'config',
        description: 'Increase timeout duration in test configuration',
        confidence: 0.8,
        priority: 9,
        code: 'jest.setTimeout(30000); // 30 seconds',
        explanation: 'Some operations may need more time to complete'
      },
      {
        type: 'code',
        description: 'Optimize slow operations or use mocks for testing',
        confidence: 0.7,
        priority: 7,
        explanation: 'Consider mocking external services in tests'
      }
    ]);

    // Assertion error suggestions
    this.suggestionTemplates.set(ErrorCategory.ASSERTION, [
      {
        type: 'code',
        description: 'Review expected vs actual values and update assertions',
        confidence: 0.9,
        priority: 10,
        explanation: 'Assertion failures indicate mismatched expectations'
      },
      {
        type: 'code',
        description: 'Use more flexible matchers (e.g., toContain, toMatchObject)',
        confidence: 0.6,
        priority: 6,
        explanation: 'Flexible matchers are less brittle than exact comparisons'
      }
    ]);
  }

  analyzeError(failure: TestFailure): ErrorAnalysis {
    const category = this.categorizeError(failure.error);
    const severity = this.assessSeverity(failure, category);
    const confidence = this.calculateConfidence(failure.error, category);
    const suggestions = this.generateSuggestions(failure, category);
    const relatedErrors = this.findRelatedErrors(failure.error);
    const patterns = this.identifyPatterns(failure.error);
    const context = this.extractContext(failure);

    // Try to identify root cause
    const rootCause = this.identifyRootCause(failure, category, patterns);

    return {
      category,
      severity,
      confidence,
      rootCause,
      suggestions,
      relatedErrors,
      patterns,
      context
    };
  }

  private categorizeError(error: TestError): ErrorCategory {
    const message = error.message.toLowerCase();
    const stack = (error.stack || '').toLowerCase();
    const combined = `${message} ${stack}`;

    // Check patterns in order of specificity
    for (const [, pattern] of this.errorDatabase) {
      const regex = new RegExp(pattern.pattern, 'i');
      if (regex.test(combined)) {
        pattern.frequency++;
        if (!pattern.examples.includes(error.message)) {
          pattern.examples.push(error.message);
          if (pattern.examples.length > 10) {
            pattern.examples.shift();
          }
        }
        return pattern.type;
      }
    }

    // Additional heuristics
    if (message.includes('syntax') || message.includes('unexpected')) {
      return ErrorCategory.SYNTAX;
    }
    if (message.includes('undefined') || message.includes('null') || message.includes('type')) {
      return ErrorCategory.RUNTIME;
    }
    if (message.includes('assert') || message.includes('expect') || message.includes('should')) {
      return ErrorCategory.ASSERTION;
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorCategory.TIMEOUT;
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return ErrorCategory.NETWORK;
    }
    if (message.includes('module') || message.includes('import') || message.includes('require')) {
      return ErrorCategory.DEPENDENCY;
    }
    if (message.includes('config') || message.includes('env')) {
      return ErrorCategory.CONFIGURATION;
    }
    if (message.includes('permission') || message.includes('auth') || message.includes('forbidden')) {
      return ErrorCategory.SECURITY;
    }
    if (message.includes('memory') || message.includes('performance') || message.includes('slow')) {
      return ErrorCategory.PERFORMANCE;
    }

    return ErrorCategory.UNKNOWN;
  }

  private assessSeverity(failure: TestFailure, category: ErrorCategory): 'critical' | 'high' | 'medium' | 'low' {
    // Critical: Security, configuration, or dependency errors that block execution
    if (category === ErrorCategory.SECURITY || 
        category === ErrorCategory.CONFIGURATION ||
        (category === ErrorCategory.DEPENDENCY && !failure.error.stack)) {
      return 'critical';
    }

    // High: Runtime errors, network errors in production code
    if (category === ErrorCategory.RUNTIME || 
        category === ErrorCategory.NETWORK ||
        category === ErrorCategory.SYNTAX) {
      return 'high';
    }

    // Medium: Test assertion failures, timeouts
    if (category === ErrorCategory.ASSERTION || 
        category === ErrorCategory.TIMEOUT) {
      return 'medium';
    }

    // Low: Performance issues, unknown errors
    return 'low';
  }

  private calculateConfidence(error: TestError, category: ErrorCategory): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence if we have stack trace
    if (error.stack) confidence += 0.2;

    // Increase confidence if error message is detailed
    if (error.message.length > 50) confidence += 0.1;

    // Increase confidence if we have expected/actual values
    if (error.expected || error.actual) confidence += 0.15;

    // Increase confidence for well-known error categories
    if (category !== ErrorCategory.UNKNOWN) confidence += 0.15;

    return Math.min(confidence, 1.0);
  }

  private generateSuggestions(failure: TestFailure, category: ErrorCategory): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];
    
    // Get template suggestions for the category
    const templates = this.suggestionTemplates.get(category) || [];
    suggestions.push(...templates);

    // Add context-specific suggestions based on error message
    const errorMessage = failure.error.message.toLowerCase();

    // Specific module not found suggestion
    if (errorMessage.includes('cannot find module')) {
      const moduleMatch = failure.error.message.match(/['"]([^'"]+)['"]/);
      if (moduleMatch) {
        suggestions.unshift({
          type: 'dependency',
          description: `Install missing module: npm install ${moduleMatch[1]}`,
          confidence: 0.95,
          priority: 10,
          code: `npm install ${moduleMatch[1]}`,
          explanation: `The module '${moduleMatch[1]}' is not installed`
        });
      }
    }

    // Property access suggestion
    if (errorMessage.includes('cannot read property')) {
      const propertyMatch = failure.error.message.match(/property ['"]([^'"]+)['"]/);
      if (propertyMatch) {
        suggestions.unshift({
          type: 'code',
          description: `Add null check before accessing '${propertyMatch[1]}'`,
          confidence: 0.9,
          priority: 10,
          code: `if (object && object.${propertyMatch[1]}) { /* safe to use */ }`,
          explanation: 'Object is null or undefined'
        });
      }
    }

    // Port in use suggestion
    if (errorMessage.includes('eaddrinuse')) {
      const portMatch = failure.error.message.match(/:(\d+)/);
      suggestions.unshift({
        type: 'environment',
        description: `Port ${portMatch ? portMatch[1] : 'is'} already in use`,
        confidence: 0.95,
        priority: 10,
        code: portMatch ? `lsof -i :${portMatch[1]} | grep LISTEN` : undefined,
        explanation: 'Another process is using this port. Kill it or use a different port.'
      });
    }

    // Sort by priority
    suggestions.sort((a, b) => b.priority - a.priority);

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  private findRelatedErrors(error: TestError): RelatedError[] {
    const related: RelatedError[] = [];
    const errorMessage = error.message.toLowerCase();

    // Find similar errors in the database
    for (const [, pattern] of this.errorDatabase) {
      if (pattern.frequency > 0 && pattern.examples.length > 0) {
        const similarity = this.calculateSimilarity(errorMessage, pattern.examples[0].toLowerCase());
        if (similarity > 0.5) {
          related.push({
            message: pattern.examples[0],
            similarity,
            occurrences: pattern.frequency,
            lastSeen: new Date()
          });
        }
      }
    }

    // Sort by similarity
    related.sort((a, b) => b.similarity - a.similarity);

    return related.slice(0, 3);
  }

  private identifyPatterns(error: TestError): ErrorPattern[] {
    const patterns: ErrorPattern[] = [];
    const combined = `${error.message} ${error.stack || ''}`.toLowerCase();

    for (const [, pattern] of this.errorDatabase) {
      const regex = new RegExp(pattern.pattern, 'i');
      if (regex.test(combined)) {
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private extractContext(failure: TestFailure): ErrorContext {
    const context: ErrorContext = {};

    // Extract stack frames
    if (failure.error.stack) {
      context.stackFrames = this.parseStackTrace(failure.error.stack);
    }

    // Add file and line info
    if (failure.file && failure.line) {
      if (!context.stackFrames) context.stackFrames = [];
      context.stackFrames.unshift({
        file: failure.file,
        line: failure.line,
        column: failure.column
      });
    }

    // Extract environment info from error message
    if (failure.error.message.includes('NODE_ENV')) {
      context.environmentInfo = { NODE_ENV: process.env.NODE_ENV || 'undefined' };
    }

    return context;
  }

  private parseStackTrace(stack: string): StackFrame[] {
    const frames: StackFrame[] = [];
    const lines = stack.split('\n');

    for (const line of lines) {
      const match = line.match(/at\s+(?:(.+?)\s+\()?(.+):(\d+):(\d+)\)?/);
      if (match) {
        frames.push({
          function: match[1],
          file: match[2],
          line: parseInt(match[3], 10),
          column: parseInt(match[4], 10)
        });
      }
    }

    return frames;
  }

  private identifyRootCause(failure: TestFailure, category: ErrorCategory, patterns: ErrorPattern[]): string | undefined {
    // Common root cause patterns
    const rootCausePatterns = [
      { pattern: /cannot find module ['"](.+?)['"]/, cause: 'Missing dependency: $1' },
      { pattern: /port (\d+) is already in use/, cause: 'Port $1 conflict' },
      { pattern: /econnrefused.*?(\d+\.\d+\.\d+\.\d+):(\d+)/, cause: 'Service at $1:$2 is not running' },
      { pattern: /timeout.*?(\d+)ms/, cause: 'Operation exceeded $1ms timeout' },
      { pattern: /permission denied.*?['"](.+?)['"]/, cause: 'Insufficient permissions for: $1' },
      { pattern: /out of memory/, cause: 'Memory exhaustion' },
      { pattern: /maximum call stack/, cause: 'Stack overflow - likely infinite recursion' }
    ];

    const errorMessage = failure.error.message;
    for (const { pattern, cause } of rootCausePatterns) {
      const match = errorMessage.match(pattern);
      if (match) {
        return cause.replace(/\$(\d+)/g, (_, index) => match[parseInt(index, 10)]);
      }
    }

    // Category-specific root causes
    switch (category) {
      case ErrorCategory.SYNTAX:
        return 'Syntax error in source code';
      case ErrorCategory.ASSERTION:
        if (failure.error.expected && failure.error.actual) {
          return `Expected value doesn't match actual value`;
        }
        return 'Test assertion failed';
      case ErrorCategory.TIMEOUT:
        return 'Operation took too long to complete';
      case ErrorCategory.NETWORK:
        return 'Network connectivity or service availability issue';
      case ErrorCategory.DEPENDENCY:
        return 'Missing or incompatible dependency';
      default:
        return undefined;
    }
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple similarity based on common words
    const words1 = new Set(str1.split(/\W+/));
    const words2 = new Set(str2.split(/\W+/));
    
    let common = 0;
    for (const word of words1) {
      if (words2.has(word)) common++;
    }

    const total = Math.max(words1.size, words2.size);
    return total > 0 ? common / total : 0;
  }

  private addPattern(pattern: ErrorPattern): void {
    this.errorDatabase.set(pattern.pattern, pattern);
  }

  // Public methods for managing the error database
  learnFromError(failure: TestFailure, resolution?: string): void {
    const analysis = this.analyzeError(failure);
    
    // Update pattern frequencies
    for (const pattern of analysis.patterns) {
      pattern.frequency++;
    }

    // If a resolution was provided, create a new suggestion
    if (resolution) {
      const suggestions = this.suggestionTemplates.get(analysis.category) || [];
      suggestions.push({
        type: 'code',
        description: resolution,
        confidence: 0.7,
        priority: 5,
        explanation: 'Previously successful resolution'
      });
      this.suggestionTemplates.set(analysis.category, suggestions);
    }
  }

  getErrorStatistics(): {
    totalErrors: number;
    byCategory: Record<ErrorCategory, number>;
    topPatterns: ErrorPattern[];
  } {
    const byCategory: Record<ErrorCategory, number> = {} as any;
    let totalErrors = 0;

    for (const [, pattern] of this.errorDatabase) {
      if (!byCategory[pattern.type]) {
        byCategory[pattern.type] = 0;
      }
      byCategory[pattern.type] += pattern.frequency;
      totalErrors += pattern.frequency;
    }

    const topPatterns = Array.from(this.errorDatabase.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    return {
      totalErrors,
      byCategory,
      topPatterns
    };
  }

  clearDatabase(): void {
    for (const [, pattern] of this.errorDatabase) {
      pattern.frequency = 0;
      pattern.examples = [];
    }
  }
}

// Helper class for grouping related failures
export class FailureGrouper {
  groupFailures(failures: TestFailure[]): Map<string, TestFailure[]> {
    const groups = new Map<string, TestFailure[]>();

    for (const failure of failures) {
      const key = this.generateGroupKey(failure);
      const group = groups.get(key) || [];
      group.push(failure);
      groups.set(key, group);
    }

    return groups;
  }

  private generateGroupKey(failure: TestFailure): string {
    // Group by error message pattern
    const message = failure.error.message;
    
    // Remove specific values to create a pattern
    const pattern = message
      .replace(/['"][^'"]+['"]/g, '""')  // Replace quoted strings
      .replace(/\d+/g, 'N')              // Replace numbers
      .replace(/0x[0-9a-f]+/gi, '0xHEX') // Replace hex values
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID') // UUIDs
      .trim();

    return pattern;
  }

  findCommonCause(group: TestFailure[]): string | undefined {
    if (group.length === 0) return undefined;

    // Find common file
    const files = group.map(f => f.file).filter(Boolean);
    const fileFreq = this.getFrequencyMap(files);
    const commonFile = this.getMostFrequent(fileFreq);

    // Find common error pattern
    const firstError = group[0].error.message;
    
    if (commonFile && fileFreq.get(commonFile) === group.length) {
      return `All failures in file: ${commonFile}`;
    }

    if (group.every(f => f.error.message === firstError)) {
      return `Identical error: ${firstError}`;
    }

    return undefined;
  }

  private getFrequencyMap<T>(items: T[]): Map<T, number> {
    const freq = new Map<T, number>();
    for (const item of items) {
      freq.set(item, (freq.get(item) || 0) + 1);
    }
    return freq;
  }

  private getMostFrequent<T>(freq: Map<T, number>): T | undefined {
    let maxCount = 0;
    let mostFrequent: T | undefined;

    for (const [item, count] of freq) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = item;
      }
    }

    return mostFrequent;
  }
}