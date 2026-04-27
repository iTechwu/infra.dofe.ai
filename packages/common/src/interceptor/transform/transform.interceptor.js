"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransformInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
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
let TransformInterceptor = class TransformInterceptor {
    intercept(context, next) {
        const http = context.switchToHttp();
        const req = http.getRequest();
        const res = http.getResponse();
        let statusCode = res.statusCode;
        // 将 2xx 状态码统一为 200
        if (Math.floor(statusCode / 100) === 2) {
            statusCode = 200;
        }
        if (res.status) {
            res.status(statusCode);
        }
        // 获取 traceId
        const traceId = req.traceId;
        // 为响应添加 traceId
        return next.handle().pipe((0, operators_1.map)((data) => {
            // 如果响应是对象且有 code 字段，添加 traceId
            if (data && typeof data === 'object' && 'code' in data) {
                return { ...data, traceId };
            }
            return data;
        }));
    }
};
exports.TransformInterceptor = TransformInterceptor;
exports.TransformInterceptor = TransformInterceptor = __decorate([
    (0, common_1.Injectable)()
], TransformInterceptor);
//# sourceMappingURL=transform.interceptor.js.map