# Redis Caching Implementation Guide

## Overview

The CondoMarket API now uses a production-grade Redis caching system powered by `ioredis` and `cache-manager`. This provides high-performance, distributed caching suitable for large-scale production deployments.

## Features

✅ **Automatic Redis/In-Memory Fallback**: Seamlessly switches between Redis and in-memory cache based on configuration  
✅ **Pattern-Based Deletion**: Efficiently delete multiple cache keys using patterns (e.g., `user:*`)  
✅ **Bulk Operations**: MGET/MSET support for batch operations  
✅ **TTL Management**: Per-key TTL configuration and TTL inspection  
✅ **Connection Pooling**: Automatic reconnection and retry strategies  
✅ **High Availability**: Support for Redis Sentinel and Cluster modes  
✅ **Health Monitoring**: Built-in health checks for Redis connectivity  
✅ **Structured Logging**: All cache operations are logged with correlation IDs  

## Configuration

### Environment Variables

```bash
# Basic Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=0
REDIS_KEY_PREFIX=condomarket:

# Enable Redis (set to true for production)
REDIS_ENABLED=true

# Cache TTL (seconds)
CACHE_TTL=300
CACHE_MAX_ITEMS=1000

# High Availability - Redis Sentinel (Optional)
REDIS_SENTINELS=[{"host":"sentinel1","port":26379},{"host":"sentinel2","port":26379}]
REDIS_SENTINEL_PASSWORD=sentinel-password
REDIS_SENTINEL_NAME=mymaster

# Redis Cluster (Optional)
REDIS_CLUSTER=true
REDIS_CLUSTER_NODES=[{"host":"node1","port":6379},{"host":"node2","port":6379}]
```

### Development vs Production

**Development (In-Memory Cache):**
```bash
REDIS_ENABLED=false
```

**Production (Redis):**
```bash
REDIS_ENABLED=true
REDIS_HOST=your-redis-host.com
REDIS_PASSWORD=secure-password
```

## Usage Examples

### Basic Operations

```typescript
import { CacheService } from '@/common/cache/cache.service';

@Injectable()
export class YourService {
  constructor(private cacheService: CacheService) {}

  // Get from cache
  async getData(id: string) {
    const cached = await this.cacheService.get<MyData>(`data:${id}`);
    if (cached) {
      return cached;
    }

    const data = await this.fetchFromDatabase(id);
    await this.cacheService.set(`data:${id}`, data, 300); // 5 minutes TTL
    return data;
  }

  // Delete from cache
  async updateData(id: string, data: MyData) {
    await this.database.update(id, data);
    await this.cacheService.del(`data:${id}`);
  }
}
```

### Cache Wrapping (Recommended)

```typescript
// Automatic cache-aside pattern
async getUser(userId: string) {
  return this.cacheService.wrap(
    this.cacheService.userKey(userId, 'profile'),
    async () => {
      // This function only runs on cache miss
      return this.prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      });
    },
    600 // 10 minutes TTL
  );
}
```

### Pattern-Based Deletion

```typescript
// Invalidate all building-related caches
async clearBuildingCache(buildingId: string) {
  const deletedCount = await this.cacheService.delByPattern(
    this.cacheService.buildingKey(buildingId, '')
  );
  console.log(`Cleared ${deletedCount} building cache keys`);
}

// Invalidate all user caches
async clearAllUserCaches() {
  await this.cacheService.delByPattern('user:');
}
```

### Bulk Operations

```typescript
// Get multiple items at once
async getMultipleListings(listingIds: string[]) {
  const keys = listingIds.map(id => this.cacheService.listingKey(id));
  const cached = await this.cacheService.mget<Listing>(...keys);
  
  // Find missing items
  const missing = listingIds.filter((id, i) => !cached[i]);
  
  if (missing.length > 0) {
    const fromDb = await this.prisma.listing.findMany({
      where: { id: { in: missing } },
    });
    
    // Cache missing items
    await this.cacheService.mset(
      fromDb.map(listing => ({
        key: this.cacheService.listingKey(listing.id),
        value: listing,
        ttl: 300,
      }))
    );
  }
  
  return cached.filter(Boolean);
}
```

### Cache Key Helpers

