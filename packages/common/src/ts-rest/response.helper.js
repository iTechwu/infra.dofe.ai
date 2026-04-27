"use strict";
/**
 * ts-rest Response Helpers
 * ts-rest 响应辅助工具
 *
 * 提供标准化的响应格式：
 * - 成功响应：{ code: 200, msg: 'ok', data: ... }
 * - 错误响应：{ code: xxx, msg: 'xxxx', error?: ... }
 *
 * 配合 createApiResponse 定义的 Contract 使用
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.success = success;
exports.paginated = paginated;
exports.created = created;
exports.deleted = deleted;
exports.deletedWithData = deletedWithData;
exports.error = error;
exports.errorFromType = errorFromType;
exports.errorSimple = errorSimple;
exports.serializeDates = serializeDates;
exports.notFound = notFound;
exports.fetchOrNull = fetchOrNull;
const errors_1 = require("@repo/contracts/errors");
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
function success(data, status = 200) {
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
function paginated(list, total, page, limit) {
    return success({ list, total, page, limit });
}
/**
 * 创建 201 响应（创建成功）
 */
function created(data) {
    return {
        status: 201,
        body: {
            code: 201,
            msg: 'created',
            data: serializeDates(data),
        },
    };
}
/**
 * 创建删除成功响应
 */
function deleted() {
    return {
        status: 200,
        body: {
            code: 200,
            msg: 'ok',
            data: { success: true },
        },
    };
}
function deletedWithData(data) {
    return {
        status: 200,
        body: {
            code: 200,
            msg: 'ok',
            data: serializeDates(data),
        },
    };
}
/**
 * 从错误码创建错误响应
 *
 * @example
 * ```typescript
 * if (!item) {
 *   return error(CommonErrorCode.NotFound);
 * }
 * ```
 */
function error(errorCode, errorData) {
    const errorType = (0, errors_1.getErrorType)(errorCode) || 'unknown';
    const httpStatus = (0, errors_1.getHttpStatus)(errorCode);
    const numericCode = Number(errorCode);
    const msg = (0, errors_1.getErrorMessage)(errorType);
    return {
        status: httpStatus,
        body: {
            code: numericCode,
            msg,
            error: errorData,
        },
    };
}
/**
 * 从错误类型字符串创建错误响应
 *
 * @example
 * ```typescript
 * return errorFromType('userNotFound', 200401, 404);
 * ```
 */
function errorFromType(errorType, errorCode, httpStatus = 400, errorData) {
    const msg = (0, errors_1.getErrorMessage)(errorType);
    return {
        status: httpStatus,
        body: {
            code: errorCode,
            msg,
            error: errorData,
        },
    };
}
/**
 * 创建简单错误响应（不带 error 详情）
 */
function errorSimple(code, msg, httpStatus = 400) {
    return {
        status: httpStatus,
        body: {
            code,
            msg,
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
function serializeDates(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (obj instanceof Date) {
        return obj.toISOString();
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => serializeDates(item));
    }
    if (typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = serializeDates(value);
        }
        return result;
    }
    return obj;
}
// ============================================================================
// 404 Not Found Helpers
// ============================================================================
/**
 * 创建 404 Not Found 响应
 *
 * @param resourceName - 资源名称（可选），用于错误消息
 * @returns 404 响应对象
 *
 * @example
 * ```typescript
 * const item = await this.service.findById(params.id);
 * if (!item) return notFound('Provider key');
 * return success(item);
 * ```
 */
function notFound(resourceName) {
    const msg = resourceName ? `${resourceName} not found` : 'Resource not found';
    return {
        status: 404,
        body: {
            error: msg,
        },
    };
}
/**
 * 工具函数：安全获取资源，如果不存在则返回 404
 *
 * @param fetcher - 获取资源的异步函数
 * @param resourceName - 资源名称（可选）
 * @returns 资源或 null（表示需要返回 404）
 *
 * @example
 * ```typescript
 * @TsRestHandler(c.providerKeys.get)
 * async getById() {
 *   return tsRestHandler(c.providerKeys.get, async ({ params }) => {
 *     const result = await fetchOrNotFound(
 *       () => this.service.findById(params.id),
 *       'Provider key'
 *     );
 *     if (result === null) return notFound('Provider key');
 *     return success(result);
 *   });
 * }
 * ```
 */
async function fetchOrNull(fetcher) {
    const result = await fetcher();
    if (result === null || result === undefined) {
        return null;
    }
    return result;
}
//# sourceMappingURL=response.helper.js.map