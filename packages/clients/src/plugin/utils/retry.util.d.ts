/**
 * Retry Utility
 *
 * 提供 API 调用重试功能
 */
export interface RetryOptions {
    /** 最大重试次数 */
    maxRetries?: number;
    /** 基础延迟时间 (ms) */
    baseDelay?: number;
    /** 最大延迟时间 (ms) */
    maxDelay?: number;
    /** 是否使用指数退避 */
    exponentialBackoff?: boolean;
    /** 重试条件判断函数 */
    shouldRetry?: (error: any, attempt: number) => boolean;
    /** 重试时的回调 */
    onRetry?: (error: any, attempt: number) => void;
}
/**
 * 带重试的异步函数执行器
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *     () => httpService.get('/api/data'),
 *     { maxRetries: 3, baseDelay: 1000 }
 * );
 * ```
 */
export declare function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
/**
 * 创建可重试的函数包装器
 *
 * @example
 * ```typescript
 * const retryableRequest = createRetryable(
 *     (url: string) => httpService.get(url),
 *     { maxRetries: 3 }
 * );
 * const result = await retryableRequest('/api/data');
 * ```
 */
export declare function createRetryable<T extends (...args: any[]) => Promise<any>>(fn: T, options?: RetryOptions): T;
/**
 * 批量请求并发控制
 */
export declare function batchRequest<T, R>(items: T[], handler: (item: T) => Promise<R>, concurrency?: number): Promise<R[]>;
