"use strict";
/**
 * Error Codes Bridge File
 * 错误码桥接文件
 *
 * Re-exports error codes from @repo/contracts and provides
 * backward-compatible ErrorMessageEnums for existing code.
 *
 * Migration Guide:
 * - New code: import { UserErrorCode } from '@repo/contracts/errors';
 * - New code: import { apiError } from '@/filter/exception/api.exception';
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorMessageEnums = exports.getHttpStatus = exports.getErrorType = exports.AllErrorHttpStatus = exports.AllErrorTypes = exports.CommonErrorCode = exports.UserErrorCode = exports.ApiErrorCode = void 0;
// Re-export all error codes from @repo/contracts
var errors_1 = require("@repo/contracts/errors");
Object.defineProperty(exports, "ApiErrorCode", { enumerable: true, get: function () { return errors_1.ApiErrorCode; } });
Object.defineProperty(exports, "UserErrorCode", { enumerable: true, get: function () { return errors_1.UserErrorCode; } });
Object.defineProperty(exports, "CommonErrorCode", { enumerable: true, get: function () { return errors_1.CommonErrorCode; } });
Object.defineProperty(exports, "AllErrorTypes", { enumerable: true, get: function () { return errors_1.AllErrorTypes; } });
Object.defineProperty(exports, "AllErrorHttpStatus", { enumerable: true, get: function () { return errors_1.AllErrorHttpStatus; } });
Object.defineProperty(exports, "getErrorType", { enumerable: true, get: function () { return errors_1.getErrorType; } });
Object.defineProperty(exports, "getHttpStatus", { enumerable: true, get: function () { return errors_1.getHttpStatus; } });
const errors_2 = require("@repo/contracts/errors");
/**
 * Generate ErrorMessageEnums from @repo/contracts
 * 从 @repo/contracts 生成 ErrorMessageEnums
 *
 * This provides backward compatibility with the old error system.
 * The message is just the errorType - actual messages come from i18n.
 */
function generateErrorMessageEnums() {
    const result = {};
    for (const [codeStr, errorType] of Object.entries(errors_2.AllErrorTypes)) {
        const code = Number(codeStr);
        const httpStatus = errors_2.AllErrorHttpStatus[codeStr] ?? 200;
        result[errorType] = {
            errorCode: code,
            httpStatus,
            message: errorType, // Message comes from i18n, this is just fallback
        };
    }
    return result;
}
/**
 * ErrorMessageEnums - Backward compatible mapping
 * 向后兼容的错误消息映射
 *
 * @deprecated Use @repo/contracts/errors directly for new code
 */
exports.ErrorMessageEnums = generateErrorMessageEnums();
//# sourceMappingURL=error-codes.js.map