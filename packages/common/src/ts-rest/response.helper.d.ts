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
import { ApiErrorCode } from "@repo/contracts/errors";
/**
 * 标准成功响应格式
 */
interface SuccessBody<T> {
    code: number;
    msg: string;
    data: T;
}
/**
 * 标准错误响应格式
 */
interface ErrorBody {
    code: number;
    msg: string;
    error?: unknown;
}
/**
 * ts-rest 处理器响应类型
 */
export type TsRestResponse<T, S extends number = 200> = {
    status: S;
    body: SuccessBody<T> | ErrorBody;
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
export declare function success<T>(data: T, status?: 200): TsRestSuccessResponse<T, 200>;
/**
 * 创建分页成功响应
 *
 * @example
 * ```typescript
 * return paginated(items, total, query.page, query.limit);
 * ```
 */
export declare function paginated<T>(list: T[], total: number, page: number, limit: number): TsRestResponse<{
    list: T[];
    total: number;
    page: number;
    limit: number;
}, 200>;
/**
 * 创建 201 响应（创建成功）
 */
export declare function created<T>(data: T): TsRestSuccessResponse<T, 201>;
/**
 * 创建删除成功响应
 */
export declare function deleted(): TsRestSuccessResponse<{
    success: boolean;
}, 200>;
export declare function deletedWithData<T>(data: T): TsRestSuccessResponse<T, 200>;
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
export declare function error(errorCode: ApiErrorCode, errorData?: unknown): TsRestResponse<never>;
/**
 * 从错误类型字符串创建错误响应
 *
 * @example
 * ```typescript
 * return errorFromType('userNotFound', 200401, 404);
 * ```
 */
export declare function errorFromType(errorType: string, errorCode: number, httpStatus?: number, errorData?: unknown): TsRestResponse<never>;
/**
 * 创建简单错误响应（不带 error 详情）
 */
export declare function errorSimple(code: number, msg: string, httpStatus?: number): TsRestResponse<never>;
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
export declare function serializeDates<T>(obj: T): any;
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
export declare function notFound(resourceName?: string): {
    status: 404;
    body: {
        error: string;
    };
};
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
export declare function fetchOrNull<T>(fetcher: () => Promise<T | null | undefined>): Promise<T | null>;
export {};
