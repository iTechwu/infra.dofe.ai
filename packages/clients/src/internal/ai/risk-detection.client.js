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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskDetectionClient = void 0;
/**
 * 火山引擎风险检测 Internal Client
 *
 * 职责：仅负责与火山引擎 API 通信
 * - 不访问数据库
 * - 不包含缓存逻辑
 * - 不包含业务逻辑
 */
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const rxjs_1 = require("rxjs");
const openapi_1 = require("@volcengine/openapi");
const configuration_1 = require("../../../../common/src/config/configuration");
const enviroment_util_1 = __importDefault(require("../../../../utils/dist/enviroment.util"));
let RiskDetectionClient = class RiskDetectionClient {
    httpService;
    logger;
    riskConfig;
    isConfigured;
    constructor(httpService, logger) {
        this.httpService = httpService;
        this.logger = logger;
        const config = (0, configuration_1.getKeysConfig)()?.risk;
        if (!config || !config.volcengine) {
            this.logger.warn('Volcengine Risk config not found');
            this.isConfigured = false;
            this.riskConfig = {
                accessKey: '',
                secretKey: '',
                region: 'cn-shanghai',
                appId: 0,
                baseUrl: 'https://open.volcengineapi.com',
            };
            return;
        }
        const volcengineConfig = config.volcengine;
        this.riskConfig = {
            accessKey: volcengineConfig.accessKey || '',
            secretKey: volcengineConfig.secretKey || '',
            region: volcengineConfig.region || 'cn-shanghai',
            appId: volcengineConfig.appId || 0,
            baseUrl: volcengineConfig.baseUrl || 'https://open.volcengineapi.com',
        };
        this.isConfigured = !!(this.riskConfig.accessKey && this.riskConfig.secretKey);
        if (this.isConfigured) {
            if (enviroment_util_1.default.isProduction()) {
                this.logger.info('RiskDetectionClient initialized successfully', {
                    accessKey: this.riskConfig.accessKey,
                    secretKey: this.riskConfig.secretKey,
                    region: this.riskConfig.region,
                    appId: this.riskConfig.appId,
                    baseUrl: this.riskConfig.baseUrl,
                });
            }
        }
        else {
            this.logger.warn('RiskDetectionClient: credentials not configured');
        }
    }
    /**
     * 文本风险检测
     */
    async detectTextRisk(text, dataId) {
        if (!this.isConfigured) {
            this.logger.warn('RiskDetectionClient not configured');
            return undefined;
        }
        return await this.volcengineApi({
            body: {
                AppId: this.riskConfig.appId,
                Service: 'text_risk',
                Parameters: {
                    biztype: 'risk_detection',
                    text,
                    account_id: '23332',
                    data_id: dataId,
                },
            },
            params: {
                Action: 'TextSliceRisk',
                Version: '2022-11-07',
            },
            method: 'POST',
        });
    }
    /**
     * 图片内容风险检测
     */
    async detectImageRisk(url, dataId) {
        if (!this.isConfigured) {
            this.logger.warn('RiskDetectionClient not configured');
            return undefined;
        }
        return await this.volcengineApi({
            body: {
                AppId: this.riskConfig.appId,
                Service: 'image_content_risk',
                Parameters: {
                    biztype: 'image_risk',
                    account_id: '23332',
                    data_id: dataId,
                    url,
                },
            },
            params: {
                Action: 'ImageContentRiskV2',
                Version: '2021-11-29',
            },
            method: 'POST',
        });
    }
    /**
     * 提交视频风险检测任务（异步）
     */
    async submitVideoRisk(url, dataId) {
        if (!this.isConfigured) {
            this.logger.warn('RiskDetectionClient not configured');
            return undefined;
        }
        return await this.volcengineApi({
            body: {
                AppId: this.riskConfig.appId,
                Service: 'video_risk',
                Parameters: {
                    biztype: 'video_risk',
                    account_id: '23332',
                    data_id: dataId,
                    url: url,
                },
            },
            params: {
                Action: 'AsyncVideoRisk',
                Version: '2021-11-29',
            },
        });
    }
    /**
     * 查询视频风险检测结果
     */
    async queryVideoRisk(dataId) {
        if (!this.isConfigured) {
            this.logger.warn('RiskDetectionClient not configured');
            return undefined;
        }
        return await this.volcengineApi({
            params: {
                AppId: this.riskConfig.appId,
                Service: 'video_risk',
                DataId: dataId,
                Action: 'VideoResult',
                Version: '2021-11-29',
            },
            body: {},
            method: 'GET',
        });
    }
    /**
     * 调用火山引擎 API
     */
    async volcengineApi({ body = {}, params, method = 'POST', }) {
        if (body.Parameters && typeof body.Parameters === 'object') {
            body.Parameters = JSON.stringify({
                ...body.Parameters,
                operate_time: Math.floor(Date.now() / 1000),
            });
        }
        const openApiRequestData = {
            region: this.riskConfig.region,
            method,
            params: params,
            headers: {},
            body: JSON.stringify(body),
        };
        const signer = new openapi_1.Signer(openApiRequestData, 'BusinessSecurity');
        signer.addAuthorization({
            accessKeyId: this.riskConfig.accessKey,
            secretKey: this.riskConfig.secretKey,
        });
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.request({
                url: this.riskConfig.baseUrl,
                headers: openApiRequestData.headers,
                params: openApiRequestData.params,
                method: openApiRequestData.method,
                data: body,
            }));
            this.logger.debug(`RiskDetectionClient response: ${JSON.stringify(response.data)}`);
            if (response.data?.Result?.Code === 0) {
                return response.data.Result.Data;
            }
            this.logger.warn(`RiskDetectionClient API error: ${JSON.stringify(response.data?.Result)}`);
            return undefined;
        }
        catch (error) {
            this.logger.error(`RiskDetectionClient API call failed: ${error.message}`);
            return undefined;
        }
    }
};
exports.RiskDetectionClient = RiskDetectionClient;
exports.RiskDetectionClient = RiskDetectionClient = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [axios_1.HttpService,
        winston_1.Logger])
], RiskDetectionClient);
//# sourceMappingURL=risk-detection.client.js.map