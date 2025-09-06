import { RetryStrategy } from '../../types';

export class RetryManager {
  private strategy: RetryStrategy;
  private fibonacciCache: Map<number, number> = new Map([[0, 0], [1, 1]]);

  constructor(strategy: RetryStrategy) {
    this.strategy = strategy;
  }

  getDelay(attempt: number): number {
    if (attempt >= this.strategy.maxAttempts) {
      throw new Error(`Maximum retry attempts (${this.strategy.maxAttempts}) exceeded`);
    }

    let delay: number;

    switch (this.strategy.backoff) {
      case 'linear':
        delay = this.strategy.initialDelay * attempt;
        break;
      
      case 'exponential':
        delay = this.strategy.initialDelay * Math.pow(2, attempt - 1);
        break;
      
      case 'fibonacci':
        delay = this.strategy.initialDelay * this.fibonacci(attempt);
        break;
      
      default:
        delay = this.strategy.initialDelay;
    }

    delay = Math.min(delay, this.strategy.maxDelay);
    
    const jitter = Math.random() * 0.2 * delay;
    delay = delay + jitter - (jitter / 2);

    return Math.round(delay);
  }

  private fibonacci(n: number): number {
    if (this.fibonacciCache.has(n)) {
      return this.fibonacciCache.get(n)!;
    }

    const result = this.fibonacci(n - 1) + this.fibonacci(n - 2);
    this.fibonacciCache.set(n, result);
    return result;
  }

  shouldRetry(attempt: number, error?: Error): boolean {
    if (attempt >= this.strategy.maxAttempts) {
      return false;
    }

    if (error && this.isRetriableError(error)) {
      return true;
    }

    return attempt < this.strategy.maxAttempts;
  }

  private isRetriableError(error: Error): boolean {
    const nonRetriableErrors = [
      'SyntaxError',
      'ReferenceError',
      'TypeError',
      'ValidationError'
    ];

    if (nonRetriableErrors.includes(error.name)) {
      return false;
    }

    const retriableMessages = [
      'timeout',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'rate limit',
      'throttle'
    ];

    const errorMessage = error.message.toLowerCase();
    return retriableMessages.some(msg => errorMessage.includes(msg.toLowerCase()));
  }

  enhanceContext(context: any, error: Error, attempt: number): any {
    const enhanced = { ...context };

    if (this.strategy.contextEnhancement.includeErrors) {
      enhanced.previousErrors = enhanced.previousErrors || [];
      enhanced.previousErrors.push({
        attempt,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    if (this.strategy.contextEnhancement.includeStackTrace && error.stack) {
      enhanced.lastErrorStack = error.stack;
    }

    if (this.strategy.contextEnhancement.includeSuggestions) {
      enhanced.suggestions = this.generateSuggestions(error);
    }

    if (this.strategy.contextEnhancement.includeRelatedCode) {
      enhanced.relatedCode = this.extractRelatedCode(error);
    }

    enhanced.retryAttempt = attempt + 1;
    enhanced.maxAttempts = this.strategy.maxAttempts;

    return enhanced;
  }

  private generateSuggestions(error: Error): string[] {
    const suggestions: string[] = [];
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('timeout')) {
      suggestions.push('Consider increasing the timeout value');
      suggestions.push('Check if the target service is responding');
    }

    if (errorMessage.includes('connection')) {
      suggestions.push('Verify network connectivity');
      suggestions.push('Check if the service endpoint is correct');
    }

    if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
      suggestions.push('Check file or resource permissions');
      suggestions.push('Verify authentication credentials');
    }

    if (errorMessage.includes('not found')) {
      suggestions.push('Verify the resource path or identifier');
      suggestions.push('Check if the resource was created successfully');
    }

    if (errorMessage.includes('memory')) {
      suggestions.push('Consider increasing memory limits');
      suggestions.push('Check for memory leaks in the code');
    }

    return suggestions;
  }

  private extractRelatedCode(error: Error): string | null {
    if (!error.stack) return null;

    const stackLines = error.stack.split('\n');
    const codeLocation = stackLines.find(line => 
      line.includes('.ts:') || line.includes('.js:')
    );

    if (codeLocation) {
      const match = codeLocation.match(/\((.*):(\d+):(\d+)\)/);
      if (match) {
        return `File: ${match[1]}, Line: ${match[2]}, Column: ${match[3]}`;
      }
    }

    return null;
  }

  reset(): void {
    this.fibonacciCache.clear();
    this.fibonacciCache.set(0, 0);
    this.fibonacciCache.set(1, 1);
  }
}