/**
 * Cache Interceptor
 *
 * 拦截器实现，处理 @Cacheable, @CacheEvict, @CachePut 装饰器的缓存逻辑。
 * 与 RedisService 深度融合，使用 config.local.yaml 中的 redis 配置。
 */
import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Logger } from 'winston';
import { RedisService } from "../../../../redis/src";
export declare class CacheInterceptor implements NestInterceptor {
    private readonly reflector;
    private readonly redis;
    private readonly logger;
    constructor(reflector: Reflector, redis: RedisService, logger: Logger);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
    /**
     * 处理 @Cacheable 逻辑
     */
    private handleCacheable;
    /**
     * 处理 @CachePut 逻辑
     */
    private handleCachePut;
    /**
     * 执行缓存失效
     */
    private evictCache;
    /**
     * 生成缓存 key
     */
    private generateCacheKey;
    /**
     * 生成失效缓存 key
     */
    private generateEvictKey;
    /**
     * 扫描匹配 pattern 的所有 keys
     */
    private scanKeys;
}
