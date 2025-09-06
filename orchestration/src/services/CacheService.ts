import Redis from 'ioredis';
import { Logger } from '../utils/Logger';
import { redisCacheHitsTotal, redisCacheMissesTotal, redisConnectionsActive } from './MetricsService';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean; // Whether to compress large values
  serialize?: boolean; // Whether to JSON serialize/deserialize
}

export class CacheService {
  private redis: Redis;
  private defaultTTL: number;
  private keyPrefix: string;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');
    const redisPassword = process.env.REDIS_PASSWORD;
    const redisDb = parseInt(process.env.REDIS_DB || '0');

    this.defaultTTL = parseInt(process.env.REDIS_CACHE_TTL || '3600'); // 1 hour default
    this.keyPrefix = process.env.REDIS_KEY_PREFIX || 'anton:cache:';

    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        maxmemoryPolicy: 'allkeys-lru',
      });
    } else {
      this.redis = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        db: redisDb,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        maxmemoryPolicy: 'allkeys-lru',
      });
    }

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.redis.on('connect', () => {
      Logger.info('Redis cache connected');
      redisConnectionsActive.inc();
    });

    this.redis.on('ready', () => {
      Logger.info('Redis cache ready');
    });

    this.redis.on('error', (error) => {
      Logger.error('Redis cache error', error);
    });

    this.redis.on('close', () => {
      Logger.warn('Redis cache connection closed');
      redisConnectionsActive.dec();
    });

    this.redis.on('reconnecting', () => {
      Logger.info('Redis cache reconnecting');
    });
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private getKeyPrefix(prefix: string): string {
    return prefix.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  }

  /**
   * Get a value from cache
   */
  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const cacheKey = this.getKey(key);
      const value = await this.redis.get(cacheKey);
      
      if (value === null) {
        redisCacheMissesTotal.inc({ cache_key_prefix: this.getKeyPrefix(key) });
        return null;
      }

      redisCacheHitsTotal.inc({ cache_key_prefix: this.getKeyPrefix(key) });

      if (options.serialize !== false) {
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      }

      return value as T;
    } catch (error) {
      Logger.error('Cache get error', error, { key });
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    try {
      const cacheKey = this.getKey(key);
      const ttl = options.ttl || this.defaultTTL;
      
      let stringValue: string;
      if (options.serialize !== false && typeof value === 'object') {
        stringValue = JSON.stringify(value);
      } else {
        stringValue = String(value);
      }

      const result = await this.redis.setex(cacheKey, ttl, stringValue);
      return result === 'OK';
    } catch (error) {
      Logger.error('Cache set error', error, { key });
      return false;
    }
  }

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<boolean> {
    try {
      const cacheKey = this.getKey(key);
      const result = await this.redis.del(cacheKey);
      return result > 0;
    } catch (error) {
      Logger.error('Cache delete error', error, { key });
      return false;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const cacheKey = this.getKey(key);
      const result = await this.redis.exists(cacheKey);
      return result === 1;
    } catch (error) {
      Logger.error('Cache exists error', error, { key });
      return false;
    }
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const cacheKey = this.getKey(key);
      const result = await this.redis.expire(cacheKey, seconds);
      return result === 1;
    } catch (error) {
      Logger.error('Cache expire error', error, { key, seconds });
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T = any>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    try {
      const cacheKeys = keys.map(key => this.getKey(key));
      const values = await this.redis.mget(...cacheKeys);
      
      return values.map((value, index) => {
        const originalKey = keys[index];
        
        if (value === null) {
          redisCacheMissesTotal.inc({ cache_key_prefix: this.getKeyPrefix(originalKey) });
          return null;
        }

        redisCacheHitsTotal.inc({ cache_key_prefix: this.getKeyPrefix(originalKey) });

        if (options.serialize !== false) {
          try {
            return JSON.parse(value) as T;
          } catch {
            return value as T;
          }
        }

        return value as T;
      });
    } catch (error) {
      Logger.error('Cache mget error', error, { keys });
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(keyValues: Array<{ key: string; value: any; ttl?: number }>, options: CacheOptions = {}): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const { key, value, ttl } of keyValues) {
        const cacheKey = this.getKey(key);
        const expireTime = ttl || this.defaultTTL;
        
        let stringValue: string;
        if (options.serialize !== false && typeof value === 'object') {
          stringValue = JSON.stringify(value);
        } else {
          stringValue = String(value);
        }

        pipeline.setex(cacheKey, expireTime, stringValue);
      }

      const results = await pipeline.exec();
      return results?.every(([error, result]) => error === null && result === 'OK') || false;
    } catch (error) {
      Logger.error('Cache mset error', error, { count: keyValues.length });
      return false;
    }
  }

  /**
   * Increment a numeric value
   */
  async incr(key: string, amount: number = 1): Promise<number | null> {
    try {
      const cacheKey = this.getKey(key);
      const result = amount === 1 
        ? await this.redis.incr(cacheKey)
        : await this.redis.incrby(cacheKey, amount);
      
      return result;
    } catch (error) {
      Logger.error('Cache increment error', error, { key, amount });
      return null;
    }
  }

  /**
   * Decrement a numeric value
   */
  async decr(key: string, amount: number = 1): Promise<number | null> {
    try {
      const cacheKey = this.getKey(key);
      const result = amount === 1 
        ? await this.redis.decr(cacheKey)
        : await this.redis.decrby(cacheKey, amount);
      
      return result;
    } catch (error) {
      Logger.error('Cache decrement error', error, { key, amount });
      return null;
    }
  }

  /**
   * Add to a set
   */
  async sadd(key: string, ...members: string[]): Promise<number | null> {
    try {
      const cacheKey = this.getKey(key);
      const result = await this.redis.sadd(cacheKey, ...members);
      return result;
    } catch (error) {
      Logger.error('Cache set add error', error, { key, members });
      return null;
    }
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    try {
      const cacheKey = this.getKey(key);
      const result = await this.redis.smembers(cacheKey);
      return result;
    } catch (error) {
      Logger.error('Cache set members error', error, { key });
      return [];
    }
  }

  /**
   * Check if member exists in set
   */
  async sismember(key: string, member: string): Promise<boolean> {
    try {
      const cacheKey = this.getKey(key);
      const result = await this.redis.sismember(cacheKey, member);
      return result === 1;
    } catch (error) {
      Logger.error('Cache set is member error', error, { key, member });
      return false;
    }
  }

  /**
   * Remove from set
   */
  async srem(key: string, ...members: string[]): Promise<number | null> {
    try {
      const cacheKey = this.getKey(key);
      const result = await this.redis.srem(cacheKey, ...members);
      return result;
    } catch (error) {
      Logger.error('Cache set remove error', error, { key, members });
      return null;
    }
  }

  /**
   * Clear all cache keys with the configured prefix
   */
  async clear(): Promise<boolean> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      Logger.info('Cache cleared', { keysDeleted: keys.length });
      return true;
    } catch (error) {
      Logger.error('Cache clear error', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async stats(): Promise<{
    keys: number;
    memory: string;
    connections: number;
  }> {
    try {
      const [keyCount, info] = await Promise.all([
        this.redis.dbsize(),
        this.redis.info('memory')
      ]);

      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memory = memoryMatch ? memoryMatch[1].trim() : 'unknown';

      return {
        keys: keyCount,
        memory,
        connections: parseInt(info.match(/connected_clients:(\d+)/)?.[1] || '0'),
      };
    } catch (error) {
      Logger.error('Cache stats error', error);
      return { keys: 0, memory: 'unknown', connections: 0 };
    }
  }

  /**
   * Cache decorator for methods
   */
  cached<T>(
    keyGenerator: (...args: any[]) => string,
    options: CacheOptions = {}
  ) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function(...args: any[]): Promise<T> {
        const cacheKey = keyGenerator(...args);
        
        // Try to get from cache first
        const cached = await this.cache.get<T>(cacheKey, options);
        if (cached !== null) {
          return cached;
        }

        // Execute original method
        const result = await originalMethod.apply(this, args);
        
        // Store in cache
        await this.cache.set(cacheKey, result, options);
        
        return result;
      };

      return descriptor;
    };
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      Logger.info('Redis cache disconnected');
    } catch (error) {
      Logger.error('Redis cache disconnect error', error);
    }
  }
}

