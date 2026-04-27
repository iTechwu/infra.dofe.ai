import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
/**
 * Version Header Interceptor
 * 版本响应头拦截器
 *
 * 功能：
 * 为所有响应添加版本相关的 Header：
 * - X-API-Version: API 版本号
 * - X-Server-Build: 后端构建版本
 *
 * @example
 * ```typescript
 * // 全局注册
 * app.useGlobalInterceptors(new VersionHeaderInterceptor());
 *
 * // 响应头示例
 * // X-API-Version: 1
 * // X-Server-Build: 2025.03.18-abcdef-g42
 * ```
 */
export declare class VersionHeaderInterceptor implements NestInterceptor {
    private readonly serverBuild;
    constructor();
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
    /**
     * 生成开发环境的构建版本
     */
    private generateDevBuild;
}
