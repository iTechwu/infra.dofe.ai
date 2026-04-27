"use strict";
/**
 * Event Interceptor
 *
 * 拦截器实现，处理 @EmitEvent, @EmitEvents 装饰器的事件触发逻辑。
 * 与 NestJS EventEmitter2 深度融合。
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventInterceptor = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const operators_1 = require("rxjs/operators");
const event_emitter_1 = require("@nestjs/event-emitter");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const event_decorator_1 = require("./event.decorator");
let EventInterceptor = class EventInterceptor {
    reflector;
    eventEmitter;
    logger;
    constructor(reflector, eventEmitter, logger) {
        this.reflector = reflector;
        this.eventEmitter = eventEmitter;
        this.logger = logger;
    }
    intercept(context, next) {
        const handler = context.getHandler();
        const className = context.getClass().name;
        const methodName = handler.name;
        // 获取单个事件配置
        const singleEvent = this.reflector.get(event_decorator_1.EMIT_EVENT_METADATA_KEY, handler);
        // 获取多个事件配置
        const multipleEvents = this.reflector.get(event_decorator_1.EMIT_EVENTS_METADATA_KEY, handler);
        // 合并所有事件配置
        const eventConfigs = [];
        if (singleEvent) {
            eventConfigs.push(singleEvent);
        }
        if (multipleEvents) {
            eventConfigs.push(...multipleEvents);
        }
        // 如果没有事件配置，直接执行
        if (eventConfigs.length === 0) {
            return next.handle();
        }
        // 获取方法参数
        const args = context.getArgs();
        // 处理 beforeInvocation 事件
        const beforeEvents = eventConfigs.filter((e) => e.beforeInvocation);
        for (const event of beforeEvents) {
            this.emitEvent(event, args, undefined, className, methodName);
        }
        // 处理 afterInvocation 事件
        const afterEvents = eventConfigs.filter((e) => !e.beforeInvocation);
        if (afterEvents.length === 0) {
            return next.handle();
        }
        return next.handle().pipe((0, operators_1.tap)((result) => {
            for (const event of afterEvents) {
                this.emitEvent(event, args, result, className, methodName);
            }
        }));
    }
    /**
     * 触发事件
     */
    emitEvent(options, args, result, className, methodName) {
        try {
            // 检查条件
            if (options.condition && !options.condition(result, args)) {
                this.logger.debug('Event condition not met, skipping', {
                    eventName: options.eventName,
                    className,
                    methodName,
                });
                return;
            }
            // 生成 payload
            const payloadGenerator = options.payloadGenerator || event_decorator_1.defaultPayloadGenerator;
            const payload = payloadGenerator(args, result);
            // 添加上下文信息
            const enrichedPayload = {
                ...payload,
                __meta: {
                    eventName: options.eventName,
                    source: `${className}.${methodName}`,
                    emittedAt: new Date().toISOString(),
                },
            };
            // 触发事件
            if (options.async !== false) {
                // 异步触发 (不阻塞)
                setImmediate(() => {
                    this.eventEmitter.emit(options.eventName, enrichedPayload);
                    this.logger.debug('Event emitted (async)', {
                        eventName: options.eventName,
                        source: `${className}.${methodName}`,
                    });
                });
            }
            else {
                // 同步触发
                this.eventEmitter.emit(options.eventName, enrichedPayload);
                this.logger.debug('Event emitted (sync)', {
                    eventName: options.eventName,
                    source: `${className}.${methodName}`,
                });
            }
        }
        catch (error) {
            this.logger.error('Event emission error', {
                eventName: options.eventName,
                className,
                methodName,
                error: error.message,
            });
        }
    }
};
exports.EventInterceptor = EventInterceptor;
exports.EventInterceptor = EventInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [core_1.Reflector,
        event_emitter_1.EventEmitter2,
        winston_1.Logger])
], EventInterceptor);
//# sourceMappingURL=event.interceptor.js.map