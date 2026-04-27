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
import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Logger } from 'winston';
import { RateLimitService } from '../../decorators/rate-limit/rate-limit.service';
export declare class RateLimitInterceptor implements NestInterceptor {
    private readonly reflector;
    private readonly rateLimitService;
    private readonly logger;
    constructor(reflector: Reflector, rateLimitService: RateLimitService, logger: Logger);
    intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>>;
    /**
     * 提取客户端 IP 地址
     */
    private extractIp;
    /**
     * 提取用户 ID
     */
    private extractUserId;
    /**
     * 提取 API Key
     */
    private extractApiKey;
    /**
     * 生成 traceId (降级方案)
     */
    private generateTraceId;
    /**
     * 日志记录
     */
    private log;
}
