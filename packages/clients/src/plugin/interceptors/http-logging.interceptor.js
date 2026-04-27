"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHttpLoggingInterceptor = createHttpLoggingInterceptor;
const utils_1 = require("@repo/utils");
/**
 * 创建 HTTP 日志拦截器
 *
 * @example
 * ```typescript
 * const interceptor = createHttpLoggingInterceptor(logger, {
 *     logRequestBody: true,
 *     sensitiveFields: ['password', 'apiKey'],
 * });
 * ```
 */
function createHttpLoggingInterceptor(logger, config = {}) {
    const { logRequestBody = false, logResponseBody = false, maxResponseLength = 1000, sensitiveFields = ['password', 'apiKey', 'secretKey', 'token'], } = config;
    /**
     * 脱敏处理 - 使用 @repo/utils 的 maskUtil
     */
    const maskSensitiveData = (data) => {
        if (!data || typeof data !== 'object')
            return data;
        return utils_1.maskUtil.object(data, sensitiveFields);
    };
    /**
     * 截断响应体
     */
    const truncateResponse = (data) => {
        const str = typeof data === 'string' ? data : JSON.stringify(data);
        if (str.length > maxResponseLength) {
            return str.substring(0, maxResponseLength) + '...(truncated)';
        }
        return str;
    };
    return {
        /**
         * 记录请求开始
         */
        logRequest(context, body) {
            const logData = {
                client: context.clientName,
                method: context.method,
                url: context.url,
            };
            if (logRequestBody && body) {
                logData.body = maskSensitiveData(body);
            }
            logger.info('HTTP Client Request', logData);
        },
        /**
         * 记录响应
         */
        logResponse(context, response, statusCode) {
            const duration = Date.now() - context.startTime;
            const logData = {
                client: context.clientName,
                method: context.method,
                url: context.url,
                statusCode,
                duration: `${duration}ms`,
            };
            if (logResponseBody && response) {
                logData.response = truncateResponse(response);
            }
            logger.info('HTTP Client Response', logData);
        },
        /**
         * 记录错误
         */
        logError(context, error) {
            const duration = Date.now() - context.startTime;
            logger.error('HTTP Client Error', {
                client: context.clientName,
                method: context.method,
                url: context.url,
                duration: `${duration}ms`,
                error: error.message || error,
                statusCode: error.response?.status,
            });
        },
    };
}
//# sourceMappingURL=http-logging.interceptor.js.map