import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const isRedisEnabled = this.configService.get('cache.redis.enabled', false);
    
    if (!isRedisEnabled) {
      return this.getStatus(key, true, { 
        message: 'Redis is disabled, using in-memory cache' 
      });
    }

    try {
      // Try to get the cache manager and check Redis connection
      const Redis = await import('ioredis');
      const redis = new Redis.default({
        host: this.configService.get('redis.host', 'localhost'),
        port: this.configService.get('redis.port', 6379),
        password: this.configService.get('redis.password'),
        db: this.configService.get('redis.db', 0),
        lazyConnect: true,
        connectTimeout: 5000,
      });

      await redis.connect();
      const pong = await redis.ping();
      await redis.quit();

      const isHealthy = pong === 'PONG';
      const result = this.getStatus(key, isHealthy, { 
        message: isHealthy ? 'Redis is responding' : 'Redis ping failed' 
      });

      if (isHealthy) {
        return result;
      }
      throw new HealthCheckError('Redis health check failed', result);
    } catch (error) {
      const result = this.getStatus(key, false, { 
        message: error instanceof Error ? error.message : 'Redis connection failed' 
      });
      throw new HealthCheckError('Redis health check failed', result);
    }
  }
}
