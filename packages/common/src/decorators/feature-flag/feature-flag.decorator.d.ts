/**
 * Feature Flag Decorators
 *
 * 提供功能开关装饰器，支持 Unleash 集成或自定义实现。
 *
 * 支持的策略:
 * - 布尔值: 简单开关
 * - 用户 ID: 基于用户的灰度
 * - 百分比: 按比例开放
 * - 环境: 基于运行环境
 * - 自定义: 自定义评估策略
 *
 * @example
 * ```typescript
 * // 简单功能开关
 * @FeatureEnabled('new-dashboard')
 * @Get('dashboard')
 * async getDashboard() { ... }
 *
 * // 条件开关 - 抛出 NotImplementedException
 * @FeatureEnabled('beta-feature', { throwIfDisabled: true })
 * async betaFeature() { ... }
 *
 * // 灰度发布 - 基于用户
 * @FeatureEnabled('premium-feature', { userIdParam: 'userId' })
 * async premiumFeature(@Param('userId') userId: string) { ... }
 * ```
 */
export declare const FEATURE_FLAG_METADATA_KEY = "feature:flag";
export declare const FEATURE_FLAGS_METADATA_KEY = "feature:flags";
/**
 * 功能开关策略类型
 */
export type FeatureFlagStrategy = 'boolean' | 'userId' | 'percentage' | 'environment' | 'custom';
/**
 * 功能开关配置选项
 */
export interface FeatureFlagOptions {
    /** 功能标识 */
    flagName: string;
    /** 策略类型，默认 'boolean' */
    strategy?: FeatureFlagStrategy;
    /**
     * 功能关闭时是否抛出异常
     * 默认: false (跳过执行，返回 null)
     */
    throwIfDisabled?: boolean;
    /**
     * 自定义错误消息
     */
    errorMessage?: string;
    /**
     * 用户 ID 参数名 (用于 userId 策略)
     */
    userIdParam?: string;
    /**
     * 开放百分比 (用于 percentage 策略，0-100)
     */
    percentage?: number;
    /**
     * 允许的环境列表 (用于 environment 策略)
     */
    environments?: string[];
    /**
     * 自定义评估函数 (用于 custom 策略)
     */
    customEvaluator?: (context: any) => boolean | Promise<boolean>;
}
/**
 * 功能开关上下文
 */
export interface FeatureFlagContext {
    /** 用户 ID */
    userId?: string;
    /** 当前环境 */
    environment?: string;
    /** 请求信息 */
    request?: any;
    /** 额外属性 */
    properties?: Record<string, any>;
}
/**
 * @FeatureEnabled - 功能开关装饰器
 *
 * 根据功能开关状态决定是否执行方法。
 *
 * @param flagName - 功能标识
 * @param options - 配置选项
 *
 * @example
 * ```typescript
 * // 简单开关
 * @FeatureEnabled('new-feature')
 * @Get()
 * async getNewFeature() { ... }
 *
 * // 抛出异常
 * @FeatureEnabled('beta', { throwIfDisabled: true, errorMessage: '功能暂未开放' })
 * async betaFeature() { ... }
 * ```
 */
export declare function FeatureEnabled(flagName: string, options?: Partial<Omit<FeatureFlagOptions, 'flagName'>>): MethodDecorator;
/**
 * @FeatureFlags - 多功能开关装饰器
 *
 * 同时检查多个功能开关，全部启用时才执行方法。
 *
 * @param flags - 功能开关配置数组
 *
 * @example
 * ```typescript
 * @FeatureFlags([
 *     { flagName: 'feature-a' },
 *     { flagName: 'feature-b', throwIfDisabled: true },
 * ])
 * async combinedFeature() { ... }
 * ```
 */
export declare function FeatureFlags(flags: Array<{
    flagName: string;
    options?: Partial<Omit<FeatureFlagOptions, 'flagName'>>;
}>): MethodDecorator;
/**
 * @IfFeatureEnabled - 条件装饰器别名
 *
 * 与 @FeatureEnabled 相同，但语义更清晰。
 * 如果功能未启用，抛出 NotFoundException。
 */
export declare function IfFeatureEnabled(flagName: string): MethodDecorator;
/**
 * @BetaFeature - Beta 功能装饰器
 *
 * 标记 Beta 功能，仅对特定用户或环境开放。
 */
export declare function BetaFeature(flagName: string, options?: {
    userIdParam?: string;
}): MethodDecorator;
/**
 * @GradualRollout - 灰度发布装饰器
 *
 * 按百分比逐步开放功能。
 */
export declare function GradualRollout(flagName: string, percentage: number): MethodDecorator;
