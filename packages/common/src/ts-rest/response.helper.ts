/**
 * ts-rest Response Helpers
 * ts-rest 响应辅助工具
 *
 * 提供标准化的响应格式：
 * - 成功响应：{ code: 200, msg: 'ok', data: ... }
 * - 错误响应：{ code: xxx, msg: 'xxxx', data: { error: ... } }
 *
 * 配合 ApiResponseSchema 定义的 Contract 使用
 */

import {
  ApiErrorCode,
  getErrorType,
  getHttpStatus,
  getErrorMessage,
} from '@dofe/infra-contracts';

/**
 * 标准成功响应格式
 */
export interface SuccessBody<T> {
  code: number;
  msg: string;
  data: T;
}

/**
 * 标准错误响应格式（用于 ts-rest，使用 data 字段）
 */
export interface ErrorBody<T = unknown> {
  code: number;
  msg: string;
  data: T;
}

/**
 * ts-rest 处理器响应类型
 */
export type TsRestResponse<T, S extends number = 200> = {
  status: S;
  body: SuccessBody<T>;
};

/**
 * ts-rest 成功响应类型（仅包含成功体）
 */
export type TsRestSuccessResponse<T, S extends number = 200> = {
  status: S;
  body: SuccessBody<T>;
};

/**
 * 创建成功响应
 *
 * @example
 * ```typescript
 * @TsRestHandler(c.getItem)
 * async getItem() {
 *   return tsRestHandler(c.getItem, async ({ params }) => {
 *     const data = await this.service.findById(params.id);
 *     return success(data);
 *   });
 * }
 * ```
 */
export function success<T>(
  data: T,
  status: 200 = 200,
): TsRestSuccessResponse<T, 200> {
  return {
    status,
    body: {
      code: 200,
      msg: 'ok',
      data: serializeDates(data),
    },
  };
}

/**
 * 创建分页成功响应
 *
 * @example
 * ```typescript
 * return paginated(items, total, query.page, query.limit);
 * ```
 */
export function paginated<T>(
  list: T[],
  total: number,
  page: number,
  limit: number,
): TsRestSuccessResponse<
  { list: T[]; total: number; page: number; limit: number },
  200
> {
  return success({ list, total, page, limit });
}

/**
 * 创建 201 响应（创建成功）
 */
export function created<T>(data: T): TsRestSuccessResponse<T, 201> {
  return {
    status: 201,
    body: {
      code: 200,
      msg: 'ok',
      data: serializeDates(data),
    },
  };
}

/**
 * 创建删除成功响应
 */
export function deleted(): TsRestResponse<{ success: boolean }, 200> {
  return {
    status: 200,
    body: {
      code: 200,
      msg: 'ok',
      data: { success: true },
    },
  };
}

// ============================================================================
// Plain NestJS Controller Helpers (不使用 ts-rest 的控制器)
// ============================================================================

/**
 * 创建成功响应体（用于普通 NestJS 控制器，不使用 ts-rest）
 *
 * @example
 * ```typescript
 * @Get('items')
 * async getItems() {
 *   const items = await this.service.findAll();
 *   return successBody({ list: items });
 * }
 * ```
 */
export function successBody<T>(data: T): SuccessBody<T> {
  return {
    code: 200,
    msg: 'ok',
    data: serializeDates(data),
  };
}

/**
 * 创建分页成功响应体（用于普通 NestJS 控制器）
 */
export function paginatedBody<T>(
  list: T[],
  total: number,
  page: number,
  limit: number,
): SuccessBody<{ list: T[]; total: number; page: number; limit: number }> {
  return successBody({ list, total, page, limit });
}

/**
 * 创建删除成功响应体（用于普通 NestJS 控制器）
 */
export function deletedBody(): SuccessBody<{ success: boolean }> {
  return {
    code: 200,
    msg: 'ok',
    data: { success: true },
  };
}

/**
 * 创建错误响应体（用于普通 NestJS 控制器）
 */
export function errorBody<T = unknown>(
  errorCode: ApiErrorCode,
  errorData?: T,
): ErrorBody<T> {
  const errorType = getErrorType(errorCode) || 'unknown';
  const numericCode = Number(errorCode);
  const msg = getErrorMessage(errorType);

  return {
    code: numericCode,
    msg,
    data: errorData as T,
  };
}

export function deletedWithData<T>(data: T): TsRestResponse<T, 200> {
  return {
    status: 200,
    body: {
      code: 200,
      msg: 'ok',
      data: serializeDates(data),
    },
  };
}

// ============================================================================
// ts-rest Error Response Helpers (类型安全的错误响应)
// ============================================================================

/**
 * HTTP Status 字面量类型
 */
type HttpStatus =
  | 200
  | 201
  | 204
  | 400
  | 401
  | 403
  | 404
  | 409
  | 410
  | 429
  | 500;

/**
 * 创建 ts-rest 错误响应（使用 data 字段，符合 ApiResponseSchema）
 *
 * 注意：此函数返回 status: 200 类型以兼容 ts-rest 类型推断。
 * 实际 HTTP 状态码由 errorCode 决定。
 *
 * @example
 * ```typescript
 * if (!item) {
 *   return error(CommonErrorCode.NotFound, { error: 'Item not found' });
 * }
 * ```
 */
