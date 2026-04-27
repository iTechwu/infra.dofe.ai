/**
 * App Version Interceptor
 *
 * 拦截器实现，在每个响应中添加版本信息头。
 * 前端可以通过这些头检测版本变化。
 */
import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AppVersionService } from './app-version.service';
export declare class AppVersionInterceptor implements NestInterceptor {
    private readonly appVersionService;
    constructor(appVersionService: AppVersionService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
}
