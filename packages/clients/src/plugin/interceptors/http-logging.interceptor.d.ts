/**
 * HTTP Logging Interceptor
 *
 * 用于记录 HTTP 客户端请求和响应的拦截器
 */
import { Logger } from 'winston';
export interface HttpLogContext {
    clientName: string;
    method: string;
    url: string;
    startTime: number;
}
/**
 * HTTP 日志拦截器配置
 */
export interface HttpLoggingConfig {
    /** 是否记录请求体 */
    logRequestBody?: boolean;
    /** 是否记录响应体 */
    logResponseBody?: boolean;
    /** 响应体最大长度 */
    maxResponseLength?: number;
    /** 敏感字段列表 (会被脱敏) */
    sensitiveFields?: string[];
}
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
export declare function createHttpLoggingInterceptor(logger: Logger, config?: HttpLoggingConfig): {
    /**
     * 记录请求开始
     */
    logRequest(context: HttpLogContext, body?: any): void;
    /**
     * 记录响应
     */
    logResponse(context: HttpLogContext, response: any, statusCode: number): void;
    /**
     * 记录错误
     */
    logError(context: HttpLogContext, error: any): void;
};
