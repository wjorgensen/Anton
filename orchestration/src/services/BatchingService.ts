import { Logger } from '../utils/Logger';
import { cache } from './CacheService';

interface BatchRequest {
  id: string;
  operation: string;
  payload: any;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timestamp: number;
  userId?: string;
}

interface BatchConfig {
  maxBatchSize: number;
  maxWaitTime: number; // milliseconds
  enabled: boolean;
}

export class BatchingService {
  private batches: Map<string, BatchRequest[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private config: Record<string, BatchConfig> = {};

  constructor() {
    // Configure batching for different operation types
    this.config = {
      'database:select': {
        maxBatchSize: 10,
        maxWaitTime: 50, // 50ms
        enabled: true,
      },
      'database:insert': {
        maxBatchSize: 20,
        maxWaitTime: 100, // 100ms
        enabled: true,
      },
      'database:update': {
        maxBatchSize: 15,
        maxWaitTime: 75, // 75ms
        enabled: true,
      },
      'api:external': {
        maxBatchSize: 5,
        maxWaitTime: 200, // 200ms
        enabled: true,
      },
      'claude:api': {
        maxBatchSize: 3,
        maxWaitTime: 500, // 500ms
        enabled: true,
      },
      'cache:get': {
        maxBatchSize: 50,
        maxWaitTime: 25, // 25ms
        enabled: true,
      },
      'cache:set': {
        maxBatchSize: 30,
        maxWaitTime: 50, // 50ms
        enabled: true,
      },
    };
  }

  /**
   * Add a request to a batch
   */
  async batchRequest<T>(
    operation: string,
    payload: any,
    userId?: string
  ): Promise<T> {
    const config = this.config[operation];
    
    // If batching is disabled for this operation, execute immediately
    if (!config || !config.enabled) {
      return this.executeOperation(operation, [{ payload, userId }])[0];
    }

    return new Promise((resolve, reject) => {
      const request: BatchRequest = {
        id: this.generateRequestId(),
        operation,
        payload,
        resolve,
        reject,
        timestamp: Date.now(),
        userId,
      };

      // Get or create batch for this operation
      if (!this.batches.has(operation)) {
        this.batches.set(operation, []);
      }

      const batch = this.batches.get(operation)!;
      batch.push(request);

      // Check if we should execute the batch immediately
      if (batch.length >= config.maxBatchSize) {
        this.executeBatch(operation);
      } else if (batch.length === 1) {
        // Start timer for the first request in the batch
        const timer = setTimeout(() => {
          this.executeBatch(operation);
        }, config.maxWaitTime);
        
        this.timers.set(operation, timer);
      }
    });
  }

  /**
   * Execute a batch of requests
   */
  private async executeBatch(operation: string): Promise<void> {
    const batch = this.batches.get(operation);
    if (!batch || batch.length === 0) {
      return;
    }

    // Clear the batch and timer
    this.batches.set(operation, []);
    const timer = this.timers.get(operation);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(operation);
    }

    const startTime = Date.now();
    
    try {
      Logger.debug('Executing batch', {
        operation,
        batchSize: batch.length,
        requests: batch.map(r => r.id),
      });

      // Execute all requests in the batch
      const results = await this.executeOperation(operation, batch.map(r => ({
        payload: r.payload,
        userId: r.userId,
      })));

      // Resolve all requests with their results
      batch.forEach((request, index) => {
        const result = results[index];
        if (result instanceof Error) {
          request.reject(result);
        } else {
          request.resolve(result);
        }
      });

      const duration = Date.now() - startTime;
      Logger.debug('Batch executed successfully', {
        operation,
        batchSize: batch.length,
        duration: `${duration}ms`,
        avgPerRequest: `${(duration / batch.length).toFixed(2)}ms`,
      });

    } catch (error) {
      Logger.error('Batch execution failed', error, {
        operation,
        batchSize: batch.length,
      });

      // Reject all requests in the batch
      batch.forEach(request => {
        request.reject(error as Error);
      });
    }
  }

