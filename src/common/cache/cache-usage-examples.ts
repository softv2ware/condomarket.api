// Example: How to use Redis caching in your services

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CacheService } from './cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateListingDto } from '~/listings/dto/update-listing.dto';

@Injectable()
export class ListingsExampleService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * Example 1: Basic cache-aside pattern
   */
  async getListing(listingId: string) {
    const cacheKey = this.cache.listingKey(listingId);
    
    // Try to get from cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // If not in cache, fetch from database
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        seller: { include: { profile: true } },
        category: true,
        photos: true,
      },
    });

    // Store in cache for future requests (10 minutes TTL)
    if (listing) {
      await this.cache.set(cacheKey, listing, 600);
    }

    return listing;
  }

  /**
   * Example 2: Cache wrapping (recommended - cleaner code)
   */
  async getListingWithCache(listingId: string) {
    return this.cache.wrap(
      this.cache.listingKey(listingId),
      async () => {
        // This function only executes on cache miss
        return this.prisma.listing.findUnique({
          where: { id: listingId },
          include: {
            seller: { include: { profile: true } },
            category: true,
            photos: true,
          },
        });
      },
      600 // 10 minutes TTL
    );
  }

  /**
   * Example 3: Invalidate cache on update
   */
  async updateListing(listingId: string, data: UpdateListingDto) {
    // Update database
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data,
    });

    // Invalidate cache
    await this.cache.del(this.cache.listingKey(listingId));

    // Also invalidate related caches
    await this.cache.delByPattern(
      this.cache.buildingKey(updated.buildingId, 'listings')
    );

    return updated;
  }

  /**
   * Example 4: Batch operations for multiple listings
   */
  async getMultipleListings(listingIds: string[]) {
    const cacheKeys = listingIds.map(id => this.cache.listingKey(id));
    
    // Get all from cache in one operation
    const cachedListings = await this.cache.mget(...cacheKeys);

    // Find which ones were missing
    const missingIndices = cachedListings
      .map((listing, index) => (listing ? null : index))
      .filter(index => index !== null) as number[];

    if (missingIndices.length > 0) {
      // Fetch missing ones from database
      const missingIds = missingIndices.map(i => listingIds[i]);
      const fromDb = await this.prisma.listing.findMany({
        where: { id: { in: missingIds } },
        include: {
          seller: { include: { profile: true } },
          category: true,
        },
      });

      // Cache the newly fetched listings
      await this.cache.mset(
        fromDb.map(listing => ({
          key: this.cache.listingKey(listing.id),
          value: listing,
          ttl: 600,
        }))
      );

      // Merge results
      fromDb.forEach((listing, dbIndex) => {
        const originalIndex = missingIndices[dbIndex];
        cachedListings[originalIndex] = listing;
      });
    }

    return cachedListings.filter(Boolean);
  }

  /**
   * Example 5: Search results caching with filters
   */
  async searchListings(query: string, filters: Record<string, unknown>) {
    const cacheKey = this.cache.searchKey(query, filters);

    return this.cache.wrap(
      cacheKey,
      async () => {
        return this.prisma.listing.findMany({
          where: {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
            ...this.buildFilters(filters),
          },
          take: 20,
          orderBy: { createdAt: 'desc' },
        });
      },
      300 // 5 minutes - search results can be slightly stale
    );
  }

  /**
   * Example 6: Building-scoped cache with automatic prefix
   */
  async getBuildingListings(buildingId: string, page: number = 1) {
    const cacheKey = this.cache.buildingKey(buildingId, `listings:page:${page}`);

    return this.cache.wrap(
      cacheKey,
      async () => {
        return this.prisma.listing.findMany({
          where: { buildingId, status: 'ACTIVE' },
          skip: (page - 1) * 20,
          take: 20,
          orderBy: { createdAt: 'desc' },
        });
      },
      600
    );
  }

  /**
   * Example 7: Clear all building-related caches
   */
  async clearBuildingCache(buildingId: string) {
    // This deletes ALL keys matching "building:{buildingId}:*"
    const deletedCount = await this.cache.delByPattern(
      this.cache.buildingKey(buildingId, '')
    );
    
    console.log(`Cleared ${deletedCount} cache keys for building ${buildingId}`);
  }

  /**
   * Example 8: Cache with conditional invalidation
   */
  async incrementViewCount(listingId: string) {
    // Update view count
    await this.prisma.listing.update({
      where: { id: listingId },
      data: { viewCount: { increment: 1 } },
    });

    // Check if cache should be invalidated
    const cacheKey = this.cache.listingKey(listingId);
    const ttl = await this.cache.ttl(cacheKey);

    // Only invalidate if cache will expire soon (< 60 seconds)
    if (ttl !== null && ttl < 60) {
      await this.cache.del(cacheKey);
    }
  }

  /**
   * Example 9: Optimistic cache update (write-through)
   */
  async activateListing(listingId: string) {
    const listing = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: 'ACTIVE', publishedAt: new Date() },
      include: {
        seller: { include: { profile: true } },
        category: true,
      },
    });

    // Immediately update cache (write-through pattern)
    const cacheKey = this.cache.listingKey(listingId);
    await this.cache.set(cacheKey, listing, 600);

    return listing;
  }

  /**
   * Example 10: Check cache statistics
   */
  async getCacheStats(listingId: string) {
    const cacheKey = this.cache.listingKey(listingId);
    
    return {
      exists: await this.cache.exists(cacheKey),
      ttl: await this.cache.ttl(cacheKey),
      key: cacheKey,
    };
  }

  // Helper method
  private buildFilters(filters: Record<string, unknown>): Prisma.ListingWhereInput {
    const where: Prisma.ListingWhereInput = {};
    
    if (filters.category) {
      where.categoryId = filters.category as string;
    }
    
    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = filters.minPrice as number;
      if (filters.maxPrice) where.price.lte = filters.maxPrice as number;
    }
    
    return where;
  }
}

/**
 * BEST PRACTICES FOR CACHING:
 * 
 * 1. Use appropriate TTLs based on data volatility:
 *    - Frequently updated: 60-300 seconds
 *    - Moderately updated: 300-1800 seconds (5-30 minutes)
 *    - Rarely updated: 3600+ seconds (1+ hours)
 * 
 * 2. Always handle cache failures gracefully:
 *    - The CacheService already does this
 *    - Failed cache operations won't crash your app
 * 
 * 3. Invalidate strategically:
 *    - Use pattern deletion for related data
 *    - Lazy invalidation (TTL) for non-critical data
 *    - Immediate invalidation for critical data
 * 
 * 4. Batch operations when possible:
 *    - Use mget/mset instead of multiple get/set calls
 *    - Reduces network round trips with Redis
 * 
 * 5. Use cache wrapping for cleaner code:
 *    - Automatic cache-aside pattern
 *    - Handles cache miss internally
 *    - More maintainable code
 * 
 * 6. Monitor cache performance:
 *    - Watch logs for HIT/MISS ratios
 *    - Adjust TTLs based on metrics
 *    - Use Redis MONITOR command for debugging
 * 
 * 7. Namespace your keys:
 *    - Use the helper methods (userKey, buildingKey, etc.)
 *    - Makes pattern deletion easier
 *    - Prevents key collisions
 * 
 * 8. Consider cache warming:
 *    - Pre-populate frequently accessed data
 *    - Reduces cold start issues
 *    - Improves user experience
 */
