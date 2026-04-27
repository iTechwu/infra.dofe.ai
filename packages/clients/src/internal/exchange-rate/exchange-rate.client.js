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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExchangeRateClient = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const rxjs_1 = require("rxjs");
const configuration_1 = require("../../../../common/src/config/configuration");
/**
 * ExchangeRate Client
 *
 * 职责：仅负责与 exchangerate.host API 通信
 * - 调用 exchangerate.host API 进行货币转换
 * - 不访问数据库
 * - 不包含业务逻辑
 */
let ExchangeRateClient = class ExchangeRateClient {
    httpService;
    logger;
    baseUrl = '';
    apiKey = '';
    exchangeRateConfig;
    constructor(httpService, logger) {
        this.httpService = httpService;
        this.logger = logger;
    }
    onModuleInit() {
        const keysConfig = (0, configuration_1.getKeysConfig)();
        this.exchangeRateConfig = keysConfig?.exchangerate;
        this.baseUrl = this.exchangeRateConfig?.baseUrl || '';
        this.apiKey = this.exchangeRateConfig?.apiKey || '';
        if (!this.baseUrl) {
            this.logger.warn('ExchangeRate baseUrl not configured');
            return;
        }
        if (!this.apiKey) {
            this.logger.warn('ExchangeRate apiKey not configured');
            return;
        }
        this.logger.info(`ExchangeRate Client initialized with baseUrl: ${this.baseUrl}`);
    }
    /**
     * 获取汇率
     * @param from 源货币
     * @param to 目标货币
     * @returns 汇率
     */
    async getRate(from, to) {
        const result = await this.convert({ from, to, amount: 1 });
        return result.rate;
    }
    /**
     * 货币转换
     * @param params 转换参数
     * @returns 转换结果
     */
    async convert(params) {
        this.ensureConfigured();
        const from = params.from.trim().toUpperCase();
        const to = params.to.trim().toUpperCase();
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.baseUrl}/convert`, {
                params: {
                    access_key: this.apiKey,
                    from,
                    to,
                    amount: params.amount,
                },
                headers: {
                    Accept: 'application/json',
                },
                timeout: 10000,
            }));
            const data = response.data;
            if (data.success === false) {
                throw new Error(data.error?.info || 'ExchangeRate API returned error');
            }
            const convertedAmount = data.result;
            const rate = data.info?.quote ??
                data.info?.rate ??
                (typeof convertedAmount === 'number' && params.amount !== 0
                    ? convertedAmount / params.amount
                    : undefined);
            if (typeof convertedAmount !== 'number' ||
                !Number.isFinite(convertedAmount) ||
                typeof rate !== 'number' ||
                !Number.isFinite(rate)) {
                throw new Error('Exchange rate API returned invalid data');
            }
            return {
                from,
                to,
                amount: params.amount,
                convertedAmount,
                rate,
            };
        }
        catch (error) {
            this.handleError('convert', error, {
                from,
                to,
                amount: params.amount,
                baseUrl: this.baseUrl,
            });
        }
    }
    ensureConfigured() {
        if (!this.baseUrl) {
            throw new Error('ExchangeRate baseUrl not configured in keys/config.json (exchangerate.baseUrl)');
        }
        if (!this.apiKey) {
            throw new Error('ExchangeRate apiKey not configured in keys/config.json (exchangerate.apiKey)');
        }
    }
    handleError(operation, error, context) {
        const errorMessage = this.extractErrorMessage(error);
        const statusCode = error.response?.status;
        this.logger.error(`ExchangeRate API Error [${operation}]: ${errorMessage}`, {
            statusCode,
            context,
            responseData: error.response?.data,
        });
        if (statusCode === 401 || statusCode === 403) {
            throw new Error('ExchangeRate API authentication failed');
        }
        if (statusCode === 429) {
            throw new Error('ExchangeRate API rate limit exceeded');
        }
        if (error.code === 'ECONNREFUSED') {
            throw new Error(`Cannot connect to ExchangeRate server: ${this.baseUrl}`);
        }
        if (error.code === 'ETIMEDOUT') {
            throw new Error('ExchangeRate request timeout');
        }
        throw new Error(`ExchangeRate API error: ${errorMessage}`);
    }
    extractErrorMessage(error) {
        const responseData = error.response?.data;
        if (responseData && typeof responseData === 'object') {
            const data = responseData;
            return (data.error?.info || data.message || error.message || 'Unknown error');
        }
        return error.message || 'Unknown error';
    }
};
exports.ExchangeRateClient = ExchangeRateClient;
exports.ExchangeRateClient = ExchangeRateClient = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [axios_1.HttpService,
        winston_1.Logger])
], ExchangeRateClient);
//# sourceMappingURL=exchange-rate.client.js.map