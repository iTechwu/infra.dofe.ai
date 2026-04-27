"use strict";
/**
 * Cache Interceptor
 *
 * 拦截器实现，处理 @Cacheable, @CacheEvict, @CachePut 装饰器的缓存逻辑。
 * 与 RedisService 深度融合，使用 config.local.yaml 中的 redis 配置。
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheInterceptor = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const redis_1 = require("../../../../redis/src");
const cache_decorator_1 = require("./cache.decorator");
let CacheInterceptor = class CacheInterceptor {
    reflector;
    redis;
    logger;
    constructor(reflector, redis, logger) {
        this.reflector = reflector;
        this.redis = redis;
        this.logger = logger;
    }
    intercept(context, next) {
        const handler = context.getHandler();
        // 检查是否有缓存元数据
        const cacheOptions = this.reflector.get(cache_decorator_1.CACHE_METADATA_KEY, handler);
        const evictOptions = this.reflector.get(cache_decorator_1.CACHE_EVICT_METADATA_KEY, handler);
        const putOptions = this.reflector.get(cache_decorator_1.CACHE_PUT_METADATA_KEY, handler);
        // 获取方法参数
        const args = context.getArgs();
        // 处理 @CacheEvict (beforeInvocation)
        if (evictOptions?.beforeInvocation) {
            this.evictCache(evictOptions, args);
        }
        // 处理 @Cacheable
        if (cacheOptions) {
            return this.handleCacheable(cacheOptions, args, next);
        }
        // 处理 @CachePut
        if (putOptions) {
            return this.handleCachePut(putOptions, args, next);
        }
        // 处理 @CacheEvict (afterInvocation)
        if (evictOptions && !evictOptions.beforeInvocation) {
            return next.handle().pipe((0, operators_1.tap)(() => {
                this.evictCache(evictOptions, args);
            }));
        }
        return next.handle();
    }
    /**
     * 处理 @Cacheable 逻辑
     */
    handleCacheable(options, args, next) {
        const cacheKey = this.generateCacheKey(options, args);
        return (0, rxjs_1.from)(this.redis.getData(options.cacheName, cacheKey)).pipe((0, operators_1.switchMap)((cachedValue) => {
            if (cachedValue !== null && cachedValue !== undefined) {
                this.logger.debug('Cache hit', {
                    cacheName: options.cacheName,
                    cacheKey,
                });
                return (0, rxjs_1.of)(cachedValue);
            }
            this.logger.debug('Cache miss', {
                cacheName: options.cacheName,
                cacheKey,
            });
            return next.handle().pipe((0, operators_1.tap)((result) => {
                // 检查条件
                const shouldCache = options.condition
                    ? options.condition(result)
                    : result !== null && result !== undefined;
                if (shouldCache) {
                    this.redis
                        .saveData(options.cacheName, cacheKey, result, options.ttl)
                        .catch((err) => {
                        this.logger.error('Cache save error', {
                            cacheName: options.cacheName,
                            cacheKey,
                            error: err.message,
                        });
                    });
                }
            }));
        }));
    }
    /**
     * 处理 @CachePut 逻辑
     */
    handleCachePut(options, args, next) {
        const cacheKey = this.generateCacheKey(options, args);
        return next.handle().pipe((0, operators_1.tap)((result) => {
            const shouldCache = options.condition
                ? options.condition(result)
                : result !== null && result !== undefined;
            if (shouldCache) {
                this.redis
                    .saveData(options.cacheName, cacheKey, result, options.ttl)
                    .catch((err) => {
                    this.logger.error('Cache put error', {
                        cacheName: options.cacheName,
                        cacheKey,
                        error: err.message,
                    });
                });
            }
        }));
    }
    /**
     * 执行缓存失效
     */
    async evictCache(options, args) {
        try {
            if (options.allEntries) {
                // 清除所有匹配 cacheName 的缓存
                const pattern = this.redis.getRedisKey(options.cacheName, '*');
                const keys = await this.scanKeys(pattern);
                if (keys.length > 0) {
                    await Promise.all(keys.map((key) => this.redis.del(key)));
                    this.logger.debug('Cache evicted (all entries)', {
                        cacheName: options.cacheName,
                        count: keys.length,
                    });
                }
            }
            else if (options.evictByPrefix) {
                // 使用前缀模式清除缓存
                // 生成的 key 作为前缀，清除所有以该前缀开头的缓存
                const keyPrefix = this.generateEvictKey(options, args);
                const pattern = this.redis.getRedisKey(options.cacheName, `${keyPrefix}*`);
                const keys = await this.scanKeys(pattern);
                if (keys.length > 0) {
                    await Promise.all(keys.map((key) => this.redis.del(key)));
                    this.logger.debug('Cache evicted (by prefix)', {
                        cacheName: options.cacheName,
                        keyPrefix,
                        pattern,
                        count: keys.length,
                    });
                }
                else {
                    // 即使没有找到带后缀的 key，也尝试删除精确匹配的 key
                    await this.redis.deleteData(options.cacheName, keyPrefix);
                    this.logger.debug('Cache evicted (exact match, no prefix entries found)', {
                        cacheName: options.cacheName,
                        cacheKey: keyPrefix,
                    });
                }
            }
            else {
                // 精确匹配删除
                const cacheKey = this.generateEvictKey(options, args);
                await this.redis.deleteData(options.cacheName, cacheKey);
                this.logger.debug('Cache evicted', {
                    cacheName: options.cacheName,
                    cacheKey,
                });
            }
        }
        catch (err) {
            this.logger.error('Cache evict error', {
                cacheName: options.cacheName,
                error: err.message,
            });
        }
    }
    /**
     * 生成缓存 key
     */
    generateCacheKey(options, args) {
        const keyGenerator = options.keyGenerator || cache_decorator_1.defaultKeyGenerator;
        return keyGenerator(...args);
    }
    /**
     * 生成失效缓存 key
     */
    generateEvictKey(options, args) {
        const keyGenerator = options.keyGenerator || cache_decorator_1.defaultKeyGenerator;
        return keyGenerator(...args);
    }
    /**
     * 扫描匹配 pattern 的所有 keys
     */
    async scanKeys(pattern) {
        const keys = [];
        let cursor = '0';
        do {
            const result = await this.redis.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = result[0];
            keys.push(...result[1]);
        } while (cursor !== '0');
        return keys;
    }
};
exports.CacheInterceptor = CacheInterceptor;
exports.CacheInterceptor = CacheInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [core_1.Reflector,
        redis_1.RedisService,
        winston_1.Logger])
], CacheInterceptor);
//# sourceMappingURL=cache.interceptor.js.map