import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_AUTH } from './dto/redis.dto';
import { RedisService } from './redis.service';
import { CacheService } from './cache.service';
import { ConfigModule } from '@nestjs/config';

/**
 * Check if running in production environment
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_AUTH,
      useFactory: async () => {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
          console.error('Redis URL not configured');
          return null;
        }
        try {
          const client = new Redis(redisUrl, {
            retryStrategy(times) {
              if (times > 10) {
                console.error(
                  'Redis连接失败',
                  'Redis reconnect exhausted after 10 retries.',
                );
                return null;
              }
              return Math.min(times * 150, 3000);
            },
          });

          client.on('connect', () => {
            if (isProduction()) {
              console.log('Redis client connected');
            }
          });

          client.on('error', (error) => {
            if (isProduction()) {
              console.error('Error connecting to Redis', error);
            } else {
              console.debug('Error connecting to Redis', error);
            }
          });

          return client;
        } catch (e) {
          console.error('Redis error', e);
          return null;
        }
      },
    },
    RedisService,
    CacheService,
  ],
  exports: [REDIS_AUTH, RedisService, CacheService],
})
export class RedisModule {}