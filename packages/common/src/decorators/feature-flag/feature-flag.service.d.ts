/**
 * Feature Flag Service
 *
 * 功能开关服务，支持多种后端实现:
 * - 内存: 开发测试用
 * - Redis: 生产环境分布式
 * - Unleash: 企业级功能管理
 *
 * 配置项 (config.local.yaml):
 * ```yaml
 * featureFlags:
 *   provider: 'redis'  # 'memory' | 'redis' | 'unleash'
 *   unleash:
 *     url: 'http://localhost:4242/api'
 *     appName: 'dofe-api'
 *     instanceId: 'instance-1'
 *   defaultFlags:
 *     new-feature: true
 *     beta-dashboard: false
 * ```
 */
import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
import { RedisService } from "../../../../redis/src";
import { FeatureFlagContext, FeatureFlagOptions } from './feature-flag.decorator';
export type FeatureFlagProvider = 'memory' | 'redis' | 'unleash';
export interface FeatureFlagRedisConfig {
    keyPrefix?: string;
    defaultTTL?: number;
}
export interface FeatureFlagConfig {
    provider: FeatureFlagProvider;
    redis?: FeatureFlagRedisConfig;
    unleash?: {
        url: string;
        appName: string;
        instanceId?: string;
        refreshInterval?: number;
        metricsInterval?: number;
    };
    defaultFlags?: Record<string, boolean>;
}
export declare class FeatureFlagService implements OnModuleInit {
    private readonly configService;
    private readonly redis;
    private readonly logger;
    private provider;
    private memoryFlags;
    private unleashClient;
    private redisKeyPrefix;
    private redisDefaultTTL;
    constructor(configService: ConfigService, redis: RedisService, logger: Logger);
    onModuleInit(): Promise<void>;
    /**
     * 初始化 Unleash 客户端
     */
    private initUnleash;
    /**
     * 检查功能是否启用
     */
    isEnabled(flagName: string, context?: FeatureFlagContext): Promise<boolean>;
    /**
     * 评估功能开关 (支持策略)
     */
    evaluate(options: FeatureFlagOptions, context?: FeatureFlagContext): Promise<boolean>;
    /**
     * 设置功能开关
     * @param flagName 功能开关名称
     * @param enabled 是否启用
     * @param ttl 过期时间 (秒), 0=使用默认TTL, -1=永不过期
     */
    setFlag(flagName: string, enabled: boolean, ttl?: number): Promise<void>;
    /**
     * 获取所有功能开关
     */
    getAllFlags(): Promise<Record<string, boolean>>;
    /**
     * 删除功能开关
     */
    deleteFlag(flagName: string): Promise<void>;
    /**
     * 获取功能开关的 TTL (秒)
     * @returns TTL 秒数, -1=永不过期, -2=不存在
     */
    getFlagTTL(flagName: string): Promise<number>;
    /**
     * 设置临时功能开关 (自动过期)
     * @param flagName 功能开关名称
     * @param enabled 是否启用
     * @param ttlSeconds 过期时间 (秒)
     */
    setTemporaryFlag(flagName: string, enabled: boolean, ttlSeconds: number): Promise<void>;
    private checkUnleash;
    private checkRedis;
    private getAllRedisFlags;
    private evaluateUserId;
    private evaluatePercentage;
    private evaluateEnvironment;
    private evaluateCustom;
}