```typescript
// Building-scoped keys
const key = this.cacheService.buildingKey('building-123', 'residents');
// Result: "building:building-123:residents"

// User-scoped keys
const key = this.cacheService.userKey('user-456', 'subscriptions');
// Result: "user:user-456:subscriptions"

// Listing keys
const key = this.cacheService.listingKey('listing-789');
// Result: "listing:listing-789"

// Search keys (with filters)
const key = this.cacheService.searchKey('laptop', { 
  category: 'electronics', 
  priceMax: 1000 
});
// Result: "search:laptop:{\"category\":\"electronics\",\"priceMax\":1000}"
```

### TTL Management

```typescript
// Check if key exists
const exists = await this.cacheService.exists('user:123:profile');

// Get remaining TTL (Redis only)
const ttl = await this.cacheService.ttl('user:123:profile');
console.log(`Cache expires in ${ttl} seconds`);
```

## Advanced Patterns

### Cache-Aside Pattern (Read-Through)

```typescript
async getListingWithRelations(listingId: string) {
  const cacheKey = this.cacheService.listingKey(listingId);
  
  return this.cacheService.wrap(
    cacheKey,
    async () => {
      return this.prisma.listing.findUnique({
        where: { id: listingId },
        include: {
          seller: { include: { profile: true } },
          category: true,
          photos: true,
          reviews: { take: 5, orderBy: { createdAt: 'desc' } },
        },
      });
    },
    600 // 10 minutes
  );
}
```

### Write-Through Pattern

```typescript
async updateListing(listingId: string, data: UpdateListingDto) {
  // Update database
  const updated = await this.prisma.listing.update({
    where: { id: listingId },
    data,
  });
  
  // Update cache immediately
  const cacheKey = this.cacheService.listingKey(listingId);
  await this.cacheService.set(cacheKey, updated, 600);
  
  // Invalidate related caches
  await this.cacheService.delByPattern(
    this.cacheService.buildingKey(updated.buildingId, '')
  );
  
  return updated;
}
```

### Cache Invalidation Strategies

```typescript
// Strategy 1: Invalidate on update
async updateUser(userId: string, data: UpdateUserDto) {
  const user = await this.prisma.user.update({
    where: { id: userId },
    data,
  });
  
  // Invalidate all user-related caches
  await this.cacheService.delByPattern(
    this.cacheService.userKey(userId, '')
  );
  
  return user;
}

// Strategy 2: Invalidate multiple related caches
async createOrder(orderData: CreateOrderDto) {
  const order = await this.prisma.order.create({
    data: orderData,
  });
  
  // Invalidate multiple cache patterns
  await Promise.all([
    this.cacheService.del(this.cacheService.userKey(order.buyerId, 'orders')),
    this.cacheService.del(this.cacheService.userKey(order.sellerId, 'orders')),
    this.cacheService.del(this.cacheService.listingKey(order.listingId)),
    this.cacheService.delByPattern(
      this.cacheService.buildingKey(order.buildingId, 'orders')
    ),
  ]);
  
  return order;
}

// Strategy 3: Lazy expiration (let TTL handle it)
async getAnalytics(buildingId: string) {
  return this.cacheService.wrap(
    this.cacheService.buildingKey(buildingId, 'analytics'),
    async () => this.calculateAnalytics(buildingId),
    300 // 5 minutes - analytics don't need real-time accuracy
  );
}
```

## Redis Deployment Architectures

### Standalone Redis (Development/Small Production)

```bash
REDIS_ENABLED=true
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=secure-password
```

### Redis Sentinel (High Availability)

```bash
REDIS_ENABLED=true
REDIS_SENTINELS=[{"host":"sentinel1.example.com","port":26379},{"host":"sentinel2.example.com","port":26379},{"host":"sentinel3.example.com","port":26379}]
REDIS_SENTINEL_NAME=mymaster
REDIS_SENTINEL_PASSWORD=sentinel-password
```

**Benefits:**
- Automatic failover
- Multiple sentinel nodes monitor master
- Client-side master discovery

### Redis Cluster (Horizontal Scaling)

```bash
REDIS_ENABLED=true
REDIS_CLUSTER=true
REDIS_CLUSTER_NODES=[{"host":"node1.example.com","port":6379},{"host":"node2.example.com","port":6379},{"host":"node3.example.com","port":6379}]
```

