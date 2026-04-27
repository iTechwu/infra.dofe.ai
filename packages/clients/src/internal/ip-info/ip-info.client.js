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
exports.IpInfoClient = void 0;
/**
 * IP Info Client
 *
 * 职责：仅负责与 ipinfo.io API 通信
 * - 调用 ipinfo.io API 获取 IP 地理位置信息
 * - 不访问数据库
 * - 不包含业务逻辑
 */
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
let IpInfoClient = class IpInfoClient {
    httpService;
    configService;
    logger;
    config;
    constructor(httpService, configService, logger) {
        this.httpService = httpService;
        this.configService = configService;
        this.logger = logger;
        this.config = configService.getOrThrow('ipinfo');
    }
    /**
     * 获取 IP 地理位置信息
     * @param ip IP 地址
     * @returns IP 信息
     */
    async getIpInfo(ip) {
        const url = `${this.config.url}/${ip}?token=${this.config.token}`;
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(url, {
                timeout: 10000,
            }));
            this.logger.debug(`IP info fetched for ${ip}`, {
                country: response.data.country,
            });
            return response.data;
        }
        catch (error) {
            this.logger.error(`Failed to fetch IP info for ${ip}`, {
                error: error.message,
            });
            throw error;
        }
    }
};
exports.IpInfoClient = IpInfoClient;
exports.IpInfoClient = IpInfoClient = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService,
        winston_1.Logger])
], IpInfoClient);
//# sourceMappingURL=ip-info.client.js.map