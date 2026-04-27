import { HttpService } from '@nestjs/axios';
import { Logger } from 'winston';
import { ConfigService } from '@nestjs/config';
import { IpInfoResponse } from './dto/ip-info.dto';
export declare class IpInfoClient {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly config;
    constructor(httpService: HttpService, configService: ConfigService, logger: Logger);
    /**
     * 获取 IP 地理位置信息
     * @param ip IP 地址
     * @returns IP 信息
     */
    getIpInfo(ip: string): Promise<IpInfoResponse>;
}
