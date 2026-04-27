import { Logger } from 'winston';
import { RedisService } from "../../../redis/src";
import { FastifyRequest } from 'fastify';
import { DoFeApp } from "../../../common/src/config/dto/config.dto";
import { Continent } from './continent-mapping';
import { IpInfoClient } from "../../../clients/src/internal/ip-info";
/**
 * IP 地理位置服务（Infra 层）
 *
 * @description 提供 IP 地理位置查询功能，使用静态大洲映射，不依赖数据库。
 *
 * @class IpGeoService
 */
export declare class IpGeoService {
    private readonly redis;
    private readonly ipInfoClient;
    private readonly logger;
    protected ipinfoRedisKey: string;
    constructor(redis: RedisService, ipInfoClient: IpInfoClient, logger: Logger);
    /**
     * 从请求中提取 IP 地址
     */
    extractIp(req: FastifyRequest): string;
    /**
     * 获取 IP 信息
     */
    getIpInfo(ip: string): Promise<Partial<DoFeApp.IPInfo>>;
    /**
     * 获取 IP 对应的国家代码
     */
    getIpCountry(ip: string): Promise<string>;
    /**
     * 获取 IP 对应的大洲
     *
     * @description 使用静态映射，不依赖数据库
     */
    getContinent(ip: string): Promise<Continent>;
    /**
     * 获取 IP 对应的时区
     */
    getTimeZone(ip: string): Promise<string>;
}
