/**
 * Redis cache key configuration interface
 * Used for configuring named cache keys with expiration
 */
export interface RedisCacheKeyConfig {
  name: string;
  key: string;
  expireIn?: number;
}

export const REDIS_AUTH = Symbol('REDIS:AUTH');