import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { redisStore } from 'cache-manager-ioredis-yet';
import type { RedisOptions } from 'ioredis';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const isRedisEnabled = configService.get('cache.redis.enabled', false);
        const ttl = configService.get('cache.ttl', 300) * 1000; // Convert to milliseconds

        if (isRedisEnabled) {
          // Production Redis configuration
          const redisConfig: RedisOptions = {
            host: configService.get('redis.host', 'localhost'),
            port: configService.get('redis.port', 6379),
            password: configService.get('redis.password'),
            db: configService.get('redis.db', 0),
            keyPrefix: configService.get('redis.keyPrefix', 'condomarket:'),

            // Connection options
            connectTimeout: 10000,
            retryStrategy: (times: number) => {
              const delay = Math.min(times * 50, 2000);
              return delay;
            },

            // Performance optimizations
            enableReadyCheck: true,
            maxRetriesPerRequest: 3,
            enableOfflineQueue: true,

            // Reconnection
            reconnectOnError: (err) => {
              const targetError = 'READONLY';
              if (err.message.includes(targetError)) {
                return true;
              }
              return false;
            },
          };

          return {
            store: await redisStore(redisConfig),
            ttl,
            isGlobal: true,
          };
        }

        // Fallback to in-memory cache for development
        return {
          ttl,
          max: configService.get('cache.max', 100),
          isGlobal: true,
        };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, NestCacheModule],
})
export class CacheModule {}
