/**
 * Version Interceptor
 *
 * 拦截器实现，处理 API 版本控制逻辑：
 * - 添加版本响应头
 * - 处理废弃版本警告
 * - 版本日志记录
 */
import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Logger } from 'winston';
export declare class VersionInterceptor implements NestInterceptor {
    private readonly reflector;
    private readonly logger;
    constructor(reflector: Reflector, logger: Logger);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
}
