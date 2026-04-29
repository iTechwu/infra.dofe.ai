import { Injectable, OnModuleDestroy, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

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
export class CacheService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly logger: LoggerLike;

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject('WINSTON_LOGGER') winstonLogger?: LoggerLike,
  ) {
    this.logger = winstonLogger ?? consoleLogger;
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(key, ttl, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async getByPattern(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  getClient(): Redis {
    return this.redis;
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}