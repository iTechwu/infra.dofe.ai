import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
/**
 * Transform Interceptor
 * 响应转换拦截器
 *
 * 功能：
 * 1. 将 2xx 状态码统一为 200
 * 2. 为响应添加 traceId (便于问题追踪)
 *
 * Controller 应使用 response.helper.ts 中的函数返回标准格式：
 * - success(data) → { code: 200, msg: 'ok', data, traceId }
 * - created(data) → { code: 200, msg: 'ok', data, traceId } (status: 201)
 * - deleted() → { code: 200, msg: 'ok', data: { success: true }, traceId }
 * - paginated(list, total, page, limit) → { code: 200, msg: 'ok', data: { list, total, page, limit }, traceId }
 * - errorFromType(type, code, status) → { code, msg, error, traceId }
 *
 * @example
 * ```typescript
 * import { success, deleted, errorFromType } from '@/common/ts-rest';
 *
 * @TsRestHandler(c.getItem)
 * async getItem() {
 *   return tsRestHandler(c.getItem, async ({ params }) => {
 *     const data = await this.service.findById(params.id);
 *     if (!data) {
 *       return errorFromType('notFound', 404001, 404);
 *     }
 *     return success(data);
 *   });
 * }
 * ```
 */
export declare class TransformInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>>;
}
