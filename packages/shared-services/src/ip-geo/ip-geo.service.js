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
exports.IpGeoService = void 0;
/**
 * @fileoverview IP 地理位置服务（Infra 层）
 *
 * 本服务提供纯 infra 层的 IP 地理位置查询功能：
 * - IP 信息查询（via IpInfoClient）
 * - 国家代码查询
 * - 大洲查询（使用静态映射，不依赖数据库）
 *
 * 注意：此服务不依赖 domain 层，可在 infra 层安全使用。
 * 如需完整的 IP 信息服务（含数据库查询），请使用 domain/services/ip-info。
 *
 * @module ip-geo/service
 */
const common_1 = require("@nestjs/common");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const redis_1 = require("../../../redis/src");
const ip_util_1 = __importDefault(require("../../../utils/dist/ip.util"));
const validate_util_1 = __importDefault(require("../../../utils/dist/validate.util"));
const enviroment_util_1 = __importDefault(require("../../../utils/dist/enviroment.util"));
const continent_mapping_1 = require("./continent-mapping");
const ip_info_1 = require("../../../clients/src/internal/ip-info");
/**
 * IP 地理位置服务（Infra 层）
 *
 * @description 提供 IP 地理位置查询功能，使用静态大洲映射，不依赖数据库。
 *
 * @class IpGeoService
 */
let IpGeoService = class IpGeoService {
    redis;
    ipInfoClient;
    logger;
    ipinfoRedisKey = 'ipinfo';
    constructor(redis, ipInfoClient, logger) {
        this.redis = redis;
        this.ipInfoClient = ipInfoClient;
        this.logger = logger;
    }
    /**
     * 从请求中提取 IP 地址
     */
    extractIp(req) {
        return ip_util_1.default.extractIp(req);
    }
    /**
     * 获取 IP 信息
     */
    async getIpInfo(ip) {
        if (enviroment_util_1.default.getBaseZone() === 'cn') {
            return {
                ip,
                country: 'CN',
                region: 'Beijing',
                city: 'Beijing',
                loc: '1.2897,103.8501',
                timezone: 'Asia/Shanghai',
            };
        }
        if (validate_util_1.default.isBlank(ip) || ip === '127.0.0.1') {
            return {
                ip,
                country: 'SG',
                region: 'Singapore',
                city: 'Singapore',
                loc: '1.2897,103.8501',
                timezone: 'Asia/Singapore',
            };
        }
        const ipinfo = await this.redis.getData(this.ipinfoRedisKey, ip);
        if (ipinfo)
            return ipinfo;
        try {
            const response = await this.ipInfoClient.getIpInfo(ip);
            let ipInfoData = response;
            this.logger.info('IP info:', { ipInfoData });
            await this.redis.saveData(this.ipinfoRedisKey, ip, ipInfoData);
            if (ipInfoData.country === 'CN') {
                ipInfoData = {
                    ip,
                    country: 'SG',
                    region: 'Singapore',
                    city: 'Singapore',
                    loc: '1.2897,103.8501',
                    timezone: 'Asia/Singapore',
                };
            }
            return ipInfoData;
        }
        catch (error) {
            this.logger.error('Failed to fetch IP info:', error);
            return {
                ip,
                country: 'SG',
                region: 'Singapore',
                city: 'Singapore',
                loc: '1.2897,103.8501',
                timezone: 'Asia/Singapore',
            };
        }
    }
    /**
     * 获取 IP 对应的国家代码
     */
    async getIpCountry(ip) {
        const ipInfo = await this.getIpInfo(ip);
        return ipInfo.country;
    }
    /**
     * 获取 IP 对应的大洲
     *
     * @description 使用静态映射，不依赖数据库
     */
    async getContinent(ip) {
        const countryCode = await this.getIpCountry(ip);
        const defaultZone = enviroment_util_1.default.getBaseZone();
        return (0, continent_mapping_1.getContinentByCountry)(countryCode, defaultZone);
    }
    /**
     * 获取 IP 对应的时区
     */
    async getTimeZone(ip) {
        const ipInfo = await this.getIpInfo(ip);
        return ipInfo.timezone;
    }
};
exports.IpGeoService = IpGeoService;
exports.IpGeoService = IpGeoService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [redis_1.RedisService,
        ip_info_1.IpInfoClient,
        winston_1.Logger])
], IpGeoService);
//# sourceMappingURL=ip-geo.service.js.map