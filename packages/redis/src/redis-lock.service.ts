import { Injectable, Inject, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_AUTH } from './dto/redis.dto';

/**
 * Check if running in production environment
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Simple console logger fallback when Winston is not available
 */
const consoleLogger = {
  error: (message: string, meta?: any) => console.error(message, meta),
  warn: (message: string, meta?: any) => console.warn(message, meta),
  info: (message: string, meta?: any) => console.info(message, meta),
  debug: (message: string, meta?: any) => {
    if (!isProduction()) console.debug(message, meta);
  },
};

type LoggerLike = typeof consoleLogger;

@Injectable()
export class RedisLockService {
  private readonly logger: LoggerLike;

  constructor(
    @Inject(REDIS_AUTH) private readonly redis: Redis,
    @Optional() @Inject('WINSTON_LOGGER') winstonLogger?: LoggerLike,
  ) {
    this.logger = winstonLogger ?? consoleLogger;
  }

  async acquireLock(
    key: string,
    options: {
      ttl?: number;
      retries?: number;
      retryDelay?: number;
    } = {},
  ): Promise<{ release: () => Promise<void> }> {
    const { ttl = 30000, retries = 3, retryDelay = 1000 } = options;

    const lockValue = this.generateLockValue();
    const ttlSeconds = Math.ceil(ttl / 1000);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.redis.set(key, lockValue, 'EX', ttlSeconds, 'NX');

        if (result === 'OK') {
          this.logger.debug('[RedisLock] Lock acquired', {
            key,
            lockValue,
            ttl,
            attempt,
          });

          return {
            release: async () => {
              await this.releaseLock(key, lockValue);
            },
          };
        }

        if (attempt < retries) {
          this.logger.debug('[RedisLock] Lock acquisition failed, retrying', {
            key,
            attempt,
            nextRetryIn: retryDelay,
          });
          await this.sleep(retryDelay);
        }
      } catch (error) {
        this.logger.error('[RedisLock] Error acquiring lock', {
          key,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });

        if (attempt === retries) {
          throw error;
        }

        await this.sleep(retryDelay);
      }
    }

    throw new Error(`Failed to acquire lock after ${retries} attempts: ${key}`);
  }

  private async releaseLock(key: string, lockValue: string): Promise<void> {
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(script, 1, key, lockValue);

      if (result === 1) {
        this.logger.debug('[RedisLock] Lock released', { key, lockValue });
      } else {
        this.logger.warn('[RedisLock] Lock not released (already expired or not owned)', {
          key,
          lockValue,
        });
      }
    } catch (error) {
      this.logger.error('[RedisLock] Error releasing lock', {
        key,
        lockValue,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private generateLockValue(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async tryLock(
    key: string,
    ttl: number = 30000,
  ): Promise<{ release: () => Promise<void> } | null> {
    try {
      return await this.acquireLock(key, { ttl, retries: 1, retryDelay: 0 });
    } catch {
      return null;
    }
  }

  async isLocked(key: string): Promise<boolean> {
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async forceRelease(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.logger.warn('[RedisLock] Lock force released', { key });
    } catch (error) {
      this.logger.error('[RedisLock] Error force releasing lock', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}