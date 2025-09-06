import client from 'prom-client';
import os from 'os';

// Create a Registry to register the metrics
export const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'anton-orchestration',
  version: process.env.npm_package_version || '1.0.0',
  node_version: process.version,
  hostname: os.hostname(),
});

// Collect default metrics (CPU, memory, GC, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'anton_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  eventLoopMonitoringPrecision: 100,
});

// Custom metrics for Anton
export const httpRequestsTotal = new client.Counter({
  name: 'anton_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new client.Histogram({
  name: 'anton_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const websocketConnectionsActive = new client.Gauge({
  name: 'anton_websocket_connections_active',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

export const websocketMessagesTotal = new client.Counter({
  name: 'anton_websocket_messages_total',
  help: 'Total number of WebSocket messages sent/received',
  labelNames: ['type', 'direction'], // type: execution, review, etc. direction: sent/received
  registers: [register],
});

export const projectExecutionsTotal = new client.Counter({
  name: 'anton_project_executions_total',
  help: 'Total number of project executions started',
  labelNames: ['status'], // status: started, completed, failed
  registers: [register],
});

export const projectExecutionDuration = new client.Histogram({
  name: 'anton_project_execution_duration_seconds',
  help: 'Project execution duration in seconds',
  labelNames: ['status', 'project_name'],
  buckets: [1, 10, 30, 60, 300, 600, 1800, 3600, 7200], // 1s to 2h
  registers: [register],
});

export const nodeExecutionsTotal = new client.Counter({
  name: 'anton_node_executions_total',
  help: 'Total number of node executions',
  labelNames: ['node_type', 'status'], // node_type: setup, execution, review, etc.
  registers: [register],
});

export const nodeExecutionDuration = new client.Histogram({
  name: 'anton_node_execution_duration_seconds',
  help: 'Node execution duration in seconds',
  labelNames: ['node_type', 'status'],
  buckets: [1, 5, 10, 30, 60, 300, 900], // 1s to 15m
  registers: [register],
});

export const claudeApiRequestsTotal = new client.Counter({
  name: 'anton_claude_api_requests_total',
  help: 'Total number of Claude API requests',
  labelNames: ['model', 'status'], // model: claude-3-opus, etc. status: success, error
  registers: [register],
});

export const claudeApiRequestDuration = new client.Histogram({
  name: 'anton_claude_api_request_duration_seconds',
  help: 'Claude API request duration in seconds',
  labelNames: ['model', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60], // 0.1s to 1m
  registers: [register],
});

export const claudeTokensUsed = new client.Counter({
  name: 'anton_claude_tokens_used_total',
  help: 'Total number of Claude tokens used',
  labelNames: ['model', 'type'], // type: input, output
  registers: [register],
});

export const databaseConnectionsActive = new client.Gauge({
  name: 'anton_database_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

export const databaseQueriesTotal = new client.Counter({
  name: 'anton_database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'], // operation: select, insert, update, delete
  registers: [register],
});

export const databaseQueryDuration = new client.Histogram({
  name: 'anton_database_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const redisConnectionsActive = new client.Gauge({
  name: 'anton_redis_connections_active',
  help: 'Number of active Redis connections',
  registers: [register],
});

export const redisCacheHitsTotal = new client.Counter({
  name: 'anton_redis_cache_hits_total',
  help: 'Total number of Redis cache hits',
  labelNames: ['cache_key_prefix'],
  registers: [register],
});

export const redisCacheMissesTotal = new client.Counter({
  name: 'anton_redis_cache_misses_total',
  help: 'Total number of Redis cache misses',
  labelNames: ['cache_key_prefix'],
  registers: [register],
});

export const queueJobsTotal = new client.Counter({
  name: 'anton_queue_jobs_total',
  help: 'Total number of queue jobs processed',
  labelNames: ['queue_name', 'status'], // status: completed, failed, delayed, active
  registers: [register],
});

export const queueJobDuration = new client.Histogram({
  name: 'anton_queue_job_duration_seconds',
  help: 'Queue job processing duration in seconds',
  labelNames: ['queue_name', 'job_type'],
  buckets: [0.1, 1, 10, 30, 60, 300, 900], // 0.1s to 15m
  registers: [register],
});

export const queueJobsWaiting = new client.Gauge({
  name: 'anton_queue_jobs_waiting',
  help: 'Number of jobs waiting in queues',
  labelNames: ['queue_name'],
  registers: [register],
});

export const errorTotal = new client.Counter({
  name: 'anton_errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'service'], // error_type: validation, database, api, etc.
  registers: [register],
});

export const activeUsersTotal = new client.Gauge({
  name: 'anton_active_users_total',
  help: 'Number of active users',
  registers: [register],
});

export const rateLimitHitsTotal = new client.Counter({
  name: 'anton_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['endpoint', 'user_id'],
  registers: [register],
});

// Helper function to track HTTP request metrics
export function trackHttpRequest(method: string, route: string) {
  const start = Date.now();
  
  return (statusCode: number) => {
    const duration = (Date.now() - start) / 1000;
    
    httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode.toString(),
    });
    
    httpRequestDuration.observe(
      {
        method,
        route,
        status_code: statusCode.toString(),
      },
      duration
    );
  };
}

// Helper function to track project execution metrics
export function trackProjectExecution(projectName: string) {
  const start = Date.now();
  projectExecutionsTotal.inc({ status: 'started' });
  
  return (status: 'completed' | 'failed') => {
    const duration = (Date.now() - start) / 1000;
    
    projectExecutionsTotal.inc({ status });
    projectExecutionDuration.observe(
      {
        status,
        project_name: projectName,
      },
      duration
    );
  };
}

// Helper function to track node execution metrics
export function trackNodeExecution(nodeType: string) {
  const start = Date.now();
  
  return (status: 'completed' | 'failed' | 'error') => {
    const duration = (Date.now() - start) / 1000;
    
    nodeExecutionsTotal.inc({
      node_type: nodeType,
      status,
    });
    
    nodeExecutionDuration.observe(
      {
        node_type: nodeType,
        status,
      },
      duration
    );
  };
}

// Helper function to track Claude API requests
export function trackClaudeApiRequest(model: string) {
  const start = Date.now();
  
  return (status: 'success' | 'error', inputTokens?: number, outputTokens?: number) => {
    const duration = (Date.now() - start) / 1000;
    
    claudeApiRequestsTotal.inc({
      model,
      status,
    });
    
    claudeApiRequestDuration.observe(
      {
        model,
        status,
      },
      duration
    );
    
    if (inputTokens) {
      claudeTokensUsed.inc({ model, type: 'input' }, inputTokens);
    }
    
    if (outputTokens) {
      claudeTokensUsed.inc({ model, type: 'output' }, outputTokens);
    }
  };
}

// Helper function to track database queries
export function trackDatabaseQuery(operation: string, table: string) {
  const start = Date.now();
  
  return (status: 'success' | 'error') => {
    const duration = (Date.now() - start) / 1000;
    
    databaseQueriesTotal.inc({
      operation,
      table,
      status,
    });
    
    databaseQueryDuration.observe(
      {
        operation,
        table,
      },
      duration
    );
  };
}

// Export the register for the /metrics endpoint
export default register;