  /**
   * Execute the actual operation with batched requests
   */
  private async executeOperation(operation: string, requests: Array<{ payload: any; userId?: string }>): Promise<any[]> {
    const [type, subtype] = operation.split(':');

    switch (type) {
      case 'database':
        return this.executeDatabaseBatch(subtype, requests);
      
      case 'api':
        return this.executeApiBatch(subtype, requests);
      
      case 'claude':
        return this.executeClaudeBatch(subtype, requests);
      
      case 'cache':
        return this.executeCacheBatch(subtype, requests);
      
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }

  /**
   * Execute database operations in batch
   */
  private async executeDatabaseBatch(operation: string, requests: Array<{ payload: any; userId?: string }>): Promise<any[]> {
    // This would integrate with your database service
    switch (operation) {
      case 'select':
        return this.batchDatabaseSelects(requests);
      
      case 'insert':
        return this.batchDatabaseInserts(requests);
      
      case 'update':
        return this.batchDatabaseUpdates(requests);
      
      default:
        throw new Error(`Unknown database operation: ${operation}`);
    }
  }

  /**
   * Batch database SELECT operations
   */
  private async batchDatabaseSelects(requests: Array<{ payload: any; userId?: string }>): Promise<any[]> {
    // Group requests by table and similar where conditions
    const groupedRequests = new Map<string, typeof requests>();

    requests.forEach((request, index) => {
      const { table, where } = request.payload;
      const key = `${table}:${JSON.stringify(where)}`;
      
      if (!groupedRequests.has(key)) {
        groupedRequests.set(key, []);
      }
      groupedRequests.get(key)!.push({ ...request, originalIndex: index });
    });

    const results = new Array(requests.length);

    // Execute batched selects for each group
    for (const [key, group] of groupedRequests) {
      try {
        const [table] = key.split(':');
        const ids = group.map(r => r.payload.where.id).filter(Boolean);
        
        if (ids.length > 1) {
          // Batch select multiple records
          const batchResult = await this.executeMultiSelect(table, ids);
          
          group.forEach((request: any, index) => {
            results[request.originalIndex] = batchResult[index] || null;
          });
        } else {
          // Single record select
          const singleResult = await this.executeSingleSelect(table, group[0].payload.where);
          results[(group[0] as any).originalIndex] = singleResult;
        }
      } catch (error) {
        // Mark all requests in this group as failed
        group.forEach((request: any) => {
          results[request.originalIndex] = error;
        });
      }
    }

    return results;
  }

  /**
   * Batch database INSERT operations
   */
  private async batchDatabaseInserts(requests: Array<{ payload: any; userId?: string }>): Promise<any[]> {
    // Group inserts by table
    const groupedInserts = new Map<string, Array<{ payload: any; index: number }>>();

    requests.forEach((request, index) => {
      const { table } = request.payload;
      
      if (!groupedInserts.has(table)) {
        groupedInserts.set(table, []);
      }
      groupedInserts.get(table)!.push({ payload: request.payload, index });
    });

    const results = new Array(requests.length);

    // Execute batched inserts for each table
    for (const [table, group] of groupedInserts) {
      try {
        const records = group.map(g => g.payload.data);
        const batchResult = await this.executeBatchInsert(table, records);
        
        group.forEach((item, index) => {
          results[item.index] = batchResult[index];
        });
      } catch (error) {
        group.forEach(item => {
          results[item.index] = error;
        });
      }
    }

    return results;
  }

  /**
   * Batch database UPDATE operations
   */
  private async batchDatabaseUpdates(requests: Array<{ payload: any; userId?: string }>): Promise<any[]> {
    // Similar to inserts, but for updates
    const groupedUpdates = new Map<string, Array<{ payload: any; index: number }>>();

    requests.forEach((request, index) => {
      const { table } = request.payload;
      
      if (!groupedUpdates.has(table)) {
        groupedUpdates.set(table, []);
      }
      groupedUpdates.get(table)!.push({ payload: request.payload, index });
    });

    const results = new Array(requests.length);

    for (const [table, group] of groupedUpdates) {
      try {
        const updates = group.map(g => ({
          where: g.payload.where,
          data: g.payload.data,
        }));
        
        const batchResult = await this.executeBatchUpdate(table, updates);
        
        group.forEach((item, index) => {
          results[item.index] = batchResult[index];
        });
      } catch (error) {
        group.forEach(item => {
          results[item.index] = error;
        });
      }
    }

    return results;
  }

  /**
   * Execute API calls in batch
   */
  private async executeApiBatch(operation: string, requests: Array<{ payload: any; userId?: string }>): Promise<any[]> {
    switch (operation) {
      case 'external':
        return this.batchExternalApiCalls(requests);
      
      default:
        throw new Error(`Unknown API operation: ${operation}`);
    }
  }

  /**
   * Batch external API calls
   */
  private async batchExternalApiCalls(requests: Array<{ payload: any; userId?: string }>): Promise<any[]> {
    // Group requests by endpoint and method
    const groupedRequests = new Map<string, Array<{ payload: any; index: number }>>();

    requests.forEach((request, index) => {
      const { endpoint, method = 'GET' } = request.payload;
      const key = `${method}:${endpoint}`;
      
      if (!groupedRequests.has(key)) {
        groupedRequests.set(key, []);
      }
      groupedRequests.get(key)!.push({ payload: request.payload, index });
    });

    const results = new Array(requests.length);

    // Execute requests for each endpoint group
    for (const [key, group] of groupedRequests) {
      try {
        const [method, endpoint] = key.split(':', 2);
        
        if (group.length === 1) {
          // Single request
          const result = await this.executeSingleApiCall(method, endpoint, group[0].payload.data);
          results[group[0].index] = result;
        } else {
          // Batch multiple requests to same endpoint
          const batchData = group.map(g => g.payload.data);
          const batchResult = await this.executeBatchApiCall(method, endpoint, batchData);
          
          group.forEach((item, index) => {
            results[item.index] = batchResult[index];
          });
        }
      } catch (error) {
        group.forEach(item => {
          results[item.index] = error;
        });
      }
    }

    return results;
  }

  /**
   * Execute Claude API calls in batch
   */
  private async executeClaudeBatch(operation: string, requests: Array<{ payload: any; userId?: string }>): Promise<any[]> {
    // Claude API typically doesn't support true batching, but we can optimize by:
    // 1. Combining similar requests
    // 2. Using conversation context efficiently
    // 3. Implementing request queuing to respect rate limits

    const results = [];
    
    for (const request of requests) {
      try {
        // Execute Claude API request
        const result = await this.executeClaudeApiCall(request.payload);
        results.push(result);
        
        // Add small delay between requests to respect rate limits
        if (results.length < requests.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        results.push(error);
      }
    }

    return results;
  }

  /**
   * Execute cache operations in batch
   */
  private async executeCacheBatch(operation: string, requests: Array<{ payload: any; userId?: string }>): Promise<any[]> {
    switch (operation) {
      case 'get':
        return this.batchCacheGets(requests);
      
      case 'set':
        return this.batchCacheSets(requests);
      
      default:
        throw new Error(`Unknown cache operation: ${operation}`);
    }
  }

  /**
   * Batch cache GET operations
   */
  private async batchCacheGets(requests: Array<{ payload: any; userId?: string }>): Promise<any[]> {
    const keys = requests.map(r => r.payload.key);
    
    try {
      const results = await cache.mget(keys, requests[0]?.payload.options);
      return results;
    } catch (error) {
      return requests.map(() => error);
    }
  }

  /**
   * Batch cache SET operations
   */
  private async batchCacheSets(requests: Array<{ payload: any; userId?: string }>): Promise<any[]> {
    const keyValues = requests.map(r => ({
      key: r.payload.key,
      value: r.payload.value,
      ttl: r.payload.ttl,
    }));
    
    try {
      const success = await cache.mset(keyValues, requests[0]?.payload.options);
      return requests.map(() => success);
    } catch (error) {
      return requests.map(() => error);
    }
  }

  // Placeholder methods for database operations
  private async executeMultiSelect(table: string, ids: string[]): Promise<any[]> {
    // Implement with your database service
    throw new Error('Not implemented');
  }

  private async executeSingleSelect(table: string, where: any): Promise<any> {
    // Implement with your database service
    throw new Error('Not implemented');
  }

  private async executeBatchInsert(table: string, records: any[]): Promise<any[]> {
    // Implement with your database service
    throw new Error('Not implemented');
  }

  private async executeBatchUpdate(table: string, updates: Array<{ where: any; data: any }>): Promise<any[]> {
    // Implement with your database service
    throw new Error('Not implemented');
  }

  private async executeSingleApiCall(method: string, endpoint: string, data: any): Promise<any> {
    // Implement external API call
    throw new Error('Not implemented');
  }

  private async executeBatchApiCall(method: string, endpoint: string, batchData: any[]): Promise<any[]> {
    // Implement batch API call if supported by the external service
    throw new Error('Not implemented');
  }

  private async executeClaudeApiCall(payload: any): Promise<any> {
    // Implement Claude API call
    throw new Error('Not implemented');
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get batch statistics
   */
  getBatchStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [operation, batch] of this.batches) {
      stats[operation] = {
        pendingRequests: batch.length,
        oldestRequest: batch.length > 0 ? Date.now() - batch[0].timestamp : 0,
        config: this.config[operation],
      };
    }
    
    return stats;
  }

  /**
   * Clear all pending batches (useful for testing or shutdown)
   */
  clearAllBatches(): void {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Reject all pending requests
    for (const batch of this.batches.values()) {
      batch.forEach(request => {
        request.reject(new Error('Batch cleared'));
      });
    }
    this.batches.clear();

    Logger.info('All batches cleared');
  }
}

// Export singleton instance
export const batchingService = new BatchingService();