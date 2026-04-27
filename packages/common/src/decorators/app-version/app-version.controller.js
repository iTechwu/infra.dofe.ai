"use strict";
/**
 * App Version Controller
 *
 * 提供版本检查 API 端点。
 *
 * **重要**: 此控制器使用 VERSION_NEUTRAL，不需要版本 header。
 * 前端应在启动时调用此 API 获取当前 API 版本，然后在后续请求中携带版本 header。
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
exports.AppVersionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_version_service_1 = require("./app-version.service");
const ts_rest_controller_decorator_1 = require("../ts-rest-controller.decorator");
let AppVersionController = class AppVersionController {
    appVersionService;
    constructor(appVersionService) {
        this.appVersionService = appVersionService;
    }
    /**
     * 获取服务端版本信息
     */
    getVersion() {
        return this.appVersionService.getVersionInfo();
    }
    /**
     * 检查客户端版本兼容性
     */
    checkVersion(clientVersion, buildVersion) {
        const result = this.appVersionService.checkClientVersion(clientVersion || '');
        // 如果版本匹配，额外检查构建版本
        if (!result.needsRefresh && buildVersion) {
            const buildMatch = this.appVersionService.checkBuildVersion(buildVersion);
            if (!buildMatch) {
                return {
                    ...result,
                    needsRefresh: true,
                    reason: 'outdated',
                    action: 'refresh',
                    message: '检测到代码更新，建议刷新页面',
                };
            }
        }
        return result;
    }
    /**
     * 简单的版本哈希检查 (轻量级)
     * 用于前端轮询检测
     */
    getBuildHash() {
        const info = this.appVersionService.getVersionInfo();
        return {
            hash: info.buildVersion,
            time: info.buildTime,
        };
    }
};
exports.AppVersionController = AppVersionController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '获取服务端版本信息' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '版本信息',
        schema: {
            type: 'object',
            properties: {
                appVersion: { type: 'string', example: '1.0.0' },
                apiVersion: { type: 'string', example: '1' },
                buildVersion: { type: 'string', example: 'a1b2c3d4' },
                buildTime: {
                    type: 'string',
                    example: '2025-01-15T10:00:00.000Z',
                },
                environment: { type: 'string', example: 'production' },
            },
        },
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], AppVersionController.prototype, "getVersion", null);
__decorate([
    (0, common_1.Get)('check'),
    (0, swagger_1.ApiOperation)({ summary: '检查客户端版本兼容性' }),
    (0, swagger_1.ApiQuery)({
        name: 'clientVersion',
        description: '客户端版本号',
        required: false,
        example: '1.0.0',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'buildVersion',
        description: '客户端构建版本',
        required: false,
        example: 'a1b2c3d4',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '版本检查结果',
        schema: {
            type: 'object',
            properties: {
                needsRefresh: { type: 'boolean', example: false },
                reason: {
                    type: 'string',
                    enum: ['outdated', 'incompatible', 'major_update'],
                },
                serverVersion: { type: 'string', example: '1.0.0' },
                clientVersion: { type: 'string', example: '1.0.0' },
                action: { type: 'string', enum: ['refresh', 'update', 'none'] },
                message: { type: 'string' },
            },
        },
    }),
    __param(0, (0, common_1.Query)('clientVersion')),
    __param(1, (0, common_1.Query)('buildVersion')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Object)
], AppVersionController.prototype, "checkVersion", null);
__decorate([
    (0, common_1.Get)('hash'),
    (0, swagger_1.ApiOperation)({ summary: '获取构建哈希 (轻量级检查)' }),
    (0, common_1.Header)('Cache-Control', 'no-cache, no-store, must-revalidate'),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '构建哈希',
        schema: {
            type: 'object',
            properties: {
                hash: { type: 'string', example: 'a1b2c3d4' },
                time: { type: 'string', example: '2025-01-15T10:00:00.000Z' },
            },
        },
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], AppVersionController.prototype, "getBuildHash", null);
exports.AppVersionController = AppVersionController = __decorate([
    (0, swagger_1.ApiTags)('Version'),
    (0, ts_rest_controller_decorator_1.TsRestController)('version'),
    __metadata("design:paramtypes", [app_version_service_1.AppVersionService])
], AppVersionController);
//# sourceMappingURL=app-version.controller.js.map