/**
 * Rate Limit Constants
 *
 * 限流相关的常量定义
 *
 * 注意：此文件独立于 decorator 和 interceptor，避免循环依赖
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * 限流配置的元数据 key
 */
export const RATE_LIMIT_KEY = 'rate_limit';

/**
 * 跳过限流的元数据 key
 */
export const SKIP_RATE_LIMIT_KEY = 'skip_rate_limit';
