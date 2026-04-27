"use strict";
/**
 * Cache Module
 *
 * 提供缓存装饰器功能的 NestJS 模块。
 * 导入此模块以启用 @Cacheable, @CacheEvict, @CachePut 装饰器。
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheDecoratorModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const redis_1 = require("../../../../redis/src");
const cache_interceptor_1 = require("./cache.interceptor");
let CacheDecoratorModule = class CacheDecoratorModule {
};
exports.CacheDecoratorModule = CacheDecoratorModule;
exports.CacheDecoratorModule = CacheDecoratorModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [redis_1.RedisModule],
        providers: [
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: cache_interceptor_1.CacheInterceptor,
            },
        ],
        exports: [],
    })
], CacheDecoratorModule);
//# sourceMappingURL=cache.module.js.map