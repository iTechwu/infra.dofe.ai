"use strict";
/**
 * Cache Event Handler
 *
 * 处理缓存相关事件，用于缓存失效和刷新。
 * 与 RedisService 深度融合。
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
exports.CacheEventHandler = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const redis_1 = require("../../../../../redis/src");
const event_decorator_1 = require("../event.decorator");
/**
 * 团队成员变更事件 Payload
 */
let CacheEventHandler = class CacheEventHandler {
    redis;
    logger;
    constructor(redis, logger) {
        this.redis = redis;
        this.logger = logger;
    }
    /**
     * 处理通用缓存失效事件
     */
    async handleCacheInvalidated(payload) {
        try {
            if (payload.pattern) {
                // 按模式清除
                await this.invalidateByPattern(payload.cacheName, payload.pattern);
            }
            else if (payload.cacheKey) {
                // 按 key 清除
                await this.redis.deleteData(payload.cacheName, payload.cacheKey);
            }
            this.logger.debug('Cache invalidated via event', {
                cacheName: payload.cacheName,
                cacheKey: payload.cacheKey,
                pattern: payload.pattern,
                reason: payload.reason,
            });
        }
        catch (error) {
            this.logger.error('Cache invalidation error', {
                cacheName: payload.cacheName,
                error: error.message,
            });
        }
    }
    /**
     * 处理用户更新事件 - 失效用户缓存
     */
    async handleUserUpdated(payload) {
        try {
            if (payload.userId) {
                await this.redis.deleteData('userInfo', payload.userId);
                this.logger.debug('User cache invalidated', {
                    userId: payload.userId,
                    event: event_decorator_1.EventNames.USER.UPDATED,
                });
            }
        }
        catch (error) {
            this.logger.error('User cache invalidation error', {
                userId: payload.userId,
                error: error.message,
            });
        }
    }
    /**
     * 处理用户删除事件 - 失效用户缓存
     */
    async handleUserDeleted(payload) {
        try {
            if (payload.userId) {
                await this.redis.deleteData('userInfo', payload.userId);
                this.logger.debug('User cache invalidated on delete', {
                    userId: payload.userId,
                    event: event_decorator_1.EventNames.USER.DELETED,
                });
            }
        }
        catch (error) {
            this.logger.error('User cache invalidation error on delete', {
                userId: payload.userId,
                error: error.message,
            });
        }
    }
    /**
     * 按模式失效缓存
     */
    async invalidateByPattern(cacheName, pattern) {
        const fullPattern = this.redis.getRedisKey(cacheName, pattern);
        const keys = await this.scanKeys(fullPattern);
        if (keys.length > 0) {
            await Promise.all(keys.map((key) => this.redis.del(key)));
            this.logger.debug('Cache invalidated by pattern', {
                cacheName,
                pattern,
                count: keys.length,
            });
        }
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
exports.CacheEventHandler = CacheEventHandler;
__decorate([
    (0, event_emitter_1.OnEvent)(event_decorator_1.EventNames.CACHE.INVALIDATED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CacheEventHandler.prototype, "handleCacheInvalidated", null);
__decorate([
    (0, event_emitter_1.OnEvent)(event_decorator_1.EventNames.USER.UPDATED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CacheEventHandler.prototype, "handleUserUpdated", null);
__decorate([
    (0, event_emitter_1.OnEvent)(event_decorator_1.EventNames.USER.DELETED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CacheEventHandler.prototype, "handleUserDeleted", null);
exports.CacheEventHandler = CacheEventHandler = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [redis_1.RedisService,
        winston_1.Logger])
], CacheEventHandler);
//# sourceMappingURL=cache-event.handler.js.map