export function error<T = { error: string }>(
  errorCode: ApiErrorCode,
  errorData?: T,
): { status: HttpStatus; body: SuccessBody<T> } {
  const errorType = getErrorType(errorCode) || 'unknown';
  const httpStatus = getHttpStatus(errorCode);
  const numericCode = Number(errorCode);
  const msg = getErrorMessage(errorType);

  return {
    status: httpStatus as HttpStatus,
    body: {
      code: numericCode,
      msg,
      data: errorData as T,
    },
  };
}

/**
 * 404 Not Found 错误响应（类型安全）
 *
 * @example
 * ```typescript
 * if (!item) {
 *   return notFound('Item not found');
 * }
 * ```
 */
export function notFound<T = { error: string }>(
  errorData?: T,
): { status: 404; body: SuccessBody<T> } {
  return {
    status: 404,
    body: {
      code: 905404,
      msg: getErrorMessage('notFound'),
      data: errorData as T,
    },
  };
}

/**
 * 400 Bad Request 错误响应（类型安全）
 */
export function badRequest<T = { error: string }>(
  errorData?: T,
): { status: 400; body: SuccessBody<T> } {
  return {
    status: 400,
    body: {
      code: 900400,
      msg: getErrorMessage('badRequest'),
      data: errorData as T,
    },
  };
}

/**
 * 401 Unauthorized 错误响应（类型安全）
 */
export function unauthorized<T = { error: string }>(
  errorData?: T,
): { status: 401; body: SuccessBody<T> } {
  return {
    status: 401,
    body: {
      code: 923402,
      msg: getErrorMessage('unAuthorized'),
      data: errorData as T,
    },
  };
}

/**
 * 403 Forbidden 错误响应（类型安全）
 */
export function forbidden<T = { error: string }>(
  errorData?: T,
): { status: 403; body: SuccessBody<T> } {
  return {
    status: 403,
    body: {
      code: 924403,
      msg: getErrorMessage('unauthorizedByKey'),
      data: errorData as T,
    },
  };
}

/**
 * 409 Conflict 错误响应（类型安全）
 */
export function conflict<T = { error: string }>(
  errorData?: T,
): { status: 409; body: SuccessBody<T> } {
  return {
    status: 409,
    body: {
      code: 900403,
      msg: getErrorMessage('featureAlreadyExists'),
      data: errorData as T,
    },
  };
}

/**
 * 500 Internal Server Error 响应（类型安全）
 */
export function internalError<T = { error: string }>(
  errorData?: T,
): { status: 500; body: SuccessBody<T> } {
  return {
    status: 500,
    body: {
      code: 900500,
      msg: getErrorMessage('innerError'),
      data: errorData as T,
    },
  };
}

/**
 * 从错误码创建符合 Contract 标准的错误响应
 *
 * 与 error() 相同，提供更好的语义化命名。
 *
 * @example
 * ```typescript
 * if (!item) {
 *   return errorResponse(CommonErrorCode.NotFound, { error: 'Item not found' });
 * }
 * ```
 */
export function errorResponse<T = { error: string }>(
  errorCode: ApiErrorCode,
  errorData?: T,
): { status: HttpStatus; body: SuccessBody<T> } {
  return error(errorCode, errorData);
}

/**
 * 从错误类型字符串创建错误响应
 *
 * @example
 * ```typescript
 * return errorFromType('userNotFound', 200401, 404);
 * ```
 */
export function errorFromType<T = unknown>(
  errorType: string,
  errorCode: number,
  httpStatus: HttpStatus = 400,
  errorData?: T,
): { status: HttpStatus; body: SuccessBody<T> } {
  const msg = getErrorMessage(errorType);

  return {
    status: httpStatus,
    body: {
      code: errorCode,
      msg,
      data: errorData as T,
    },
  };
}

/**
 * 创建简单错误响应（不带 error 详情）
 */
export function errorSimple(
  code: number,
  msg: string,
  httpStatus: HttpStatus = 400,
): { status: HttpStatus; body: SuccessBody<unknown> } {
  return {
    status: httpStatus,
    body: {
      code,
      msg,
      data: undefined,
    },
  };
}

/**
 * 递归地将对象中的 Date 类型转换为 ISO 字符串
 * 用于确保 ts-rest 响应符合 zod schema（Date 字段定义为 z.coerce.date()）
 *
 * @example
 * ```typescript
 * const data = await this.service.findById(id);
 * return success(serializeDates(data));
 * ```
 */
export function serializeDates<T>(obj: T): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return obj.toISOString() as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => serializeDates(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeDates(value);
    }
    return result as T;
  }

  return obj;
}

/**
 * 安全获取数据 - 如果查询抛出 NotFoundException 则返回 null
 * 用于配合 notFound() 辅助函数，简化类型安全的错误处理
 *
 * @example
 * ```typescript
 * const result = await fetchOrNull(() =>
 *   this.service.findById(params.id),
 * );
 * if (result === null) return notFound({ error: 'Item not found' });
 * return success(result);
 * ```
 */
export async function fetchOrNull<T>(
  fn: () => Promise<T>,
): Promise<T | null> {
  try {
    return await fn();
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      (error as { name: string }).name === 'NotFoundException'
    ) {
      return null;
    }
    throw error;
  }
}
