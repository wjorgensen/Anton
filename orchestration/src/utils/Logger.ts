import winston from 'winston';
import path from 'path';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(logColors);

// Create log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const {
      timestamp,
      level,
      message,
      service = 'orchestration',
      requestId,
      userId,
      executionId,
      nodeId,
      duration,
      statusCode,
      error,
      ...meta
    } = info;

    const logObject = {
      timestamp,
      level,
      service,
      message,
      ...(requestId && { requestId }),
      ...(userId && { userId }),
      ...(executionId && { executionId }),
      ...(nodeId && { nodeId }),
      ...(duration && { duration: `${duration}ms` }),
      ...(statusCode && { statusCode }),
      ...(error && { error: error.stack || error.message || error }),
      ...(Object.keys(meta).length > 0 && { meta }),
    };

    return JSON.stringify(logObject);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const {
      timestamp,
      level,
      message,
      service = 'orchestration',
      requestId,
      userId,
      executionId,
      nodeId,
      duration,
      statusCode,
      error,
    } = info;

    let logMessage = `${timestamp} [${service.toUpperCase()}] ${level}: ${message}`;

    if (requestId) logMessage += ` [requestId: ${requestId}]`;
    if (userId) logMessage += ` [userId: ${userId}]`;
    if (executionId) logMessage += ` [executionId: ${executionId}]`;
    if (nodeId) logMessage += ` [nodeId: ${nodeId}]`;
    if (duration) logMessage += ` [${duration}ms]`;
    if (statusCode) logMessage += ` [${statusCode}]`;
    if (error) logMessage += `\n${error.stack || error.message || error}`;

    return logMessage;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
  levels: logLevels,
  format: logFormat,
  defaultMeta: { service: 'orchestration' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'development' ? consoleFormat : logFormat,
    }),
    
    // File transports
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || './logs', 'error.log'),
      level: 'error',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 5,
      tailable: true,
    }),
    
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || './logs', 'combined.log'),
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 10,
      tailable: true,
    }),
    
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || './logs', 'http.log'),
      level: 'http',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 5,
      tailable: true,
    }),
  ],
});

// Create structured logging methods
export class Logger {
  static info(message: string, meta: Record<string, any> = {}) {
    logger.info(message, meta);
  }

  static warn(message: string, meta: Record<string, any> = {}) {
    logger.warn(message, meta);
  }

  static error(message: string, error?: Error | string, meta: Record<string, any> = {}) {
    logger.error(message, { 
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      ...meta 
    });
  }

  static debug(message: string, meta: Record<string, any> = {}) {
    logger.debug(message, meta);
  }

  static http(message: string, meta: Record<string, any> = {}) {
    logger.http(message, meta);
  }

  // Specific logging methods for Anton operations
  static projectCreated(projectName: string, userId?: string, meta: Record<string, any> = {}) {
    logger.info('Project created', { 
      projectName, 
      userId, 
      operation: 'project_created',
      ...meta 
    });
  }

  static executionStarted(executionId: string, projectName: string, userId?: string) {
    logger.info('Execution started', { 
      executionId, 
      projectName, 
      userId, 
      operation: 'execution_started' 
    });
  }

  static executionCompleted(executionId: string, projectName: string, duration: number, status: string) {
    logger.info('Execution completed', { 
      executionId, 
      projectName, 
      duration, 
      status, 
      operation: 'execution_completed' 
    });
  }

  static nodeExecutionStarted(nodeId: string, executionId: string, nodeType: string) {
    logger.info('Node execution started', { 
      nodeId, 
      executionId, 
      nodeType, 
      operation: 'node_execution_started' 
    });
  }

  static nodeExecutionCompleted(nodeId: string, executionId: string, nodeType: string, duration: number, status: string) {
    logger.info('Node execution completed', { 
      nodeId, 
      executionId, 
      nodeType, 
      duration, 
      status, 
      operation: 'node_execution_completed' 
    });
  }

  static claudeApiCall(model: string, inputTokens?: number, outputTokens?: number, duration?: number) {
    logger.info('Claude API call', { 
      model, 
      inputTokens, 
      outputTokens, 
      duration, 
      operation: 'claude_api_call' 
    });
  }

  static databaseQuery(operation: string, table: string, duration: number, status: string) {
    logger.debug('Database query', { 
      operation, 
      table, 
      duration, 
      status, 
      component: 'database' 
    });
  }

  static websocketConnection(event: string, connectionId?: string, userId?: string) {
    logger.http('WebSocket event', { 
      event, 
      connectionId, 
      userId, 
      component: 'websocket' 
    });
  }

  static securityEvent(event: string, userId?: string, ip?: string, details: Record<string, any> = {}) {
    logger.warn('Security event', { 
      event, 
      userId, 
      ip, 
      component: 'security',
      ...details 
    });
  }

  static rateLimitHit(endpoint: string, userId?: string, ip?: string) {
    logger.warn('Rate limit hit', { 
      endpoint, 
      userId, 
      ip, 
      component: 'rate_limit' 
    });
  }

  static performanceWarning(operation: string, duration: number, threshold: number, meta: Record<string, any> = {}) {
    logger.warn('Performance warning', { 
      operation, 
      duration, 
      threshold, 
      component: 'performance',
      ...meta 
    });
  }
}

// Request logging middleware
export function requestLogger() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userId = req.user?.id;

    // Add request ID to request object
    req.requestId = requestId;

    // Log request start
    Logger.http('HTTP Request', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.headers['user-agent'],
      userId,
      ip: req.ip || req.connection.remoteAddress,
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(chunk: any, encoding: any) {
      const duration = Date.now() - start;
      
      Logger.http('HTTP Response', {
        requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        userId,
        ip: req.ip || req.connection.remoteAddress,
      });

      // Log slow requests
      if (duration > 5000) { // 5 seconds
        Logger.performanceWarning('Slow HTTP request', duration, 5000, {
          requestId,
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
        });
      }

      originalEnd.call(res, chunk, encoding);
    };

    next();
  };
}

export default logger;