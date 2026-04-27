"use strict";
/**
 * Retry Utility
 *
 * 提供 API 调用重试功能
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRetry = withRetry;
exports.createRetryable = createRetryable;
exports.batchRequest = batchRequest;
const DEFAULT_OPTIONS = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    exponentialBackoff: true,
    shouldRetry: (error) => {
        // 默认重试网络错误和 5xx 错误
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            return true;
        }
        const status = error.response?.status;
        return status >= 500 && status < 600;
    },
    onRetry: () => { },
};
/**
 * 计算延迟时间
 */
function calculateDelay(attempt, baseDelay, maxDelay, exponentialBackoff) {
    if (!exponentialBackoff) {
        return baseDelay;
    }
    // 指数退避 + 抖动
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, maxDelay);
}
/**
 * 延迟执行
 */
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
async function withRetry(fn, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError;
    for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            // 如果是最后一次尝试或不应该重试，直接抛出
            if (attempt > opts.maxRetries || !opts.shouldRetry(error, attempt)) {
                throw error;
            }
            // 计算延迟并等待
            const delayMs = calculateDelay(attempt, opts.baseDelay, opts.maxDelay, opts.exponentialBackoff);
            opts.onRetry(error, attempt);
            await delay(delayMs);
        }
    }
    throw lastError;
}
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
function createRetryable(fn, options = {}) {
    return ((...args) => withRetry(() => fn(...args), options));
}
/**
 * 批量请求并发控制
 */
async function batchRequest(items, handler, concurrency = 5) {
    const results = [];
    const executing = [];
    for (const item of items) {
        const p = handler(item).then((result) => {
            results.push(result);
        });
        executing.push(p);
        if (executing.length >= concurrency) {
            await Promise.race(executing);
            executing.splice(executing.findIndex((e) => e === p), 1);
        }
    }
    await Promise.all(executing);
    return results;
}
//# sourceMappingURL=retry.util.js.map