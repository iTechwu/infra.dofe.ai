/**
 * ApiException - Enhanced exception using @repo/contracts
 * 增强版 ApiException，使用 @repo/contracts 中的错误定义
 */
import { HttpException } from '@nestjs/common';
import { ApiErrorCode } from "@repo/contracts/errors";
export declare class ApiException extends HttpException {
    readonly errorCode: ApiErrorCode;
    readonly errorType: string;
    readonly errorData: unknown;
    readonly domain: string;
    /**
     * Create exception from error type string (backward compatible)
     * 从错误类型字符串创建异常（向后兼容）
     */
    constructor(errorType: string, data?: unknown);
    /**
     * Create exception from error code (recommended)
     * 从错误码创建异常（推荐方式）
     */
    static fromCode(errorCode: ApiErrorCode, data?: unknown): ApiException;
    /**
     * Get error code
     */
    getErrorCode(): ApiErrorCode;
    /**
     * Get error message without i18n (fallback)
     */
    getErrorMessageWithoutI18n(): string;
    /**
     * Get localized error message using i18n
     * 使用 i18n 获取本地化错误消息
     *
     * Uses namespace: errors.{domain}.{errorType}
     */
    getErrorMessage(i18n: any): string;
    /**
     * Get error data
     */
    getErrorData(): unknown;
    /**
     * Get error type
     */
    getErrorType(): string;
    /**
     * Convert to JSON response format
     * 转换为 JSON 响应格式
     *
     * Note: `code` is numeric for backward compatibility
     * `error.errorCode` is string for type safety
     */
    toJSON(): {
        code: number;
        msg: string;
        data: null;
        error: {
            errorCode: string;
            errorType: string;
            errorData: unknown;
        };
    };
}
/**
 * Helper function to throw ApiException from error code
 * 从错误码抛出 ApiException 的辅助函数
 *
 * @example
 * throw apiError(UserErrorCode.UserNotFound);
 * throw apiError(UserErrorCode.InvalidPassword, { attempts: 3 });
 */
export declare function apiError(errorCode: ApiErrorCode, data?: unknown): ApiException;
