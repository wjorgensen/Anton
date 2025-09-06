export enum ErrorCode {
  FLOW_NOT_FOUND = 'FLOW_NOT_FOUND',
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  INVALID_FLOW = 'INVALID_FLOW',
  SPAWN_FAILED = 'SPAWN_FAILED',
  EXECUTION_TIMEOUT = 'EXECUTION_TIMEOUT',
  HOOK_FAILED = 'HOOK_FAILED',
  OUTPUT_VALIDATION_FAILED = 'OUTPUT_VALIDATION_FAILED',
  DEPENDENCY_FAILED = 'DEPENDENCY_FAILED',
  REVIEW_REJECTED = 'REVIEW_REJECTED',
  RESOURCE_LIMIT = 'RESOURCE_LIMIT',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class OrchestrationError extends Error {
  public code: ErrorCode;
  public details: any;
  public recoverable: boolean;
  public nodeId?: string;
  public flowId?: string;
  public timestamp: Date;

  constructor(
    code: ErrorCode,
    message: string,
    details: any = {},
    recoverable: boolean = false
  ) {
    super(message);
    this.name = 'OrchestrationError';
    this.code = code;
    this.details = details;
    this.recoverable = recoverable;
    this.timestamp = new Date();
  }

  static fromError(error: Error, code?: ErrorCode): OrchestrationError {
    if (error instanceof OrchestrationError) {
      return error;
    }

    return new OrchestrationError(
      code || ErrorCode.UNKNOWN_ERROR,
      error.message,
      { originalError: error.name, stack: error.stack },
      false
    );
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      recoverable: this.recoverable,
      nodeId: this.nodeId,
      flowId: this.flowId,
      timestamp: this.timestamp
    };
  }
}

export class ErrorHandler {
  private errorHandlers: Map<ErrorCode, (error: OrchestrationError) => Promise<void>> = new Map();
  private errorLog: OrchestrationError[] = [];
  private maxLogSize: number = 1000;

  constructor() {
    this.setupDefaultHandlers();
  }

  private setupDefaultHandlers(): void {
    this.registerHandler(ErrorCode.EXECUTION_TIMEOUT, async (error) => {
      console.error(`Execution timeout: ${error.message}`);
    });

    this.registerHandler(ErrorCode.SPAWN_FAILED, async (error) => {
      console.error(`Failed to spawn agent: ${error.message}`);
    });

    this.registerHandler(ErrorCode.HOOK_FAILED, async (error) => {
      console.error(`Hook execution failed: ${error.message}`);
    });

    this.registerHandler(ErrorCode.DEPENDENCY_FAILED, async (error) => {
      console.error(`Dependency failed: ${error.message}`);
    });

    this.registerHandler(ErrorCode.RESOURCE_LIMIT, async (error) => {
      console.error(`Resource limit exceeded: ${error.message}`);
    });
  }

  registerHandler(code: ErrorCode, handler: (error: OrchestrationError) => Promise<void>): void {
    this.errorHandlers.set(code, handler);
  }

