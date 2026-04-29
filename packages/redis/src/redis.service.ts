import { Injectable, Inject, OnModuleDestroy, Optional } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_AUTH, RedisCacheKeyConfig } from './dto/redis.dto';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import type { Logger } from 'winston';

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

@Injectable()
export class RedisService implements OnModuleDestroy {
  private redisConfigs: Record<string, RedisCacheKeyConfig> = {};
  private lastClosedLogTime = 0;
  private readonly CLOSED_LOG_THROTTLE_MS = 5000;
  private readonly logger: Logger | typeof consoleLogger;

  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_AUTH) private readonly redisClient: Redis,
    @Optional() @Inject('WINSTON_LOGGER') winstonLogger?: Logger,
  ) {
    this.logger = winstonLogger ?? consoleLogger;
    const configs =
      this.configService.get<RedisCacheKeyConfig[]>('redis') ?? [];
    configs.forEach((config) => {
      this.redisConfigs[config.name] = config;
    });
  }

  private isConnectionAvailable(): boolean {
    if (!this.redisClient) {
      return false;
    }
    const status = this.redisClient.status;
    return status === 'ready' || status === 'connect';
  }

  private shouldLogClosedError(): boolean {
    const now = Date.now();
    if (now - this.lastClosedLogTime > this.CLOSED_LOG_THROTTLE_MS) {
      this.lastClosedLogTime = now;
      return true;
    }
    return false;
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      try {
        if (
          this.redisClient.status !== 'end' &&
          this.redisClient.status !== 'close'
        ) {
          await this.redisClient.quit();
        }
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('closed')) {
          if (isProduction()) {
            this.logger.error('Error closing Redis connection', { error });
          } else {
            this.logger.debug('Error closing Redis connection', { error });
          }
        }
      }
    }
    if (isProduction()) {
      this.logger.info('Redis service destroyed');
    } else {
      this.logger.debug('Redis service destroyed');
    }
  }

  get redis() {
    return this.redisClient;
  }

  getExpireIn(name: string) {
    return this.redisConfigs[name]?.expireIn ?? -1;
  }

  getRedisKey(name: string, key: string): string {
    return this.redisConfigs[name]?.key + key;
  }

  async saveDataToList(name: string, key: string, value: any) {
    const redisKey = this.redisConfigs[name]?.key + key;
    if (!this.isConnectionAvailable()) {
      return;
    }
    try {
      await this.redis.rpush(redisKey, JSON.stringify(value));
    } catch (error) {
      if (error instanceof Error && error.message.includes('closed')) {
        if (this.shouldLogClosedError()) {
          if (isProduction()) {
            this.logger.warn('Redis connection closed, saveDataToList failed');
          } else {
            this.logger.debug('Redis connection closed, saveDataToList failed', { error });
          }
        }
      } else {
        if (isProduction()) {
          this.logger.error('Redis saveDataToList error:', { error });
        } else {
          this.logger.debug('Redis saveDataToList error:', { error });
        }
      }
    }
  }

  async getListData(name: string, key: string): Promise<any[]> {
    const redisKey = this.redisConfigs[name]?.key + key;
    if (!this.isConnectionAvailable()) {
      return [];
    }
    try {
      const data = await this.redis.lrange(redisKey, 0, -1);
      return data.length > 0 ? data.map((item) => JSON.parse(item)) : [];
    } catch (error) {
      if (error instanceof Error && error.message.includes('closed')) {
        if (this.shouldLogClosedError()) {
          if (isProduction()) {
            this.logger.warn('Redis connection closed, getListData failed');
          } else {
            this.logger.debug('Redis connection closed, getListData failed', { error });
          }
        }
      } else {
        if (isProduction()) {
          this.logger.error('Redis getListData error:', { error });
        } else {
          this.logger.debug('Redis getListData error:', { error });
        }
      }
      return [];
    }
  }

  async pushDataToList(
    name: string,
    key: string,
    value: any,
    expireIn?: number,
  ) {
    const redisKey = this.redisConfigs[name]?.key + key;
    expireIn = expireIn ?? this.redisConfigs[name]?.expireIn ?? -1;
    if (!this.isConnectionAvailable()) {
      return;
    }
    try {
      await this.redis.lpush(redisKey, JSON.stringify(value));
      if (expireIn > 0) {
        await this.expire(redisKey, expireIn);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('closed')) {
        if (this.shouldLogClosedError()) {
          if (isProduction()) {
            this.logger.warn('Redis connection closed, pushDataToList failed');
          } else {
            this.logger.debug('Redis connection closed, pushDataToList failed', { error });
          }
        }
      } else {
        if (isProduction()) {
          this.logger.error('Redis pushDataToList error:', { error });
        } else {
          this.logger.debug('Redis pushDataToList error:', { error });
        }
      }
    }
  }

  async pushDatasToList(
    name: string,
    key: string,
    values: any[],
    expireIn?: number,
  ) {
    const redisKey = this.redisConfigs[name]?.key + key;
    const stringifiedValues = values.map((v) => JSON.stringify(v));
    expireIn = expireIn ?? this.redisConfigs[name]?.expireIn ?? -1;
    if (!this.isConnectionAvailable()) {
      return;
    }
    try {
      await this.redis.lpush(redisKey, ...stringifiedValues);
      if (expireIn > 0) {
        await this.expire(redisKey, expireIn);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('closed')) {
        if (this.shouldLogClosedError()) {
          if (isProduction()) {
            this.logger.warn('Redis connection closed, pushDatasToList failed');
          } else {
            this.logger.debug('Redis connection closed, pushDatasToList failed', { error });
          }
        }
      } else {
        if (isProduction()) {
          this.logger.error('Redis pushDatasToList error:', { error });
        } else {
          this.logger.debug('Redis pushDatasToList error:', { error });
        }
      }
    }
  }

  async saveData(name: string, key: string, value: any, expireIn?: number) {
    const redisKey = this.redisConfigs[name]?.key + key;
    expireIn = expireIn ?? this.redisConfigs[name]?.expireIn ?? -1;
    return await this.set(redisKey, value, { EX: expireIn });
  }

  async getData(name: string, key: string) {
    const redisKey = this.redisConfigs[name]?.key + key;
    return await this.get(redisKey);
  }

  async deleteData(name: string, key: string) {
    const redisKey = this.redisConfigs[name]?.key + key;
    return await this.del(redisKey);
  }

  async incrData(name: string, key: string) {
    const redisKey = this.redisConfigs[name]?.key + key;
    return await this.incr(redisKey);
  }

  async decrData(name: string, key: string) {
    const redisKey = this.redisConfigs[name]?.key + key;
    return await this.decr(redisKey);
  }

  async incrbyData(name: string, key: string, increment: number) {
    const redisKey = this.redisConfigs[name]?.key + key;
    return await this.incrby(redisKey, increment);
  }

  async decrbyData(name: string, key: string, decrement: number) {
    const redisKey = this.redisConfigs[name]?.key + key;
    return await this.decrby(redisKey, decrement);
  }

  async saveKeyFirstFileId(key: string, fileId: string): Promise<any> {
    return await this.saveData('fileSystemFildId', key, fileId);
  }

  async getKeyFirstFileId(key: string) {
    return await this.getData('fileSystemFildId', key);
  }

  async saveQiniuUploadAuthKey(key: string) {
    const traceID = uuidv4();
    await this.saveData('fileSystemCallbackAuth', key, traceID);
    return traceID;
  }

  async checkQiniuUploadAuthKey(key: string, authToken: string): Promise<boolean> {
    const token = await this.getData('fileSystemCallbackAuth', key);
    return token === authToken;
  }

  async setShortCode(key: string, value: any) {
    return await this.saveData('shortCode', key, value);
  }

  async getShortCode(key: string) {
    return await this.getData('shortCode', key);
  }

  async saveProviderOauthNonce(name: string, state: string, nonce: any, expiresIn: number): Promise<void> {
    const redisKey = 'dofe:oauth:' + name + ':nonce-' + state;
    await this.set(redisKey, nonce, { EX: expiresIn });
  }

  async getProviderOauthNonce(name: string, state: string) {
    const redisKey = 'dofe:oauth:' + name + ':nonce-' + state;
    return await this.get(redisKey);
  }

  async deleteProviderOauthNonce(name: string, state: string) {
    const redisKey = 'dofe:oauth:' + name + ':nonce-' + state;
    await this.del(redisKey);
  }

  async saveProviderState(provider: string, state: string, expiresIn: number): Promise<void> {
    const redisKey = 'dofe:oauth:' + provider + ':state';
    await this.set(redisKey, state, { EX: expiresIn });
  }

  async getProviderState(provider: string, state: string) {
    const redisKey = 'dofe:oauth:' + provider + ':state';
    return await this.get(redisKey);
  }

  async deleteProviderState(provider: string) {
    const redisKey = 'dofe:oauth:' + provider + ':state';
    await this.del(redisKey);
  }

  async set(key: string, value: any, options?: { EX: number }) {
    if (!this.redisClient || !this.isConnectionAvailable()) {
      return null;
    }
    try {
      const args: [string, string, ...string[]] = [
        key,
        typeof value === 'number' ? value.toString() : JSON.stringify(value),
      ];
      if (options?.EX && options.EX > 0) {
        return await this.redisClient.set(key, args[1], 'EX', options.EX.toString());
      } else {
        return await this.redisClient.set(key, args[1]);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('closed')) {
        if (this.shouldLogClosedError()) {
          if (isProduction()) {
            this.logger.warn('Redis connection closed, set operation failed');
          } else {
            this.logger.debug('Redis connection closed, set operation failed', { error });
          }
        }
      } else {
        if (isProduction()) {
          this.logger.error('Redis set error:', { error });
        } else {
          this.logger.debug('Redis set error:', { error });
        }
      }
      return null;
    }
  }

  async setNX(key: string, value: any, options: { EX: number }): Promise<string | null> {
    if (!this.redisClient || !this.isConnectionAvailable()) {
      return null;
    }
    try {
      const result = await (this.redisClient as any).set(
        key,
        typeof value === 'number' ? value.toString() : JSON.stringify(value),
        'NX',
        'EX',
        options.EX,
      );
      return result as string | null;
    } catch (error) {
      if (error instanceof Error && error.message.includes('closed')) {
        if (this.shouldLogClosedError()) {
          if (isProduction()) {
            this.logger.warn('Redis connection closed, setNX operation failed');
          } else {
            this.logger.debug('Redis connection closed, setNX operation failed', { error });
          }
        }
      } else {
        if (isProduction()) {
          this.logger.error('Redis setNX error:', { error });
        } else {
          this.logger.debug('Redis setNX error:', { error });
        }
      }
      return null;
    }
  }

  async get(key: string) {
    if (!this.redisClient || !this.isConnectionAvailable()) {
      return null;
    }
    try {
      const value = await this.redisClient.get(key);
      if (value === null) return null;
      if (typeof value === 'number') return value;
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('closed')) {
        if (this.shouldLogClosedError()) {
          if (isProduction()) {
            this.logger.warn('Redis connection closed, returning null');
          } else {
            this.logger.debug('Redis connection closed, returning null', { error });
          }
        }
      } else {
        if (isProduction()) {
          this.logger.error('Redis get error:', { error });
        } else {
          this.logger.debug('Redis get error:', { error });
        }
      }
      return null;
    }
  }

  async del(key: string) {
    if (!this.redisClient || !this.isConnectionAvailable()) {
      return null;
    }
    try {
      return await this.redisClient.del(key);
    } catch (error) {
      if (error instanceof Error && error.message.includes('closed')) {
        if (this.shouldLogClosedError()) {
          if (isProduction()) {
            this.logger.warn('Redis connection closed, del operation failed');
          } else {
            this.logger.debug('Redis connection closed, del operation failed', { error });
          }
        }
      } else {
        if (isProduction()) {
          this.logger.error('Redis del error:', { error });
        } else {
          this.logger.debug('Redis del error:', { error });
        }
      }
      return null;
    }
  }

  async incr(key: string) {
    if (!this.redisClient || !this.isConnectionAvailable()) {
      return null;
    }
    try {
      return await this.redisClient.incr(key);
    } catch (error) {
      if (error instanceof Error && error.message.includes('closed')) {
        if (this.shouldLogClosedError()) {
          if (isProduction()) {
            this.logger.warn('Redis connection closed, incr operation failed');
          } else {
            this.logger.debug('Redis connection closed, incr operation failed', { error });
          }
        }
      } else {
        if (isProduction()) {
          this.logger.error('Redis incr error:', { error });
        } else {
          this.logger.debug('Redis incr error:', { error });
        }
      }
      return null;
    }
  }

  async incrby(key: string, increment: number) {
    if (!this.redisClient || !this.isConnectionAvailable()) {
      return null;
    }
    try {
      return await this.redisClient.incrby(key, increment);
    } catch (error) {
      if (error instanceof Error && error.message.includes('closed')) {
        if (this.shouldLogClosedError()) {
          if (isProduction()) {
            this.logger.warn('Redis connection closed, incrby operation failed');
          } else {
            this.logger.debug('Redis connection closed, incrby operation failed', { error });
          }
        }
      } else {
        if (isProduction()) {
          this.logger.error('Redis incrby error:', { error });
        } else {
          this.logger.debug('Redis incrby error:', { error });
        }
      }
      return null;
    }
  }

  async decr(key: string) {
    if (!this.redisClient || !this.isConnectionAvailable()) {
      return null;
    }
    try {
      return await this.redisClient.decr(key);
    } catch (error) {
      if (error instanceof Error && error.message.includes('closed')) {
        if (this.shouldLogClosedError()) {
          if (isProduction()) {
            this.logger.warn('Redis connection closed, decr operation failed');
          } else {
            this.logger.debug('Redis connection closed, decr operation failed', { error });
          }
        }
      } else {
        if (isProduction()) {
          this.logger.error('Redis decr error:', { error });
        } else {
          this.logger.debug('Redis decr error:', { error });
        }
      }
      return null;
    }
  }

  async decrby(key: string, decrement: number) {
    if (!this.redisClient || !this.isConnectionAvailable()) {
      return null;
    }
    try {
      return await this.redisClient.decrby(key, decrement);
    } catch (error) {
      if (error instanceof Error && error.message.includes('closed')) {
        if (this.shouldLogClosedError()) {
          if (isProduction()) {
            this.logger.warn('Redis connection closed, decrby operation failed');
          } else {
            this.logger.debug('Redis connection closed, decrby operation failed', { error });
          }
        }
      } else {
        if (isProduction()) {
          this.logger.error('Redis decrby error:', { error });
        } else {
          this.logger.debug('Redis decrby error:', { error });
        }
      }
      return null;
    }
  }

  async expire(key: string, seconds: number) {
    if (!this.redisClient || !this.isConnectionAvailable()) {
      return null;
    }
    try {
      return await this.redisClient.expire(key, seconds);
    } catch (error) {
      if (error instanceof Error && error.message.includes('closed')) {
        if (this.shouldLogClosedError()) {
          if (isProduction()) {
            this.logger.warn('Redis connection closed, expire operation failed');
          } else {
            this.logger.debug('Redis connection closed, expire operation failed', { error });
          }
        }
      } else {
        if (isProduction()) {
          this.logger.error('Redis expire error:', { error });
        } else {
          this.logger.debug('Redis expire error:', { error });
        }
      }
      return null;
    }
  }

  async ttl(key: string) {
    if (!this.redisClient || !this.isConnectionAvailable()) {
      return null;
    }
    try {
      return await this.redisClient.ttl(key);
    } catch (error) {
      if (error instanceof Error && error.message.includes('closed')) {
        if (this.shouldLogClosedError()) {
          if (isProduction()) {
            this.logger.warn('Redis connection closed, ttl operation failed');
          } else {
            this.logger.debug('Redis connection closed, ttl operation failed', { error });
          }
        }
      } else {
        if (isProduction()) {
          this.logger.error('Redis ttl error:', { error });
        } else {
          this.logger.debug('Redis ttl error:', { error });
        }
      }
      return null;
    }
  }

  async exists(key: string) {
    if (!this.redisClient || !this.isConnectionAvailable()) {
      return null;
    }
    try {
      return await this.redisClient.exists(key);
    } catch (error) {
      if (error instanceof Error && error.message.includes('closed')) {
        if (this.shouldLogClosedError()) {
          if (isProduction()) {
            this.logger.warn('Redis connection closed, exists operation failed');
          } else {
            this.logger.debug('Redis connection closed, exists operation failed', { error });
          }
        }
      } else {
        if (isProduction()) {
          this.logger.error('Redis exists error:', { error });
        } else {
          this.logger.debug('Redis exists error:', { error });
        }
      }
      return null;
    }
  }

  async deleteByPattern(pattern: string): Promise<number> {
    if (!this.redisClient || !this.isConnectionAvailable()) {
      return 0;
    }
    try {
      let cursor = '0';
      let deletedCount = 0;
      const batchSize = 100;

      do {
        const [newCursor, keys] = await this.redisClient.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          batchSize,
        );
        cursor = newCursor;

        if (keys.length > 0) {
          const deleted = await this.redisClient.del(...keys);
          deletedCount += deleted;
        }
      } while (cursor !== '0');

      if (deletedCount > 0) {
        this.logger.info(`Deleted ${deletedCount} keys matching pattern: ${pattern}`);
      }

      return deletedCount;
    } catch (error) {
      if (error instanceof Error && error.message.includes('closed')) {
        if (this.shouldLogClosedError()) {
          if (isProduction()) {
            this.logger.warn('Redis connection closed, deleteByPattern operation failed');
          } else {
            this.logger.debug('Redis connection closed, deleteByPattern operation failed', { error });
          }
        }
      } else {
        if (isProduction()) {
          this.logger.error('Redis deleteByPattern error:', { error, pattern });
        } else {
          this.logger.debug('Redis deleteByPattern error:', { error, pattern });
        }
      }
      return 0;
    }
  }

  async pipeline(
    commands: (pipeline: ReturnType<typeof this.redisClient.pipeline>) => void[],
  ): Promise<unknown[]> {
    if (!this.redisClient || !this.isConnectionAvailable()) {
      return [];
    }

    try {
      const pipeline = this.redisClient.pipeline();
      commands(pipeline);
      const results = await pipeline.exec();

      if (!results) {
        return [];
      }

      return results.map(([error, result]) => {
        if (error) {
          this.logger.error('Pipeline command error:', { error });
          return null;
        }
        return result;
      });
    } catch (error) {
      if (isProduction()) {
        this.logger.error('Redis pipeline error:', { error });
      } else {
        this.logger.debug('Redis pipeline error:', { error });
      }
      return [];
    }
  }

  async pipelineSave(
    items: Array<{
      name: string;
      key: string;
      value: unknown;
      expireIn?: number;
    }>,
  ): Promise<void> {
    if (!this.redisClient || !this.isConnectionAvailable() || items.length === 0) {
      return;
    }

    try {
      const pipeline = this.redisClient.pipeline();

      for (const item of items) {
        const redisKey = this.redisConfigs[item.name]?.key + item.key;
        const expireIn = item.expireIn ?? this.redisConfigs[item.name]?.expireIn ?? -1;
        const value =
          typeof item.value === 'number'
            ? item.value.toString()
            : JSON.stringify(item.value);

        if (expireIn > 0) {
          pipeline.set(redisKey, value, 'EX', expireIn);
        } else {
          pipeline.set(redisKey, value);
        }
      }

      await pipeline.exec();
    } catch (error) {
      if (isProduction()) {
        this.logger.error('Redis pipelineSave error:', { error });
      } else {
        this.logger.debug('Redis pipelineSave error:', { error });
      }
    }
  }

  async pipelineGet(
    items: Array<{ name: string; key: string }>,
  ): Promise<Map<string, unknown>> {
    const result = new Map<string, unknown>();

    if (!this.redisClient || !this.isConnectionAvailable() || items.length === 0) {
      return result;
    }

    try {
      const pipeline = this.redisClient.pipeline();
      const keys: string[] = [];

      for (const item of items) {
        const redisKey = this.redisConfigs[item.name]?.key + item.key;
        keys.push(`${item.name}:${item.key}`);
        pipeline.get(redisKey);
      }

      const results = await pipeline.exec();

      if (!results) {
        return result;
      }

      results.forEach(([error, value], index) => {
        if (error) {
          this.logger.debug(`Pipeline get error for key ${keys[index]}:`, { error });
          return;
        }

        if (value === null) return;

        try {
          result.set(keys[index], JSON.parse(value as string));
        } catch {
          result.set(keys[index], value);
        }
      });

      return result;
    } catch (error) {
      if (isProduction()) {
        this.logger.error('Redis pipelineGet error:', { error });
      } else {
        this.logger.debug('Redis pipelineGet error:', { error });
      }
      return result;
    }
  }
}