import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_AUTH } from './dto/redis.dto';
import { RedisService } from './redis.service';
import { CacheService } from './cache.service';
import { ConfigModule } from '@nestjs/config';

/**
 * Check if running in production environment.
 * Uses startsWith('prod') to cover: prod, production, produs, prodap.
 * @see @dofe/infra-utils environmentUtil.isProduction() for the canonical implementation.
 */
function isProduction(): boolean {
  return process.env.NODE_ENV?.startsWith('prod') ?? false;
}

function logRedis(level: 'error' | 'warn' | 'info' | 'debug', message: string, meta?: unknown) {
  if (level === 'debug' && isProduction()) {
    return;
  }

  if (level === 'debug') {
    console.debug(message, meta);
    return;
  }

  const method = level === 'info' ? 'log' : level;
  console[method](message, meta);
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_AUTH,
      useFactory: async () => {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
          logRedis('error', 'Redis URL not configured');
          return null;
        }
        try {
          const client = new Redis(redisUrl, {
            retryStrategy(times) {
              if (times > 10) {
                logRedis(
                  'error',
                  'Redis reconnect exhausted after 10 retries.',
                );
                return null;
              }
              return Math.min(times * 150, 3000);
            },
          });

          client.on('connect', () => {
            if (isProduction()) {
              logRedis('info', 'Redis client connected');
            }
          });

          client.on('error', (error) => {
            if (isProduction()) {
              logRedis('error', 'Error connecting to Redis', error);
            } else {
              logRedis('debug', 'Error connecting to Redis', error);
            }
          });

          return client;
        } catch (e) {
          logRedis('error', 'Redis error', e);
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