  async handleError(error: Error | OrchestrationError, context?: any): Promise<void> {
    const orchError = error instanceof OrchestrationError 
      ? error 
      : OrchestrationError.fromError(error);

    if (context) {
      orchError.nodeId = context.nodeId;
      orchError.flowId = context.flowId;
      Object.assign(orchError.details, context);
    }

    this.logError(orchError);

    const handler = this.errorHandlers.get(orchError.code);
    if (handler) {
      try {
        await handler(orchError);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    }

    if (!orchError.recoverable) {
      throw orchError;
    }
  }

  private logError(error: OrchestrationError): void {
    this.errorLog.push(error);

    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    console.error(`[${error.code}] ${error.message}`, error.details);
  }

  getErrorLog(filter?: { code?: ErrorCode; nodeId?: string; flowId?: string }): OrchestrationError[] {
    if (!filter) {
      return [...this.errorLog];
    }

    return this.errorLog.filter(error => {
      if (filter.code && error.code !== filter.code) return false;
      if (filter.nodeId && error.nodeId !== filter.nodeId) return false;
      if (filter.flowId && error.flowId !== filter.flowId) return false;
      return true;
    });
  }

  clearErrorLog(): void {
    this.errorLog = [];
  }

  analyzeErrors(): {
    totalErrors: number;
    byCode: Record<string, number>;
    recoverableRate: number;
    recentErrors: OrchestrationError[];
  } {
    const byCode: Record<string, number> = {};
    let recoverableCount = 0;

    for (const error of this.errorLog) {
      byCode[error.code] = (byCode[error.code] || 0) + 1;
      if (error.recoverable) {
        recoverableCount++;
      }
    }

    return {
      totalErrors: this.errorLog.length,
      byCode,
      recoverableRate: this.errorLog.length > 0 
        ? recoverableCount / this.errorLog.length 
        : 0,
      recentErrors: this.errorLog.slice(-10)
    };
  }

  static isRetriableError(error: Error | OrchestrationError): boolean {
    const retriableErrors = [
      ErrorCode.EXECUTION_TIMEOUT,
      ErrorCode.SPAWN_FAILED,
      ErrorCode.HOOK_FAILED,
      ErrorCode.NETWORK_ERROR
    ];

    if (error instanceof OrchestrationError) {
      return retriableErrors.includes(error.code) && error.recoverable;
    }

    const retriableMessages = [
      'timeout',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'rate limit',
      'throttle',
      'temporary failure'
    ];

    const errorMessage = error.message.toLowerCase();
    return retriableMessages.some(msg => errorMessage.includes(msg.toLowerCase()));
  }

  static categorizeError(error: Error): ErrorCode {
    const message = error.message.toLowerCase();

    if (message.includes('timeout')) {
      return ErrorCode.EXECUTION_TIMEOUT;
    }
    if (message.includes('spawn') || message.includes('command not found')) {
      return ErrorCode.SPAWN_FAILED;
    }
    if (message.includes('circular') || message.includes('cycle')) {
      return ErrorCode.CIRCULAR_DEPENDENCY;
    }
    if (message.includes('not found')) {
      return ErrorCode.NODE_NOT_FOUND;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCode.OUTPUT_VALIDATION_FAILED;
    }
    if (message.includes('permission') || message.includes('denied')) {
      return ErrorCode.PERMISSION_DENIED;
    }
    if (message.includes('auth')) {
      return ErrorCode.AUTHENTICATION_FAILED;
    }
    if (message.includes('network') || message.includes('connection')) {
      return ErrorCode.NETWORK_ERROR;
    }
    if (message.includes('resource') || message.includes('limit')) {
      return ErrorCode.RESOURCE_LIMIT;
    }

    return ErrorCode.UNKNOWN_ERROR;
  }
}

export class RecoveryManager {
  private recoveryStrategies: Map<ErrorCode, (error: OrchestrationError) => Promise<any>> = new Map();

  constructor() {
    this.setupDefaultStrategies();
  }

  private setupDefaultStrategies(): void {
    this.recoveryStrategies.set(ErrorCode.EXECUTION_TIMEOUT, async (error) => {
      return {
        action: 'retry',
        adjustments: {
          timeout: (error.details.timeout || 60000) * 2
        }
      };
    });

    this.recoveryStrategies.set(ErrorCode.SPAWN_FAILED, async (error) => {
      return {
        action: 'retry',
        adjustments: {
          delay: 5000
        }
      };
    });

    this.recoveryStrategies.set(ErrorCode.RESOURCE_LIMIT, async (error) => {
      return {
        action: 'queue',
        adjustments: {
          priority: -1,
          delay: 30000
        }
      };
    });

    this.recoveryStrategies.set(ErrorCode.DEPENDENCY_FAILED, async (error) => {
      return {
        action: 'skip',
        reason: 'Dependency failure'
      };
    });

    this.recoveryStrategies.set(ErrorCode.REVIEW_REJECTED, async (error) => {
      return {
        action: 'abort',
        reason: 'Review rejected by user'
      };
    });
  }

  async attemptRecovery(error: OrchestrationError): Promise<{
    action: 'retry' | 'skip' | 'abort' | 'queue';
    adjustments?: any;
    reason?: string;
  }> {
    const strategy = this.recoveryStrategies.get(error.code);
    
    if (!strategy) {
      return {
        action: error.recoverable ? 'retry' : 'abort',
        reason: 'No recovery strategy defined'
      };
    }

    try {
      return await strategy(error);
    } catch (strategyError) {
      console.error('Recovery strategy failed:', strategyError);
      return {
        action: 'abort',
        reason: 'Recovery strategy failed'
      };
    }
  }

  registerStrategy(code: ErrorCode, strategy: (error: OrchestrationError) => Promise<any>): void {
    this.recoveryStrategies.set(code, strategy);
  }

  static createContextFromError(error: OrchestrationError): any {
    return {
      errorCode: error.code,
      errorMessage: error.message,
      previousAttempt: error.details.attempt || 1,
      suggestions: [
        'Check the error details for more information',
        'Review the logs for the specific node',
        'Consider adjusting timeout or resource limits'
      ],
      timestamp: error.timestamp
    };
  }
}