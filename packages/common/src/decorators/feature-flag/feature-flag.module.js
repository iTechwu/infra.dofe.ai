"use strict";
/**
 * Feature Flag Module
 *
 * 提供功能开关服务的全局模块。
 * 支持 Unleash 集成或自定义 Redis/内存实现。
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const redis_1 = require("../../../../redis/src");
const feature_flag_service_1 = require("./feature-flag.service");
const feature_flag_interceptor_1 = require("./feature-flag.interceptor");
let FeatureFlagModule = class FeatureFlagModule {
};
exports.FeatureFlagModule = FeatureFlagModule;
exports.FeatureFlagModule = FeatureFlagModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, redis_1.RedisModule],
        providers: [
            feature_flag_service_1.FeatureFlagService,
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: feature_flag_interceptor_1.FeatureFlagInterceptor,
            },
        ],
        exports: [feature_flag_service_1.FeatureFlagService],
    })
], FeatureFlagModule);
//# sourceMappingURL=feature-flag.module.js.map