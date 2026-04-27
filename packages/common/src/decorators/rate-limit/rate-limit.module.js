"use strict";
/**
 * Rate Limit Module
 *
 * 限流模块，提供依赖注入支持
 *
 * @example
 * ```typescript
 * // 在 AppModule 或功能模块中导入
 * @Module({
 *     imports: [RateLimitModule],
 * })
 * export class AppModule {}
 *
 * // 在 Controller 中使用
 * @Controller('export')
 * export class ExportController {
 *     @Post()
 *     @RateLimit({ limit: 50, window: 60, dimension: 'userId' })
 *     async create() { ... }
 * }
 * ```
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const rate_limit_service_1 = require("./rate-limit.service");
const rate_limit_interceptor_1 = require("../../interceptor/rate-limit/rate-limit.interceptor");
const feature_flag_module_1 = require("../feature-flag/feature-flag.module");
let RateLimitModule = class RateLimitModule {
};
exports.RateLimitModule = RateLimitModule;
exports.RateLimitModule = RateLimitModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, feature_flag_module_1.FeatureFlagModule],
        providers: [rate_limit_service_1.RateLimitService, rate_limit_interceptor_1.RateLimitInterceptor],
        exports: [rate_limit_service_1.RateLimitService, rate_limit_interceptor_1.RateLimitInterceptor],
    })
], RateLimitModule);
//# sourceMappingURL=rate-limit.module.js.map