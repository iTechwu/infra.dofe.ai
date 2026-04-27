"use strict";
/**
 * Rate Limit Interceptor
 *
 * 业务层限流拦截器，与 RateLimitService 和 Feature Flag 集成
 *
 * 特性:
 * - 多维度限流 (IP, userId, tenantId, apiKey)
 * - Feature Flag 动态开关
 * - 白名单跳过
 * - 限流响应头
 * - 结构化日志
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
exports.RateLimitInterceptor = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const rate_limit_service_1 = require("../../decorators/rate-limit/rate-limit.service");
const rate_limit_exception_1 = require("../../decorators/rate-limit/rate-limit.exception");
const rate_limit_decorator_1 = require("../../decorators/rate-limit/rate-limit.decorator");
let RateLimitInterceptor = class RateLimitInterceptor {
    reflector;
    rateLimitService;
    logger;
    constructor(reflector, rateLimitService, logger) {
        this.reflector = reflector;
        this.rateLimitService = rateLimitService;
        this.logger = logger;
    }
    async intercept(context, next) {
        // 如果 RateLimitService 未注入，跳过限流
        if (!this.rateLimitService) {
            return next.handle();
        }
        // 检查是否标记跳过限流
        const skipRateLimit = this.reflector.get(rate_limit_decorator_1.SKIP_RATE_LIMIT_KEY, context.getHandler());
        if (skipRateLimit) {
            return next.handle();
        }
        // 获取限流配置
        const options = this.reflector.get(rate_limit_decorator_1.RATE_LIMIT_KEY, context.getHandler());
        // 无限流配置，跳过
        if (!options) {
            return next.handle();
        }
        // 检查全局限流是否启用
        const isEnabled = await this.rateLimitService.isEnabled();
        if (!isEnabled) {
            return next.handle();
        }
        // 检查 Feature Flag (端点级)
        if (options.featureFlag) {
            const flagEnabled = await this.rateLimitService.isFeatureEnabled(options.featureFlag);
            if (!flagEnabled) {
                this.log('debug', 'Rate limit skipped by feature flag', {
                    featureFlag: options.featureFlag,
                });
                return next.handle();
            }
        }
        const request = context.switchToHttp().getRequest();
        const reply = context.switchToHttp().getResponse();
        // 构建限流上下文
        const rateLimitContext = {
            ip: this.extractIp(request),
            userId: this.extractUserId(request),
            apiKey: this.extractApiKey(request),
            path: request.url,
            method: request.method,
            traceId: request.traceId || this.generateTraceId(),
            request,
        };
        // 检查白名单
        if (this.rateLimitService.isWhitelisted(rateLimitContext)) {
            this.log('debug', 'Rate limit skipped by whitelist', {
                ip: rateLimitContext.ip,
                userId: rateLimitContext.userId,
            });
            return next.handle();
        }
        // 检查自定义跳过条件
        if (options.skip) {
            const shouldSkip = typeof options.skip === 'function'
                ? await options.skip(rateLimitContext)
                : options.skip;
            if (shouldSkip) {
                return next.handle();
            }
        }
        // 执行限流检查
        const result = await this.rateLimitService.checkRateLimit(rateLimitContext, options);
        // 设置限流响应头
        reply.header('X-RateLimit-Limit', result.limit.toString());
        reply.header('X-RateLimit-Remaining', result.remaining.toString());
        reply.header('X-RateLimit-Reset', result.resetTime.toString());
        // 限流被触发
        if (!result.allowed) {
            reply.header('Retry-After', result.retryAfter.toString());
            this.log('warn', 'Rate limit exceeded', {
                traceId: rateLimitContext.traceId,
                dimension: result.dimension,
                identifier: result.identifier,
                path: rateLimitContext.path,
                method: rateLimitContext.method,
                limit: result.limit,
                userId: rateLimitContext.userId,
                ip: rateLimitContext.ip,
            });
            throw new rate_limit_exception_1.RateLimitException({
                limit: result.limit,
                remaining: result.remaining,
                resetTime: result.resetTime,
                retryAfter: result.retryAfter,
                dimension: result.dimension,
                identifier: result.identifier,
                endpoint: rateLimitContext.path,
            }, options.message);
        }
        return next.handle();
    }
    // =========================================================================
    // Private Helper Methods
    // =========================================================================
    /**
     * 提取客户端 IP 地址
     */
    extractIp(request) {
        const forwarded = request.headers['x-forwarded-for'];
        if (forwarded) {
            return (typeof forwarded === 'string' ? forwarded : forwarded[0])
                .split(',')[0]
                .trim();
        }
        const realIp = request.headers['x-real-ip'];
        if (realIp) {
            return typeof realIp === 'string' ? realIp : realIp[0];
        }
        return request.ip || '0.0.0.0';
    }
    /**
     * 提取用户 ID
     */
    extractUserId(request) {
        const req = request;
        return req.user?.id || req.userId || req.user?.userId;
    }
    /**
     * 提取 API Key
     */
    extractApiKey(request) {
        const apiKey = request.headers['x-api-key'];
        return typeof apiKey === 'string' ? apiKey : undefined;
    }
    /**
     * 生成 traceId (降级方案)
     */
    generateTraceId() {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
    /**
     * 日志记录
     */
    log(level, message, meta) {
        if (this.logger) {
            this.logger.log(level, message, meta);
        }
    }
};
exports.RateLimitInterceptor = RateLimitInterceptor;
exports.RateLimitInterceptor = RateLimitInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [core_1.Reflector,
        rate_limit_service_1.RateLimitService,
        winston_1.Logger])
], RateLimitInterceptor);
//# sourceMappingURL=rate-limit.interceptor.js.map