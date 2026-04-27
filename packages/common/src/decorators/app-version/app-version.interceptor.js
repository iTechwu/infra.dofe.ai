"use strict";
/**
 * App Version Interceptor
 *
 * 拦截器实现，在每个响应中添加版本信息头。
 * 前端可以通过这些头检测版本变化。
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppVersionInterceptor = void 0;
const common_1 = require("@nestjs/common");
const app_version_service_1 = require("./app-version.service");
let AppVersionInterceptor = class AppVersionInterceptor {
    appVersionService;
    constructor(appVersionService) {
        this.appVersionService = appVersionService;
    }
    intercept(context, next) {
        const response = context.switchToHttp().getResponse();
        // 获取版本响应头
        const versionHeaders = this.appVersionService.getVersionHeaders();
        // 添加版本头到响应
        for (const [key, value] of Object.entries(versionHeaders)) {
            response.header(key, value);
        }
        return next.handle();
    }
};
exports.AppVersionInterceptor = AppVersionInterceptor;
exports.AppVersionInterceptor = AppVersionInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [app_version_service_1.AppVersionService])
], AppVersionInterceptor);
//# sourceMappingURL=app-version.interceptor.js.map