**Benefits:**
- Data sharding across nodes
- Horizontal scalability
- High throughput

## Performance Best Practices

### 1. Use Appropriate TTLs

```typescript
// Frequently changing data: short TTL
await cache.set('active-users', data, 60); // 1 minute

// Rarely changing data: long TTL
await cache.set('building-info', data, 3600); // 1 hour

// Static data: very long TTL
await cache.set('categories', data, 86400); // 24 hours
```

### 2. Batch Operations

```typescript
// ❌ Bad: Multiple round trips
for (const id of userIds) {
  await cache.get(`user:${id}`);
}

// ✅ Good: Single batch operation
const keys = userIds.map(id => `user:${id}`);
await cache.mget(...keys);
```

### 3. Cache Warming

```typescript
// Warm cache on application startup
@Injectable()
export class CacheWarmupService implements OnApplicationBootstrap {
  async onApplicationBootstrap() {
    await this.warmCommonCaches();
  }
  
  async warmCommonCaches() {
    // Cache categories
    const categories = await this.prisma.category.findMany();
    await this.cache.set('categories:all', categories, 86400);
    
    // Cache subscription plans
    const plans = await this.prisma.subscriptionPlan.findMany();
    await this.cache.set('plans:all', plans, 3600);
  }
}
```

### 4. Monitoring Cache Hit Rates

The `CacheService` logs all cache operations:

```
[CacheService] Cache HIT: user:123:profile
[CacheService] Cache MISS: user:456:profile
[CacheService] Cache SET: user:456:profile (TTL: 600)
```

Monitor these logs to optimize cache strategy.

## Health Monitoring

The `/health` endpoint includes Redis connectivity checks when enabled:

```bash
curl http://localhost:3000/health

{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up", "message": "Redis is responding" },
    "memory_heap": { "status": "up" },
    "memory_rss": { "status": "up" },
    "disk": { "status": "up" }
  }
}
```

## Troubleshooting

### Redis Connection Issues

Check logs for:
```
[CacheService] Cache initialized with Redis store
```

If seeing "In-Memory store", verify:
1. `REDIS_ENABLED=true` in .env
2. Redis server is running and accessible
3. Credentials are correct

### High Memory Usage

```typescript
// Clear all caches
await cacheService.reset();

// Or clear specific patterns
await cacheService.delByPattern('search:'); // Clear all search caches
```

### Cache Stampede Prevention

```typescript
// Use cache wrapping to prevent thundering herd
async getPopularListing(id: string) {
  return this.cache.wrap(
    this.cache.listingKey(id),
    async () => {
      // Only one request will execute this function
      // Others will wait for the result
      return this.expensiveOperation(id);
    },
    300
  );
}
```

## Migration from In-Memory to Redis

1. **Update environment variables:**
   ```bash
   REDIS_ENABLED=true
   REDIS_HOST=your-redis-host
   REDIS_PASSWORD=your-password
   ```

2. **Restart application:**
   ```bash
   pnpm start:prod
   ```

3. **Verify Redis connection:**
   ```bash
   curl http://localhost:3000/health
   ```

No code changes required! The cache service automatically uses Redis when enabled.

## Cost Optimization

### AWS ElastiCache Pricing Example

- **t4g.micro**: $0.016/hour (~$12/month) - Development/Testing
- **r6g.large**: $0.201/hour (~$146/month) - Production (13GB RAM)
- **r6g.xlarge**: $0.403/hour (~$293/month) - High Traffic (26GB RAM)

### Redis Cloud (Redis Labs)

- **30MB Free**: Good for testing
- **1GB**: $10-15/month
- **10GB**: $60-80/month

### Self-Hosted

Cost = Server + Monitoring tools

## Summary

This Redis caching implementation provides:

✅ **Production-Ready**: Battle-tested with `ioredis`  
✅ **Scalable**: Supports Sentinel and Cluster modes  
✅ **Developer-Friendly**: Simple API with automatic fallback  
✅ **Observable**: Built-in logging and health checks  
✅ **Flexible**: Easy migration between cache strategies  

For high-traffic production deployments with 10,000+ daily active users, Redis is essential for maintaining sub-200ms response times.
