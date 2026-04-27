/**
 * Event Interceptor
 *
 * 拦截器实现，处理 @EmitEvent, @EmitEvents 装饰器的事件触发逻辑。
 * 与 NestJS EventEmitter2 深度融合。
 */
import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from 'winston';
export declare class EventInterceptor implements NestInterceptor {
    private readonly reflector;
    private readonly eventEmitter;
    private readonly logger;
    constructor(reflector: Reflector, eventEmitter: EventEmitter2, logger: Logger);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
    /**
     * 触发事件
     */
    private emitEvent;
}
