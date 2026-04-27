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
exports.VersionGuard = exports.SkipVersionCheck = exports.SKIP_VERSION_CHECK = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const constants_1 = require("@repo/constants");
/**
 * 跳过版本检查的装饰器 key
 */
exports.SKIP_VERSION_CHECK = 'skipVersionCheck';
/**
 * 跳过版本检查装饰器
 * @example
 * ```typescript
 * @SkipVersionCheck()
 * @Get('health')
 * health() { return { status: 'ok' }; }
 * ```
 */
const SkipVersionCheck = () => (0, common_1.SetMetadata)(exports.SKIP_VERSION_CHECK, true);
exports.SkipVersionCheck = SkipVersionCheck;
/**
 * Version Guard
 * 统一版本校验 Guard，支持 Web 和 APP 双轨校验
 *
 * 校验策略:
 * - Web 客户端: 使用 Generation (代际号) 校验，不兼容时返回 426 强制刷新
 * - APP 客户端: 使用 Contract (合约版本) 校验，通过 Adapter 兼容旧版本
 *
 * @example
 * ```typescript
 * // 全局注册
 * app.useGlobalGuards(new VersionGuard(new Reflector()));
 *
 * // 跳过特定路由
 * @SkipVersionCheck()
 * @Get('health')
 * health() { return { status: 'ok' }; }
 *
 * // 在 Service 中使用版本上下文
 * @Injectable()
 * class MyService {
 *   getUser(req: FastifyRequest) {
 *     const ctx = req.versionContext;
 *     if (ctx?.features.includes('user-v2')) {
 *       return this.getUserV2();
 *     }
 *     return this.getUserV1();
 *   }
 * }
 * ```
 */
let VersionGuard = class VersionGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        // 检查是否跳过版本检查
        const skipVersionCheck = this.reflector.getAllAndOverride(exports.SKIP_VERSION_CHECK, [context.getHandler(), context.getClass()]);
        if (skipVersionCheck) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const platform = request.headers[constants_1.PLATFORM_HEADER] || constants_1.PLATFORMS.WEB;
        const appBuild = request.headers[constants_1.APP_BUILD_HEADER];
        const contract = request.headers[constants_1.API_CONTRACT_HEADER];
        // Web 客户端: Generation 校验
        if (platform === constants_1.PLATFORMS.WEB || !platform) {
            return this.validateWebClient(request, appBuild, response);
        }
        // APP 客户端: Contract 校验
        return this.validateAppClient(request, platform, appBuild, contract, response);
    }
    /**
     * Web 客户端校验
     * 使用 Generation (代际号) 进行校验
     */
    validateWebClient(request, appBuild, response) {
        // 开发环境或未提供版本时跳过检查
        if (!appBuild || appBuild === 'dev' || appBuild === 'server') {
            // 设置默认版本上下文
            request.versionContext = {
                platform: constants_1.PLATFORMS.WEB,
                features: constants_1.CONTRACTS[constants_1.CURRENT_CONTRACT].features,
                appBuild,
            };
            return true;
        }
        // 提取代际号
        const clientGeneration = this.extractGeneration(appBuild);
        // 检查兼容性
        if (clientGeneration < constants_1.MIN_CLIENT_GENERATION) {
            // 设置最低版本 header
            const minAppBuild = this.getMinAppBuild();
            response.header(constants_1.MIN_APP_BUILD_HEADER, minAppBuild);
            throw new common_1.HttpException({
                code: 426,
                msg: '客户端版本过旧，请刷新页面',
                data: {
                    clientBuild: appBuild,
                    clientGeneration,
                    minGeneration: constants_1.MIN_CLIENT_GENERATION,
                    minBuild: minAppBuild,
                },
            }, 426);
        }
        // 设置版本上下文
        request.versionContext = {
            platform: constants_1.PLATFORMS.WEB,
            features: constants_1.CONTRACTS[constants_1.CURRENT_CONTRACT].features,
            appBuild,
        };
        return true;
    }
    /**
     * APP 客户端校验
     * 使用 Contract (合约版本) 进行校验
     */
    validateAppClient(request, platform, appBuild, contract, response) {
        // 检查 Contract 是否提供
        if (!contract) {
            // 如果没有提供 contract，使用默认最新版本
            request.versionContext = {
                platform,
                contract: constants_1.CURRENT_CONTRACT,
                features: constants_1.CONTRACTS[constants_1.CURRENT_CONTRACT].features,
                appBuild,
            };
            return true;
        }
        // 检查 Contract 是否支持
        if (!constants_1.CONTRACTS[contract]) {
            throw new common_1.HttpException({
                code: 400,
                msg: '不支持的 API 版本，请升级 APP',
                data: {
                    providedContract: contract,
                    supportedContracts: Object.keys(constants_1.CONTRACTS),
                    minContract: constants_1.MIN_SUPPORTED_CONTRACT,
                },
            }, 400);
        }
        const contractConfig = constants_1.CONTRACTS[contract];
        // 检查 Contract 是否已过期 (sunset)
        if (contractConfig.sunset && new Date() > new Date(contractConfig.sunset)) {
            throw new common_1.HttpException({
                code: 426,
                msg: '当前版本已停止支持，请升级 APP',
                data: {
                    expiredContract: contract,
                    minContract: constants_1.MIN_SUPPORTED_CONTRACT,
                    sunsetDate: contractConfig.sunset,
                },
            }, 426);
        }
        // 检查 APP Build 是否满足最低要求
        if (appBuild && platform !== constants_1.PLATFORMS.WEB) {
            const minBuild = contractConfig.minBuild[platform];
            const buildNumber = this.extractBuildNumber(appBuild);
            if (minBuild && buildNumber > 0 && buildNumber < minBuild) {
                throw new common_1.HttpException({
                    code: 426,
                    msg: '请升级 APP 以继续使用',
                    data: {
                        currentBuild: buildNumber,
                        minBuild,
                        platform,
                    },
                }, 426);
            }
        }
        // 设置版本上下文
        request.versionContext = {
            platform,
            contract,
            features: contractConfig.features,
            appBuild,
        };
        // 如果 Contract 已废弃，添加警告 header
        if (contractConfig.deprecated) {
            response.header('X-Api-Deprecated', 'true');
            response.header('X-Api-Upgrade-To', constants_1.CURRENT_CONTRACT);
        }
        return true;
    }
    /**
     * 从构建版本中提取代际号
     * @param buildVersion 构建版本字符串 (格式: YYYY.MM.DD-hash-gNN)
     * @returns 代际号，无法解析时返回 0
     */
    extractGeneration(buildVersion) {
        const match = buildVersion.match(/-g(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
    }
    /**
     * 从 APP Build 中提取构建号
     * @param appBuild APP 构建版本字符串 (格式: 数字或版本号)
     * @returns 构建号，无法解析时返回 0
     */
    extractBuildNumber(appBuild) {
        // 如果是纯数字，直接返回
        const numericBuild = parseInt(appBuild, 10);
        if (!isNaN(numericBuild)) {
            return numericBuild;
        }
        // 否则尝试从版本号中提取
        const match = appBuild.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }
    /**
     * 获取最低兼容的构建版本
     */
    getMinAppBuild() {
        return `0000.00.00-000000-g${constants_1.MIN_CLIENT_GENERATION}`;
    }
};
exports.VersionGuard = VersionGuard;
exports.VersionGuard = VersionGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], VersionGuard);
//# sourceMappingURL=version.guard.js.map