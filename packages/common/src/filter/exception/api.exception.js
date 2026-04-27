"use strict";
/**
 * ApiException - Enhanced exception using @repo/contracts
 * 增强版 ApiException，使用 @repo/contracts 中的错误定义
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiException = void 0;
exports.apiError = apiError;
const common_1 = require("@nestjs/common");
const errors_1 = require("@repo/contracts/errors");
// Domain mapping for i18n namespace
const ERROR_DOMAIN_MAP = {
    // User errors (2xx)
    '20': 'user',
    '21': 'user',
    // Common errors (9xx)
    '90': 'common',
    '91': 'common',
    '92': 'common',
    '99': 'common',
};
function getDomainFromCode(errorCode) {
    const prefix = errorCode.slice(0, 2);
    return ERROR_DOMAIN_MAP[prefix] || 'common';
}
class ApiException extends common_1.HttpException {
    errorCode;
    errorType;
    errorData;
    domain;
    /**
     * Create exception from error type string (backward compatible)
     * 从错误类型字符串创建异常（向后兼容）
     */
    constructor(errorType, data = null) {
        // Find error code from type
        const entry = Object.entries(errors_1.AllErrorTypes).find(([, type]) => type === errorType);
        if (!entry) {
            throw new Error(`Unknown error type: ${errorType}`);
        }
        const errorCode = entry[0];
        const httpStatus = (0, errors_1.getHttpStatus)(errorCode);
        const message = (0, errors_1.getErrorMessage)(errorType);
        super('', httpStatus);
        this.errorCode = errorCode;
        this.errorType = errorType;
        this.errorData = data;
        this.domain = getDomainFromCode(errorCode);
        this.name = 'ApiException';
    }
    /**
     * Create exception from error code (recommended)
     * 从错误码创建异常（推荐方式）
     */
    static fromCode(errorCode, data = null) {
        const errorType = (0, errors_1.getErrorType)(errorCode);
        if (!errorType) {
            throw new Error(`Unknown error code: ${errorCode}`);
        }
        return new ApiException(errorType, data);
    }
    /**
     * Get error code
     */
    getErrorCode() {
        return this.errorCode;
    }
    /**
     * Get error message without i18n (fallback)
     */
    getErrorMessageWithoutI18n() {
        return (0, errors_1.getErrorMessage)(this.errorType);
    }
    /**
     * Get localized error message using i18n
     * 使用 i18n 获取本地化错误消息
     *
     * Uses namespace: errors.{domain}.{errorType}
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getErrorMessage(i18n) {
        // Use errors.{domain}.{errorType} namespace
        const key = `errors.${this.domain}.${this.errorType}`;
        const message = i18n.t(key, { lang: i18n.lang });
        if (message && message !== key) {
            return message;
        }
        // Fallback to error type
        return this.getErrorMessageWithoutI18n() || this.errorType || '';
    }
    /**
     * Get error data
     */
    getErrorData() {
        return this.errorData;
    }
    /**
     * Get error type
     */
    getErrorType() {
        return this.errorType;
    }
    /**
     * Convert to JSON response format
     * 转换为 JSON 响应格式
     *
     * Note: `code` is numeric for backward compatibility
     * `error.errorCode` is string for type safety
     */
    toJSON() {
        return {
            code: Number(this.errorCode),
            msg: this.errorType,
            data: null,
            error: {
                errorCode: this.errorCode,
                errorType: this.errorType,
                errorData: this.errorData,
            },
        };
    }
}
exports.ApiException = ApiException;
/**
 * Helper function to throw ApiException from error code
 * 从错误码抛出 ApiException 的辅助函数
 *
 * @example
 * throw apiError(UserErrorCode.UserNotFound);
 * throw apiError(UserErrorCode.InvalidPassword, { attempts: 3 });
 */
function apiError(errorCode, data = null) {
    return ApiException.fromCode(errorCode, data);
}
//# sourceMappingURL=api.exception.js.map