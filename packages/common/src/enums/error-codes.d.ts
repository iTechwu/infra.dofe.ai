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
export { ApiErrorCode, UserErrorCode, CommonErrorCode, AllErrorTypes, AllErrorHttpStatus, getErrorType, getHttpStatus, } from "@repo/contracts/errors";
/**
 * Error Message Definition Type
 * Note: errorCode is now a string but numeric representation is kept for backward compatibility
 */
export interface ErrorMessageDefinition {
    errorCode: number;
    httpStatus: number;
    message: string;
}
/**
 * ErrorMessageEnums - Backward compatible mapping
 * 向后兼容的错误消息映射
 *
 * @deprecated Use @repo/contracts/errors directly for new code
 */
export declare const ErrorMessageEnums: Record<string, ErrorMessageDefinition>;
/**
 * Type for ErrorMessageEnums keys
 */
export type ErrorType = keyof typeof ErrorMessageEnums;
