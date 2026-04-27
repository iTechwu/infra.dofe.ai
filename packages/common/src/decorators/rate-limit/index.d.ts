/**
 * Rate Limit Module Exports
 *
 * 统一导出限流模块的所有组件
 *
 * @example
 * ```typescript
 * import {
 *     RateLimit,
 *     RateLimitPresets,
 *     SkipRateLimit,
 *     RateLimitService,
 *     RateLimitException,
 *     RateLimitModule,
 * } from '@/decorators/rate-limit';
 * ```
 */
export { RateLimit, SkipRateLimit, RateLimitPresets, RateLimitHigh, RateLimitStandard, RateLimitLow, RateLimitSensitive, RateLimitStrict, RATE_LIMIT_KEY, SKIP_RATE_LIMIT_KEY, } from './rate-limit.decorator';
export { RateLimitService } from './rate-limit.service';
export { RateLimitException } from './rate-limit.exception';
export { RateLimitModule } from './rate-limit.module';
export type { RateLimitOptions, RateLimitContext, RateLimitResult, RateLimitInfo, RateLimitDimension, RateLimitConfig, RateLimitDimensionConfig, RateLimitWhitelist, RateLimitRedisConfig, RateLimitEvent, } from './dto/rate-limit.dto';
