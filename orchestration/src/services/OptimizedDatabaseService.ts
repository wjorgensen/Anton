import { PrismaClient } from '../generated/prisma';
import { Logger } from '../utils/Logger';
import { 
  databaseConnectionsActive, 
  databaseQueriesTotal, 
  databaseQueryDuration,
  trackDatabaseQuery 
} from './MetricsService';

export class OptimizedDatabaseService {
  private prisma: PrismaClient;
  private connectionPool: {
    min: number;
    max: number;
    idleTimeout: number;
    acquireTimeout: number;
  };

  constructor() {
    this.connectionPool = {
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      idleTimeout: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
      acquireTimeout: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT || '60000'),
    };

    this.prisma = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
      datasources: {
        db: {
          url: this.getDatabaseUrl(),
        },
      },
    });

    this.setupEventListeners();
    this.setupQueryLogging();
  }

  private getDatabaseUrl(): string {
    const baseUrl = process.env.DATABASE_URL;
    if (!baseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Add connection pool parameters for PostgreSQL
    const url = new URL(baseUrl);
    url.searchParams.set('connection_limit', this.connectionPool.max.toString());
    url.searchParams.set('pool_timeout', (this.connectionPool.acquireTimeout / 1000).toString());
    url.searchParams.set('connect_timeout', '10');
    url.searchParams.set('socket_timeout', '30');

    return url.toString();
  }

  private setupEventListeners() {
    this.prisma.$on('beforeExit', async () => {
      Logger.info('Database connection closing');
      databaseConnectionsActive.set(0);
    });

    // Track connection events if available
    this.prisma.$connect().then(() => {
      Logger.info('Database connected with connection pooling', {
        poolMin: this.connectionPool.min,
        poolMax: this.connectionPool.max,
        idleTimeout: this.connectionPool.idleTimeout,
        acquireTimeout: this.connectionPool.acquireTimeout,
      });
      databaseConnectionsActive.set(1);
    }).catch((error) => {
      Logger.error('Database connection failed', error);
    });
  }

  private setupQueryLogging() {
    this.prisma.$on('query', (e) => {
      const duration = e.duration;
      const query = e.query;
      const params = e.params;

      // Extract table name from query for metrics
      const tableMatch = query.match(/(?:FROM|INSERT INTO|UPDATE|DELETE FROM)\s+`?(\w+)`?/i);
      const table = tableMatch?.[1] || 'unknown';
      
      const operation = query.trim().split(' ')[0].toLowerCase();

      // Track metrics
      databaseQueriesTotal.inc({ operation, table, status: 'success' });
      databaseQueryDuration.observe({ operation, table }, duration / 1000);

      // Log slow queries
      if (duration > 1000) { // 1 second
        Logger.warn('Slow database query detected', {
          query: query.substring(0, 200),
          duration: `${duration}ms`,
          table,
          operation,
        });
      }

      // Debug logging for development
      if (process.env.NODE_ENV === 'development' && process.env.LOG_LEVEL === 'debug') {
        Logger.debug('Database query', {
          query: query.substring(0, 200),
          params: params.substring(0, 100),
          duration: `${duration}ms`,
          table,
          operation,
        });
      }
    });

    this.prisma.$on('error', (e) => {
      Logger.error('Database error', e);
    });

    this.prisma.$on('info', (e) => {
      Logger.info('Database info', { message: e.message });
    });

    this.prisma.$on('warn', (e) => {
      Logger.warn('Database warning', { message: e.message });
    });
  }

  /**
   * Get Prisma client instance
   */
  getClient(): PrismaClient {
    return this.prisma;
  }

  /**
   * Execute a raw query with metrics tracking
   */
  async executeRaw<T = any>(query: string, values?: any[]): Promise<T> {
    const trackQuery = trackDatabaseQuery('raw', 'raw');
    
    try {
      const result = await this.prisma.$queryRawUnsafe(query, ...(values || []));
      trackQuery('success');
      return result as T;
    } catch (error) {
      trackQuery('error');
      throw error;
    }
  }

  /**
   * Execute a transaction with retry logic
   */
  async transaction<T>(
    callback: (prisma: PrismaClient) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.prisma.$transaction(callback, {
          maxWait: this.connectionPool.acquireTimeout,
          timeout: 30000, // 30 seconds
        });
      } catch (error) {
        lastError = error as Error;
        
        // Only retry on specific errors
        const shouldRetry = 
          error instanceof Error && (
            error.message.includes('connection') ||
            error.message.includes('timeout') ||
            error.message.includes('deadlock')
          );

        if (shouldRetry && attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          Logger.warn('Transaction failed, retrying', {
            attempt,
            maxRetries,
            delay,
            error: error.message,
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }
    }

    throw lastError!;
  }

  /**
   * Database health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    connections: number;
  }> {
    const start = Date.now();
    
    try {
      // Simple query to test connection
      await this.prisma.$queryRaw`SELECT 1`;
      
      const responseTime = Date.now() - start;
      
      return {
        status: 'healthy',
        responseTime,
        connections: 1, // Prisma doesn't expose connection count directly
      };
    } catch (error) {
      Logger.error('Database health check failed', error);
      
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        connections: 0,
      };
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      Logger.info('Database disconnected');
    } catch (error) {
      Logger.error('Error disconnecting from database', error);
    }
  }
}

// Export singleton instance
export const database = new OptimizedDatabaseService();