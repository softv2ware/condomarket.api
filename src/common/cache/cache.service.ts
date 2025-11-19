import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name);
  private readonly isRedisEnabled: boolean;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {
    this.isRedisEnabled = this.configService.get('cache.redis.enabled', false);
  }

  async onModuleInit() {
    const cacheType = this.isRedisEnabled ? 'Redis' : 'In-Memory';
    this.logger.log(`Cache initialized with ${cacheType} store`);
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.cacheManager.get<T>(key);
      if (value) {
        this.logger.debug(`Cache HIT: ${key}`);
      } else {
        this.logger.debug(`Cache MISS: ${key}`);
      }
      return value;
    } catch (error) {
      this.logger.error(`Cache GET error for key ${key}:`, error);
      return undefined;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
      this.logger.debug(`Cache SET: ${key} (TTL: ${ttl || 'default'})`);
    } catch (error) {
      this.logger.error(`Cache SET error for key ${key}:`, error);
    }
  }

  /**
   * Delete a value from cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache DEL: ${key}`);
    } catch (error) {
      this.logger.error(`Cache DEL error for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys by pattern (prefix)
   * Works with Redis. For in-memory cache, this is a no-op.
   */
  async delByPattern(pattern: string): Promise<number> {
    try {
      if (!this.isRedisEnabled) {
        this.logger.debug(`Pattern deletion not supported in memory cache: ${pattern}`);
        return 0;
      }

      // Access the underlying Redis store
      const store: any = (this.cacheManager as any).store;
      if (store && store.client) {
        const redis = store.client;
        const keys: string[] = [];
        const stream = redis.scanStream({
          match: `${pattern}*`,
          count: 100,
        });

        return new Promise((resolve, reject) => {
          let deletedCount = 0;
          stream.on('data', async (resultKeys: string[]) => {
            if (resultKeys.length > 0) {
              keys.push(...resultKeys);
              const result = await redis.del(...resultKeys);
              deletedCount += result;
            }
          });
          stream.on('end', () => {
            this.logger.debug(`Cache DEL pattern: ${pattern} - deleted ${deletedCount} keys`);
            resolve(deletedCount);
          });
          stream.on('error', reject);
        });
      }

      this.logger.warn('Redis client not available for pattern deletion');
      return 0;
    } catch (error) {
      this.logger.error(`Cache DEL pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async reset(): Promise<void> {
    try {
      const store: any = (this.cacheManager as any).store;
      if (store && store.reset) {
        await store.reset();
        this.logger.debug('Cache RESET: all keys cleared');
      } else if (store && store.client) {
        // For Redis, use FLUSHDB
        await store.client.flushdb();
        this.logger.debug('Cache RESET: Redis FLUSHDB executed');
      } else {
        this.logger.warn('Cache RESET not supported by current store');
      }
    } catch (error) {
      this.logger.error('Cache RESET error:', error);
    }
  }

  /**
   * Get multiple keys at once (efficient for Redis with MGET)
   */
  async mget<T>(...keys: string[]): Promise<(T | undefined)[]> {
    try {
      const promises = keys.map(key => this.get<T>(key));
      return await Promise.all(promises);
    } catch (error) {
      this.logger.error(`Cache MGET error:`, error);
      return keys.map(() => undefined);
    }
  }

  /**
   * Set multiple keys at once
   */
  async mset(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    try {
      await Promise.all(
        entries.map(({ key, value, ttl }) => this.set(key, value, ttl))
      );
      this.logger.debug(`Cache MSET: ${entries.length} keys set`);
    } catch (error) {
      this.logger.error('Cache MSET error:', error);
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const value = await this.cacheManager.get(key);
      return value !== undefined;
    } catch (error) {
      this.logger.error(`Cache EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key (Redis only)
   */
  async ttl(key: string): Promise<number | null> {
    try {
      if (!this.isRedisEnabled) {
        return null;
      }

      const store: any = (this.cacheManager as any).store;
      if (store && store.client) {
        const ttl = await store.client.ttl(key);
        return ttl > 0 ? ttl : null;
      }
      return null;
    } catch (error) {
      this.logger.error(`Cache TTL error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Wrap a function with caching
   */
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    try {
      return await this.cacheManager.wrap(key, fn, ttl);
    } catch (error) {
      this.logger.error(`Cache WRAP error for key ${key}:`, error);
      // If cache fails, execute the function directly
      return await fn();
    }
  }

  /**
   * Generate cache key with building scope
   */
  buildingKey(buildingId: string, suffix: string): string {
    return `building:${buildingId}:${suffix}`;
  }

  /**
   * Generate cache key with user scope
   */
  userKey(userId: string, suffix: string): string {
    return `user:${userId}:${suffix}`;
  }

  /**
   * Generate cache key for listings
   */
  listingKey(listingId: string): string {
    return `listing:${listingId}`;
  }

  /**
   * Generate cache key for search results
   */
  searchKey(query: string, filters: Record<string, any>): string {
    const filterString = JSON.stringify(filters);
    return `search:${query}:${filterString}`;
  }
}
