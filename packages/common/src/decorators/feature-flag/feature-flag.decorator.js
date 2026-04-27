"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEATURE_FLAGS_METADATA_KEY = exports.FEATURE_FLAG_METADATA_KEY = void 0;
exports.FeatureEnabled = FeatureEnabled;
exports.FeatureFlags = FeatureFlags;
exports.IfFeatureEnabled = IfFeatureEnabled;
exports.BetaFeature = BetaFeature;
exports.GradualRollout = GradualRollout;
const common_1 = require("@nestjs/common");
// ============================================================================
// Constants
// ============================================================================
exports.FEATURE_FLAG_METADATA_KEY = 'feature:flag';
exports.FEATURE_FLAGS_METADATA_KEY = 'feature:flags';
// ============================================================================
// Decorators
// ============================================================================
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
function FeatureEnabled(flagName, options) {
    const flagOptions = {
        flagName,
        strategy: 'boolean',
        throwIfDisabled: false,
        ...options,
    };
    return (0, common_1.SetMetadata)(exports.FEATURE_FLAG_METADATA_KEY, flagOptions);
}
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
function FeatureFlags(flags) {
    const flagConfigs = flags.map((f) => ({
        flagName: f.flagName,
        strategy: 'boolean',
        throwIfDisabled: false,
        ...f.options,
    }));
    return (0, common_1.SetMetadata)(exports.FEATURE_FLAGS_METADATA_KEY, flagConfigs);
}
/**
 * @IfFeatureEnabled - 条件装饰器别名
 *
 * 与 @FeatureEnabled 相同，但语义更清晰。
 * 如果功能未启用，抛出 NotFoundException。
 */
function IfFeatureEnabled(flagName) {
    return FeatureEnabled(flagName, { throwIfDisabled: true });
}
/**
 * @BetaFeature - Beta 功能装饰器
 *
 * 标记 Beta 功能，仅对特定用户或环境开放。
 */
function BetaFeature(flagName, options) {
    return FeatureEnabled(flagName, {
        strategy: 'userId',
        throwIfDisabled: true,
        errorMessage: 'Beta 功能暂未对您开放',
        ...options,
    });
}
/**
 * @GradualRollout - 灰度发布装饰器
 *
 * 按百分比逐步开放功能。
 */
function GradualRollout(flagName, percentage) {
    return FeatureEnabled(flagName, {
        strategy: 'percentage',
        percentage,
        throwIfDisabled: true,
        errorMessage: '功能正在逐步开放中',
    });
}
//# sourceMappingURL=feature-flag.decorator.js.map