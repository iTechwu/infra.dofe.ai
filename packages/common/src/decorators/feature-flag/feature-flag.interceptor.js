"use strict";
/**
 * Feature Flag Interceptor
 *
 * 拦截器实现，处理 @FeatureEnabled 装饰器逻辑。
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
exports.FeatureFlagInterceptor = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const feature_flag_decorator_1 = require("./feature-flag.decorator");
const feature_flag_service_1 = require("./feature-flag.service");
let FeatureFlagInterceptor = class FeatureFlagInterceptor {
    reflector;
    featureFlagService;
    logger;
    constructor(reflector, featureFlagService, logger) {
        this.reflector = reflector;
        this.featureFlagService = featureFlagService;
        this.logger = logger;
    }
    intercept(context, next) {
        const handler = context.getHandler();
        // 获取单个功能开关
        const flagOptions = this.reflector.get(feature_flag_decorator_1.FEATURE_FLAG_METADATA_KEY, handler);
        // 获取多个功能开关
        const flagsOptions = this.reflector.get(feature_flag_decorator_1.FEATURE_FLAGS_METADATA_KEY, handler);
        // 无功能开关配置，直接执行
        if (!flagOptions && !flagsOptions) {
            return next.handle();
        }
        // 构建评估上下文
        const request = context.switchToHttp().getRequest();
        const flagContext = {
            userId: request.user?.id || request.userId,
            environment: process.env.NODE_ENV,
            request: {
                ip: request.ip,
                sessionId: request.session?.id,
                headers: request.headers,
            },
            properties: {},
        };
        // 处理单个功能开关
        if (flagOptions) {
            return (0, rxjs_1.from)(this.evaluateFlag(flagOptions, flagContext)).pipe((0, operators_1.switchMap)((isEnabled) => {
                if (isEnabled) {
                    return next.handle();
                }
                return this.handleDisabled(flagOptions);
            }));
        }
        // 处理多个功能开关
        if (flagsOptions) {
            return (0, rxjs_1.from)(this.evaluateMultipleFlags(flagsOptions, flagContext)).pipe((0, operators_1.switchMap)((allEnabled) => {
                if (allEnabled) {
                    return next.handle();
                }
                // 找到第一个未启用的开关
                const disabledFlag = flagsOptions.find((f) => f.throwIfDisabled);
                return this.handleDisabled(disabledFlag || flagsOptions[0]);
            }));
        }
        return next.handle();
    }
    /**
     * 评估单个功能开关
     */
    async evaluateFlag(options, context) {
        const isEnabled = await this.featureFlagService.evaluate(options, context);
        this.logger.debug('Feature flag evaluated', {
            flagName: options.flagName,
            isEnabled,
            strategy: options.strategy,
            userId: context.userId,
        });
        return isEnabled;
    }
    /**
     * 评估多个功能开关
     */
    async evaluateMultipleFlags(optionsList, context) {
        for (const options of optionsList) {
            const isEnabled = await this.featureFlagService.evaluate(options, context);
            if (!isEnabled) {
                return false;
            }
        }
        return true;
    }
    /**
     * 处理功能未启用
     */
    handleDisabled(options) {
        if (options.throwIfDisabled) {
            const message = options.errorMessage || `功能 ${options.flagName} 暂未开放`;
            throw new common_1.NotImplementedException(message);
        }
        // 返回空响应
        return (0, rxjs_1.of)(null);
    }
};
exports.FeatureFlagInterceptor = FeatureFlagInterceptor;
exports.FeatureFlagInterceptor = FeatureFlagInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [core_1.Reflector,
        feature_flag_service_1.FeatureFlagService,
        winston_1.Logger])
], FeatureFlagInterceptor);
//# sourceMappingURL=feature-flag.interceptor.js.map