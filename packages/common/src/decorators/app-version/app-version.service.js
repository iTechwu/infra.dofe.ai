"use strict";
/**
 * App Version Service
 *
 * 提供应用版本管理服务，用于前后端版本一致性检查。
 *
 * 版本策略:
 * - API 版本: 后端 API 接口版本
 * - App 版本: 应用整体版本 (前后端协调)
 * - Build 版本: 构建时间戳/Git commit hash
 *
 * 前端检测机制:
 * 1. 响应头检查: x-app-version, x-build-version
 * 2. 专用接口: GET /api/version
 * 3. 版本不一致时提示用户刷新
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppVersionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const enviroment_util_1 = __importDefault(require("../../../../utils/dist/enviroment.util"));
// ============================================================================
// Service
// ============================================================================
let AppVersionService = class AppVersionService {
    configService;
    logger;
    versionInfo;
    buildHash = '';
    constructor(configService, logger) {
        this.configService = configService;
        this.logger = logger;
    }
    async onModuleInit() {
        await this.loadVersionInfo();
    }
    /**
     * 加载版本信息
     */
    async loadVersionInfo() {
        try {
            // 读取 package.json
            const packagePath = path.join(process.cwd(), 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
            // 生成构建版本
            this.buildHash = this.generateBuildHash();
            this.versionInfo = {
                appVersion: packageJson.version || '0.0.1',
                apiVersion: this.configService.get('app.apiVersion', '1'),
                buildVersion: this.buildHash,
                buildTime: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'dev',
                minClientVersion: this.configService.get('app.minClientVersion'),
            };
            if (enviroment_util_1.default.isProduction()) {
                this.logger.info('App version info module loaded', {
                    versionInfo: this.versionInfo,
                });
            }
            else {
                this.logger.debug('App version info module loaded', {
                    versionInfo: this.versionInfo,
                });
            }
        }
        catch (error) {
            this.logger.error('Failed to load version info', {
                error: error.message,
            });
            this.versionInfo = {
                appVersion: '0.0.1',
                apiVersion: '1',
                buildVersion: 'unknown',
                buildTime: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'dev',
            };
        }
    }
    /**
     * 生成构建哈希
     */
    generateBuildHash() {
        // 优先使用 Git commit hash
        const gitHash = process.env.GIT_COMMIT_HASH || process.env.VERCEL_GIT_COMMIT_SHA;
        if (gitHash) {
            return gitHash.substring(0, 8);
        }
        // 使用时间戳
        return Date.now().toString(36);
    }
    /**
     * 获取版本信息
     */
    getVersionInfo() {
        return { ...this.versionInfo };
    }
    /**
     * 获取版本响应头
     */
    getVersionHeaders() {
        return {
            'x-app-version': this.versionInfo.appVersion,
            'x-api-version': this.versionInfo.apiVersion,
            'x-build-version': this.versionInfo.buildVersion,
            'x-build-time': this.versionInfo.buildTime,
        };
    }
    /**
     * 检查客户端版本兼容性
     */
    checkClientVersion(clientVersion) {
        const serverVersion = this.versionInfo.appVersion;
        const minVersion = this.versionInfo.minClientVersion;
        // 如果客户端版本为空，建议刷新
        if (!clientVersion) {
            return {
                needsRefresh: true,
                reason: 'outdated',
                serverVersion,
                clientVersion: 'unknown',
                action: 'refresh',
                message: '检测到新版本，请刷新页面',
            };
        }
        // 比较版本
        const comparison = this.compareVersions(clientVersion, serverVersion);
        // 客户端版本低于服务端
        if (comparison < 0) {
            const isMajorUpdate = this.isMajorVersionDiff(clientVersion, serverVersion);
            return {
                needsRefresh: true,
                reason: isMajorUpdate ? 'major_update' : 'outdated',
                serverVersion,
                clientVersion,
                action: 'refresh',
                message: isMajorUpdate
                    ? '发现重要更新，请刷新页面以获得最佳体验'
                    : '检测到新版本，建议刷新页面',
            };
        }
        // 检查最低兼容版本
        if (minVersion && this.compareVersions(clientVersion, minVersion) < 0) {
            return {
                needsRefresh: true,
                reason: 'incompatible',
                serverVersion,
                clientVersion,
                action: 'update',
                message: '当前版本过旧，请刷新页面更新',
            };
        }
        return {
            needsRefresh: false,
            serverVersion,
            clientVersion,
            action: 'none',
        };
    }
    /**
     * 检查构建版本是否匹配
     */
    checkBuildVersion(clientBuildVersion) {
        return clientBuildVersion === this.versionInfo.buildVersion;
    }
    /**
     * 比较版本号
     * @returns -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
     */
    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;
            if (num1 < num2)
                return -1;
            if (num1 > num2)
                return 1;
        }
        return 0;
    }
    /**
     * 检查是否为主版本更新
     */
    isMajorVersionDiff(v1, v2) {
        const major1 = parseInt(v1.split('.')[0] || '0', 10);
        const major2 = parseInt(v2.split('.')[0] || '0', 10);
        return major1 !== major2;
    }
};
exports.AppVersionService = AppVersionService;
exports.AppVersionService = AppVersionService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        winston_1.Logger])
], AppVersionService);
//# sourceMappingURL=app-version.service.js.map