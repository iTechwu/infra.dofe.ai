/**
 * Rate Limit Exception
 *
 * 限流异常类，当请求超过限制时抛出
 * 响应格式与 HttpExceptionFilter 保持一致
 */
import { HttpException } from '@nestjs/common';
import { RateLimitInfo } from './dto/rate-limit.dto';
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
export declare class RateLimitException extends HttpException {
    readonly rateLimitInfo: RateLimitInfo;
    constructor(info: RateLimitInfo, message?: string);
    /**
     * 获取限流详情
     */
    getRateLimitInfo(): RateLimitInfo;
    /**
     * 获取重试等待时间（秒）
     */
    getRetryAfter(): number;
    /**
     * 获取响应头
     */
    getHeaders(): Record<string, string>;
}
