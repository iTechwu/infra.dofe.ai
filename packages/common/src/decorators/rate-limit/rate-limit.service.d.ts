/**
 * Rate Limit Service
 *
 * 限流服务，使用 Redis Sorted Set 实现滑动窗口算法
 *
 * 特性:
 * - 多维度限流 (IP, userId, tenantId, apiKey)
 * - Redis 分布式存储
 * - Feature Flag 动态开关
 * - 白名单支持
 * - 结构化日志和监控
 *
 * 配置项 (config.local.yaml):
 * ```yaml
 * rateLimit:
 *   enabled: true
 *   featureFlag: 'rate-limit-enabled'
 *   default:
 *     limit: 100
 *     window: 60
 *   dimensions:
 *     ip: { limit: 200, window: 60 }
 *     userId: { limit: 500, window: 60 }
 *     tenantId: { limit: 2000, window: 60 }
 *     apiKey: { limit: 1000, window: 60 }
 *   redis:
 *     keyPrefix: 'dofe:ratelimit:'
 *   whitelist:
 *     ips: ['127.0.0.1', '::1']
 *     userIds: []
 *     apiKeys: []
 * ```
 */
import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
import { RedisService } from "../../../../redis/src";
import { FeatureFlagService } from '../feature-flag/feature-flag.service';
import { RateLimitContext, RateLimitOptions, RateLimitResult } from './dto/rate-limit.dto';
export declare class RateLimitService implements OnModuleInit {
    private readonly configService;
    private readonly redis;
    private readonly featureFlagService;
    private readonly logger;
    private config;
    private keyPrefix;
    constructor(configService: ConfigService, redis: RedisService, featureFlagService: FeatureFlagService, logger: Logger);
    onModuleInit(): Promise<void>;
    /**
     * 检查限流是否启用
     */
    isEnabled(): Promise<boolean>;
    /**
     * 检查特定 Feature Flag 是否启用
     */
    isFeatureEnabled(flagName: string): Promise<boolean>;
    /**
     * 检查是否在白名单中
     */
    isWhitelisted(context: RateLimitContext): boolean;
    /**
     * 执行限流检查
     *
     * @param context 限流上下文
     * @param options 限流选项
     * @returns 限流检查结果
     */
    checkRateLimit(context: RateLimitContext, options: RateLimitOptions): Promise<RateLimitResult>;
    /**
     * 获取当前的限流状态 (不增加计数)
     */
    getRateLimitStatus(context: RateLimitContext, options: RateLimitOptions): Promise<RateLimitResult>;
    /**
     * 重置限流计数
     */
    resetRateLimit(context: RateLimitContext, options: RateLimitOptions): Promise<void>;
    /**
     * 自动选择最佳限流维度
     * 优先级: apiKey > userId > tenantId > ip
     */
    private selectBestDimension;
    /**
     * 获取维度的标识符值
     */
    private getIdentifier;
    /**
     * 生成 Redis key
     *
     * 格式: {prefix}{dimension}:{identifier}:{normalizedPath}
     * 例如: dofe:ratelimit:userId:user-123:/api/export
     */
    private generateKey;
    /**
     * 获取维度配置
     */
    private getDimensionConfig;
    /**
     * 记录限流事件
     */
    private logEvent;
}
