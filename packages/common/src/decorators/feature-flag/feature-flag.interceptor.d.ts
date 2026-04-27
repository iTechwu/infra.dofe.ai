/**
 * Feature Flag Interceptor
 *
 * 拦截器实现，处理 @FeatureEnabled 装饰器逻辑。
 */
import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Logger } from 'winston';
import { FeatureFlagService } from './feature-flag.service';
export declare class FeatureFlagInterceptor implements NestInterceptor {
    private readonly reflector;
    private readonly featureFlagService;
    private readonly logger;
    constructor(reflector: Reflector, featureFlagService: FeatureFlagService, logger: Logger);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
    /**
     * 评估单个功能开关
     */
    private evaluateFlag;
    /**
     * 评估多个功能开关
     */
    private evaluateMultipleFlags;
    /**
     * 处理功能未启用
     */
    private handleDisabled;
}
