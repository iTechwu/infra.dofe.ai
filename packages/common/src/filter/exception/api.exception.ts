/**
 * ApiException - Enhanced exception using @repo/contracts
 * 增强版 ApiException，使用 @repo/contracts 中的错误定义
 */

import { HttpException } from '@nestjs/common';
import {
  ApiErrorCode,
  AllErrorTypes,
  getErrorType,
  getHttpStatus,
  getErrorMessage,
} from '@dofe/infra-contracts';

// Domain mapping for i18n namespace
const ERROR_DOMAIN_MAP: Record<string, string> = {
  // Auth errors (2000xx)
  '2000': 'auth',
  // User errors (2004xx-2094xx)
  '2004': 'user',
  '2005': 'user',
  '2064': 'user',
  '2074': 'user',
  '2084': 'user',
  '2094': 'user',
  // Tenant errors (3xx)
  '30': 'tenant',
  // Common errors (9xx)
  '90': 'common',
  '91': 'common',
  '92': 'common',
  '99': 'common',
};

function getDomainFromCode(errorCode: string): string {
  for (let len = 4; len >= 2; len--) {
    const prefix = errorCode.slice(0, len);
    if (ERROR_DOMAIN_MAP[prefix]) return ERROR_DOMAIN_MAP[prefix];
  }
  return 'common';
}

/**
 * 把 errorData 压成单行摘要写入 exception.message。
 *
 * 背景：message 此前恒为空串（i18n 展示走 getErrorMessage/toJSON），
 * 但异常传播到日志、测试与堆栈时只剩 "ApiException: "——Prisma 的
 * 原始错误码/消息/字段全部丢失，排障时只能看到空壳。摘要上限 500
 * 字符，展示路径不受影响。
 */
function summarizeErrorData(data: unknown): string {
  if (data === null || data === undefined) return '';
  let text: string;
  if (typeof data === 'string') {
    text = data;
  } else if (typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof record.description === 'string') parts.push(record.description);
    if (typeof record.prismaCode === 'string') parts.push(`prismaCode=${record.prismaCode}`);
    if (record.model) parts.push(`model=${String(record.model)}`);
    if (Array.isArray(record.fields) && record.fields.length > 0) {
      parts.push(`fields=${record.fields.join(',')}`);
    }
    if (typeof record.originalMessage === 'string') {
      parts.push(record.originalMessage.replace(/\s+/g, ' ').trim());
    }
    if (parts.length === 0) {
      try {
        text = JSON.stringify(data);
      } catch {
        text = '';
      }
    } else {
      text = parts.join(' | ');
    }
  } else {
    text = String(data);
  }
  text = text.replace(/\s+/g, ' ').trim();
  return text.length > 500 ? `${text.slice(0, 497)}...` : text;
}


export class ApiException extends HttpException {
  public readonly errorCode: ApiErrorCode;
  public readonly errorType: string;
  public readonly errorData: unknown;
  public readonly domain: string;

  /**
   * Create exception from error type string (backward compatible)
   * 从错误类型字符串创建异常（向后兼容）
   */
  constructor(errorType: string, data: unknown = null) {
    // Find error code from type
    const entry = Object.entries(AllErrorTypes).find(
      ([, type]) => type === errorType,
    );

    if (!entry) {
      throw new Error(`Unknown error type: ${errorType}`);
    }

    const errorCode = entry[0] as ApiErrorCode;
    const httpStatus = getHttpStatus(errorCode);

    super('', httpStatus);

    this.errorCode = errorCode;
    this.errorType = errorType;
    this.errorData = data;
    this.domain = getDomainFromCode(errorCode);
    this.name = 'ApiException';

    // 可诊断性：把 errorData 摘要写进 message（此前恒为空串）。i18n
    // 展示走 getErrorMessage/toJSON，不受影响；日志、测试与堆栈则能
    // 直接看到原始错误上下文。
    const summary = summarizeErrorData(data);
    if (summary) this.message = `${errorType}: ${summary}`;
  }

  /**
   * Create exception from error code (recommended)
   * 从错误码创建异常（推荐方式）
   */
  static fromCode(errorCode: ApiErrorCode, data: unknown = null): ApiException {
    const errorType = getErrorType(errorCode);
    if (!errorType) {
      throw new Error(`Unknown error code: ${errorCode}`);
    }
    return new ApiException(errorType, data);
  }

  /**
   * Get error code
   */
  getErrorCode(): ApiErrorCode {
    return this.errorCode;
  }

  /**
   * Get error message without i18n (fallback)
   */
  getErrorMessageWithoutI18n(): string {
    return getErrorMessage(this.errorType);
  }

  /**
   * Get localized error message using i18n
   * 使用 i18n 获取本地化错误消息
   *
   * Uses namespace: errors.{domain}.{errorType}
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getErrorMessage(i18n: any): string {
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
  getErrorData(): unknown {
    return this.errorData;
  }

  /**
   * Get error type
   */
  getErrorType(): string {
    return this.errorType;
  }

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
  } {
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

/**
 * Helper function to throw ApiException from error code
 * 从错误码抛出 ApiException 的辅助函数
 *
 * @example
 * throw apiError(UserErrorCode.UserNotFound);
 * throw apiError(UserErrorCode.InvalidPassword, { attempts: 3 });
 */
export function apiError(
  errorCode: ApiErrorCode,
  data: unknown = null,
): ApiException {
  return ApiException.fromCode(errorCode, data);
}

/**
 * 获取适合写入日志的短错误信息（单行，避免堆栈刷屏）
 * ApiException 的 message 为空，需用 errorCode/errorType 或 getErrorMessageWithoutI18n()
 */
export function getLoggableErrorMessage(error: unknown): string {
  if (error instanceof ApiException) {
    const msg = error.getErrorMessageWithoutI18n();
    return msg
      ? `${error.errorCode}: ${msg}`
      : `${error.errorCode}: ${error.errorType}`;
  }
  if (error instanceof Error) {
    return (
      error.message || error.stack?.split('\n')[0]?.trim() || 'Unknown error'
    );
  }
  return String(error ?? 'Unknown error');
}
