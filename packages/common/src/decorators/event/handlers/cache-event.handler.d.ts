/**
 * Cache Event Handler
 *
 * 处理缓存相关事件，用于缓存失效和刷新。
 * 与 RedisService 深度融合。
 */
import { Logger } from 'winston';
import { RedisService } from "../../../../../redis/src";
/**
 * 缓存失效事件 Payload
 */
export interface CacheInvalidatedPayload {
    cacheName: string;
    cacheKey?: string;
    pattern?: string;
    reason?: string;
    timestamp: Date;
}
/**
 * 用户更新事件 Payload
 */
export interface UserUpdatedPayload {
    userId: string;
    user?: any;
    timestamp: Date;
}
/**
 * 团队成员变更事件 Payload
 */
export declare class CacheEventHandler {
    private readonly redis;
    private readonly logger;
    constructor(redis: RedisService, logger: Logger);
    /**
     * 处理通用缓存失效事件
     */
    handleCacheInvalidated(payload: CacheInvalidatedPayload): Promise<void>;
    /**
     * 处理用户更新事件 - 失效用户缓存
     */
    handleUserUpdated(payload: UserUpdatedPayload): Promise<void>;
    /**
     * 处理用户删除事件 - 失效用户缓存
     */
    handleUserDeleted(payload: UserUpdatedPayload): Promise<void>;
    /**
     * 按模式失效缓存
     */
    private invalidateByPattern;
    /**
     * 扫描匹配 pattern 的所有 keys
     */
    private scanKeys;
}
