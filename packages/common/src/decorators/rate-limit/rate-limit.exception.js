"use strict";
/**
 * Rate Limit Exception
 *
 * 限流异常类，当请求超过限制时抛出
 * 响应格式与 HttpExceptionFilter 保持一致
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitException = void 0;
const common_1 = require("@nestjs/common");
/**
 * 限流异常
 *
 * @example
 * throw new RateLimitException({
 *   limit: 100,
 *   remaining: 0,
 *   resetTime: 1703577600,
 *   retryAfter: 60,
 *   dimension: 'userId',
 *   identifier: 'user-123',
 *   endpoint: '/api/export',
 * });
 */
class RateLimitException extends common_1.HttpException {
    rateLimitInfo;
    constructor(info, message) {
        const errorMessage = message || 'Too many requests, please try again later';
        super({
            code: 925429,
            msg: errorMessage,
            error: {
                limit: info.limit,
                remaining: info.remaining,
                resetTime: info.resetTime,
                retryAfter: info.retryAfter,
                dimension: info.dimension,
            },
        }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        this.rateLimitInfo = info;
    }
    /**
     * 获取限流详情
     */
    getRateLimitInfo() {
        return this.rateLimitInfo;
    }
    /**
     * 获取重试等待时间（秒）
     */
    getRetryAfter() {
        return this.rateLimitInfo.retryAfter;
    }
    /**
     * 获取响应头
     */
    getHeaders() {
        return {
            'X-RateLimit-Limit': this.rateLimitInfo.limit.toString(),
            'X-RateLimit-Remaining': this.rateLimitInfo.remaining.toString(),
            'X-RateLimit-Reset': this.rateLimitInfo.resetTime.toString(),
            'Retry-After': this.rateLimitInfo.retryAfter.toString(),
        };
    }
}
exports.RateLimitException = RateLimitException;
//# sourceMappingURL=rate-limit.exception.js.map