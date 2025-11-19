import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

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
   */
  async delByPattern(pattern: string): Promise<void> {
    try {
      // For memory cache, we need to implement pattern deletion manually
      // In production with Redis, this would use Redis SCAN + DEL
      this.logger.debug(`Cache DEL pattern: ${pattern}`);
      // Note: cache-manager doesn't support pattern deletion out of the box
      // This is a placeholder for future Redis implementation
    } catch (error) {
      this.logger.error(`Cache DEL pattern error for ${pattern}:`, error);
    }
  }

  /**
   * Clear all cache
   */
  async reset(): Promise<void> {
    try {
      // Note: reset() may not be available in all cache-manager versions
      // This is a placeholder for manual cache clearing if needed
      this.logger.debug('Cache RESET requested');
    } catch (error) {
      this.logger.error('Cache RESET error:', error);
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
