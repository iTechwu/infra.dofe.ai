"use strict";
/**
 * Event Decorator Module
 *
 * 提供事件装饰器功能的 NestJS 模块。
 * 导入此模块以启用 @EmitEvent, @EmitEvents 装饰器。
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventDecoratorModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const event_emitter_1 = require("@nestjs/event-emitter");
const event_interceptor_1 = require("./event.interceptor");
const cache_event_handler_1 = require("./handlers/cache-event.handler");
const cache_module_1 = require("../cache/cache.module");
const redis_1 = require("../../../../redis/src");
let EventDecoratorModule = class EventDecoratorModule {
};
exports.EventDecoratorModule = EventDecoratorModule;
exports.EventDecoratorModule = EventDecoratorModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            cache_module_1.CacheDecoratorModule,
            redis_1.RedisModule,
            event_emitter_1.EventEmitterModule.forRoot({
                // 通配符支持
                wildcard: true,
                // 分隔符
                delimiter: '.',
                // 新监听器优先
                newListener: false,
                // 移除监听器时触发
                removeListener: false,
                // 最大监听器数量
                maxListeners: 20,
                // 启用详细内存泄漏警告
                verboseMemoryLeak: true,
                // 忽略错误
                ignoreErrors: false,
            }),
        ],
        providers: [
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: event_interceptor_1.EventInterceptor,
            },
            cache_event_handler_1.CacheEventHandler,
        ],
        exports: [cache_event_handler_1.CacheEventHandler],
    })
], EventDecoratorModule);
//# sourceMappingURL=event.module.js.map