// Specific caching methods for Anton operations
export class AntonCache extends CacheService {
  /**
   * Cache project data
   */
  async cacheProject(projectId: string, project: any, ttl: number = 3600): Promise<boolean> {
    return this.set(`project:${projectId}`, project, { ttl });
  }

  /**
   * Get cached project
   */
  async getCachedProject(projectId: string): Promise<any | null> {
    return this.get(`project:${projectId}`);
  }

  /**
   * Cache execution result
   */
  async cacheExecution(executionId: string, execution: any, ttl: number = 7200): Promise<boolean> {
    return this.set(`execution:${executionId}`, execution, { ttl });
  }

  /**
   * Get cached execution
   */
  async getCachedExecution(executionId: string): Promise<any | null> {
    return this.get(`execution:${executionId}`);
  }

  /**
   * Cache agent library data
   */
  async cacheAgentLibrary(library: any, ttl: number = 1800): Promise<boolean> {
    return this.set('agent:library', library, { ttl });
  }

  /**
   * Get cached agent library
   */
  async getCachedAgentLibrary(): Promise<any | null> {
    return this.get('agent:library');
  }

  /**
   * Cache user session data
   */
  async cacheUserSession(userId: string, sessionData: any, ttl: number = 7200): Promise<boolean> {
    return this.set(`user:session:${userId}`, sessionData, { ttl });
  }

  /**
   * Get cached user session
   */
  async getCachedUserSession(userId: string): Promise<any | null> {
    return this.get(`user:session:${userId}`);
  }

  /**
   * Track active users
   */
  async addActiveUser(userId: string): Promise<boolean> {
    const added = await this.sadd('active:users', userId);
    await this.expire('active:users', 300); // 5 minutes
    return added !== null;
  }

  /**
   * Remove active user
   */
  async removeActiveUser(userId: string): Promise<boolean> {
    const removed = await this.srem('active:users', userId);
    return removed !== null;
  }

  /**
   * Get active users count
   */
  async getActiveUsersCount(): Promise<number> {
    const users = await this.smembers('active:users');
    return users.length;
  }

  /**
   * Cache rate limit data
   */
  async incrementRateLimit(key: string, windowSeconds: number): Promise<number | null> {
    const rateLimitKey = `rate_limit:${key}`;
    const pipeline = this.redis.pipeline();
    
    pipeline.incr(this.getKey(rateLimitKey));
    pipeline.expire(this.getKey(rateLimitKey), windowSeconds);
    
    const results = await pipeline.exec();
    return results?.[0]?.[1] as number || null;
  }

  /**
   * Get rate limit count
   */
  async getRateLimitCount(key: string): Promise<number> {
    const rateLimitKey = `rate_limit:${key}`;
    const count = await this.get<string>(rateLimitKey, { serialize: false });
    return parseInt(count || '0');
  }
}

// Export singleton instance
export const cache = new AntonCache();