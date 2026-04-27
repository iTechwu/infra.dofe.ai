/**
 * Rate Limit Decorator
 *
 * 限流装饰器，支持方法级别的细粒度限流控制
 *
 * @example
 * // 基础用法: 每分钟 100 次
 * @RateLimit({ limit: 100, window: 60 })
 * async createPost() { ... }
 *
 * // 按用户限流
 * @RateLimit({ limit: 50, window: 60, dimension: 'userId' })
 * async submitFeedback() { ... }
 *
 * // 按租户限流 (适用于 SaaS)
 * @RateLimit({ limit: 1000, window: 60, dimension: 'tenantId' })
 * async batchExport() { ... }
 *
 * // 结合 Feature Flag 动态控制
 * @RateLimit({ limit: 100, window: 60, featureFlag: 'rate-limit-export' })
 * async postExport() { ... }
 */
import { RateLimitOptions } from './dto/rate-limit.dto';
export declare const RATE_LIMIT_KEY = "rate_limit";
export declare const SKIP_RATE_LIMIT_KEY = "skip_rate_limit";
/**
 * @RateLimit - 限流装饰器
 *
 * 对方法应用限流控制，支持多维度和动态配置
 *
 * @param options - 限流配置选项
 * @returns MethodDecorator
 *
 * @example
 * ```typescript
 * // 标准限流
 * @RateLimit({ limit: 100, window: 60 })
 * async createPost() { ... }
 *
 * // 按 API Key 限流
 * @RateLimit({ limit: 500, window: 60, dimension: 'apiKey' })
 * async externalApiCall() { ... }
 *
 * // 自定义错误消息
 * @RateLimit({
 *     limit: 10,
 *     window: 60,
 *     dimension: 'userId',
 *     message: '发送消息过于频繁，请稍后再试',
 * })
 * async sendMessage() { ... }
 * ```
 */
export declare function RateLimit(options: RateLimitOptions): MethodDecorator;
/**
 * @SkipRateLimit - 跳过限流
 *
 * 标记方法跳过业务层限流检查（入口限流仍然生效）
 *
 * @example
 * ```typescript
 * @SkipRateLimit()
 * async healthCheck() { ... }
 * ```
 */
export declare function SkipRateLimit(): MethodDecorator;
/**
 * 预设限流策略
 *
 * 提供常用场景的快捷装饰器
 */
export declare const RateLimitPresets: {
    /**
     * 高频接口: 每分钟 200 次
     * 适用于: 列表查询、搜索
     */
    high: () => MethodDecorator;
    /**
     * 标准接口: 每分钟 100 次
     * 适用于: 常规 CRUD 操作
     */
    standard: () => MethodDecorator;
    /**
     * 低频接口: 每分钟 20 次
     * 适用于: 创建、更新操作
     */
    low: () => MethodDecorator;
    /**
     * 敏感操作: 每分钟 5 次
     * 适用于: 密码修改、邮箱验证
     */
    sensitive: () => MethodDecorator;
    /**
     * API Key 限流: 每分钟 1000 次
     * 适用于: 开放 API
     */
    apiKey: (limit?: number) => MethodDecorator;
    /**
     * 租户限流: 每分钟 2000 次
     * 适用于: SaaS 多租户场景
     */
    tenant: (limit?: number) => MethodDecorator;
    /**
     * 严格限流: 每小时 10 次
     * 适用于: 注册、重置密码
     */
    strict: () => MethodDecorator;
    /**
     * AI 生成限流: 每分钟 10 次
     * 适用于: AI 内容生成
     */
    aiGeneration: () => MethodDecorator;
};
/**
 * @RateLimitHigh - 高频接口限流 (200/分钟)
 */
export declare const RateLimitHigh: () => MethodDecorator;
/**
 * @RateLimitStandard - 标准接口限流 (100/分钟)
 */
export declare const RateLimitStandard: () => MethodDecorator;
/**
 * @RateLimitLow - 低频接口限流 (20/分钟)
 */
export declare const RateLimitLow: () => MethodDecorator;
/**
 * @RateLimitSensitive - 敏感操作限流 (5/分钟)
 */
export declare const RateLimitSensitive: () => MethodDecorator;
/**
 * @RateLimitStrict - 严格限流 (10/小时)
 */
export declare const RateLimitStrict: () => MethodDecorator;
