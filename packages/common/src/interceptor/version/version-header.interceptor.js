"use strict";
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
exports.VersionHeaderInterceptor = void 0;
const common_1 = require("@nestjs/common");
const constants_1 = require("@repo/constants");
/**
 * Version Header Interceptor
 * 版本响应头拦截器
 *
 * 功能：
 * 为所有响应添加版本相关的 Header：
 * - X-API-Version: API 版本号
 * - X-Server-Build: 后端构建版本
 *
 * @example
 * ```typescript
 * // 全局注册
 * app.useGlobalInterceptors(new VersionHeaderInterceptor());
 *
 * // 响应头示例
 * // X-API-Version: 1
 * // X-Server-Build: 2025.03.18-abcdef-g42
 * ```
 */
let VersionHeaderInterceptor = class VersionHeaderInterceptor {
    serverBuild;
    constructor() {
        // 从环境变量获取后端构建版本
        // 格式: YYYY.MM.DD-<hash>-g<generation>
        this.serverBuild = process.env.SERVER_BUILD || this.generateDevBuild();
    }
    intercept(context, next) {
        const response = context.switchToHttp().getResponse();
        // 设置版本响应头
        response.header(constants_1.API_VERSION_HEADER, constants_1.API_VERSION_DEFAULT);
        response.header(constants_1.SERVER_BUILD_HEADER, this.serverBuild);
        return next.handle();
    }
    /**
     * 生成开发环境的构建版本
     */
    generateDevBuild() {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
        return `${date}-dev-g${constants_1.API_GENERATION}`;
    }
};
exports.VersionHeaderInterceptor = VersionHeaderInterceptor;
exports.VersionHeaderInterceptor = VersionHeaderInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], VersionHeaderInterceptor);
//# sourceMappingURL=version-header.interceptor.js.map