"use strict";
/**
 * Version Interceptor
 *
 * 拦截器实现，处理 API 版本控制逻辑：
 * - 添加版本响应头
 * - 处理废弃版本警告
 * - 版本日志记录
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
exports.VersionInterceptor = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const operators_1 = require("rxjs/operators");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const version_decorator_1 = require("./version.decorator");
let VersionInterceptor = class VersionInterceptor {
    reflector;
    logger;
    constructor(reflector, logger) {
        this.reflector = reflector;
        this.logger = logger;
    }
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const handler = context.getHandler();
        const controller = context.getClass();
        // 获取请求的版本
        const requestVersion = request.headers?.[version_decorator_1.API_VERSION_HEADER] || version_decorator_1.DEFAULT_API_VERSION;
        // 获取方法或控制器的版本元数据
        const methodVersion = this.reflector.get(version_decorator_1.VERSION_METADATA_KEY, handler);
        const controllerVersion = this.reflector.get(version_decorator_1.VERSION_METADATA_KEY, controller);
        // 获取废弃信息
        const deprecatedInfo = this.reflector.get('api:deprecated', handler);
        // 添加版本响应头
        response.header('x-api-version', requestVersion);
        response.header('x-supported-versions', version_decorator_1.SUPPORTED_VERSIONS.join(', '));
        // 处理废弃版本警告
        if (deprecatedInfo) {
            response.header('Deprecation', 'true');
            response.header('X-Deprecation-Message', deprecatedInfo.message);
            if (deprecatedInfo.sunsetDate) {
                response.header('Sunset', deprecatedInfo.sunsetDate);
            }
            this.logger.warn('Deprecated API version used', {
                path: request.url,
                method: request.method,
                version: requestVersion,
                message: deprecatedInfo.message,
                sunsetDate: deprecatedInfo.sunsetDate,
            });
        }
        return next.handle().pipe((0, operators_1.tap)(() => {
            // 可选: 记录版本使用日志
            this.logger.debug('API request processed', {
                path: request.url,
                method: request.method,
                version: requestVersion,
                controllerVersion,
                methodVersion,
            });
        }));
    }
};
exports.VersionInterceptor = VersionInterceptor;
exports.VersionInterceptor = VersionInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [core_1.Reflector,
        winston_1.Logger])
], VersionInterceptor);
//# sourceMappingURL=version.interceptor.js.map