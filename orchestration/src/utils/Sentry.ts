import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

// Initialize Sentry
export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.log('⚠️ Sentry DSN not configured, skipping error tracking setup');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    
    // Performance monitoring
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    
    // Profiling
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
    
    // Server name
    serverName: process.env.SERVER_NAME || require('os').hostname(),
    
    // Release tracking
    release: process.env.npm_package_version || '1.0.0',
    
    // Integrations
    integrations: [
      // Enable HTTP instrumentation
      new Sentry.Integrations.Http({ tracing: true }),
      
      // Enable Express instrumentation
      new Sentry.Integrations.Express({ app: undefined }),
      
      // Enable database instrumentation
      new Sentry.Integrations.Prisma(),
      
      // Enable Redis instrumentation if available
      ...(process.env.REDIS_URL ? [new Sentry.Integrations.Redis()] : []),
      
      // Enable profiling
      new ProfilingIntegration(),
    ],
    
    // Before send hook to filter sensitive data
    beforeSend(event) {
      // Remove sensitive data from event
      if (event.exception) {
        event.exception.values?.forEach(exception => {
          if (exception.stacktrace?.frames) {
            exception.stacktrace.frames.forEach(frame => {
              if (frame.vars) {
                // Remove sensitive variables
                delete frame.vars.password;
                delete frame.vars.token;
                delete frame.vars.secret;
                delete frame.vars.key;
                delete frame.vars.apiKey;
                delete frame.vars.claudeApiKey;
                delete frame.vars.jwtSecret;
              }
            });
          }
        });
      }
      
      // Remove sensitive request data
      if (event.request) {
        if (event.request.data && typeof event.request.data === 'object') {
          const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey', 'claudeApiKey'];
          sensitiveFields.forEach(field => {
            if (field in event.request.data) {
              event.request.data[field] = '[Filtered]';
            }
          });
        }
        
        // Remove authorization header
        if (event.request.headers?.authorization) {
          event.request.headers.authorization = '[Filtered]';
        }
      }
      
      return event;
    },
    
    // Before breadcrumb hook
    beforeBreadcrumb(breadcrumb) {
      // Filter sensitive data from breadcrumbs
      if (breadcrumb.data) {
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey'];
        sensitiveFields.forEach(field => {
          if (field in breadcrumb.data) {
            breadcrumb.data[field] = '[Filtered]';
          }
        });
      }
      
      return breadcrumb;
    },
    
    // Ignore certain errors
    ignoreErrors: [
      // Ignore validation errors (they're expected)
      'ValidationError',
      'ZodError',
      
      // Ignore rate limit errors
      'TooManyRequestsError',
      
      // Ignore client disconnect errors
      'ECONNRESET',
      'EPIPE',
      'ECONNABORTED',
    ],
  });

  console.log('✅ Sentry error tracking initialized');
}

// Custom error types for better categorization
export class AntonError extends Error {
  public code: string;
  public statusCode: number;
  public context: Record<string, any>;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    statusCode: number = 500,
    context: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'AntonError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
  }
}

export class ValidationError extends AntonError {
  constructor(message: string, field?: string, value?: any) {
    super(message, 'VALIDATION_ERROR', 400, { field, value });
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AntonError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AntonError {
  constructor(message: string = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AntonError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 'NOT_FOUND_ERROR', 404, { resource, id });
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AntonError {
  constructor(limit: number, window: string) {
    super(`Rate limit exceeded: ${limit} requests per ${window}`, 'RATE_LIMIT_ERROR', 429, { limit, window });
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AntonError {
  constructor(service: string, message: string, originalError?: Error) {
    super(`External service error (${service}): ${message}`, 'EXTERNAL_SERVICE_ERROR', 502, { service, originalError });
    this.name = 'ExternalServiceError';
  }
}

// Helper functions for Sentry integration
export function captureError(error: Error, context: Record<string, any> = {}) {
  Sentry.withScope(scope => {
    // Add context to scope
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value);
    });
    
    // Set tags for easier filtering
    if (error instanceof AntonError) {
      scope.setTag('error.code', error.code);
      scope.setTag('error.statusCode', error.statusCode);
    }
    
    scope.setTag('service', 'orchestration');
    
    Sentry.captureException(error);
  });
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context: Record<string, any> = {}) {
  Sentry.withScope(scope => {
    // Add context to scope
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value);
    });
    
    scope.setTag('service', 'orchestration');
    
    Sentry.captureMessage(message, level);
  });
}

export function setUserContext(user: { id: string; email?: string; username?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

export function clearUserContext() {
  Sentry.setUser(null);
}

export function addBreadcrumb(message: string, category: string, data: Record<string, any> = {}) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    timestamp: Date.now() / 1000,
  });
}

export function startTransaction(name: string, op: string) {
  return Sentry.startTransaction({
    name,
    op,
  });
}

// Express error handler middleware
export function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Only send errors with 500+ status codes to Sentry
      return error.status >= 500;
    },
  });
}

// Express request handler middleware
export function sentryRequestHandler() {
  return Sentry.Handlers.requestHandler({
    user: ['id', 'email', 'username'],
    request: ['method', 'url', 'headers'],
    transaction: 'methodPath',
  });
}

export { Sentry };