import { OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Logger } from 'winston';
export interface ConvertCurrencyParams {
    from: string;
    to: string;
    amount: number;
}
export interface ConvertCurrencyResult {
    from: string;
    to: string;
    amount: number;
    convertedAmount: number;
    rate: number;
}
/**
 * ExchangeRate Client
 *
 * 职责：仅负责与 exchangerate.host API 通信
 * - 调用 exchangerate.host API 进行货币转换
 * - 不访问数据库
 * - 不包含业务逻辑
 */
export declare class ExchangeRateClient implements OnModuleInit {
    private readonly httpService;
    private readonly logger;
    private baseUrl;
    private apiKey;
    private exchangeRateConfig;
    constructor(httpService: HttpService, logger: Logger);
    onModuleInit(): void;
    /**
     * 获取汇率
     * @param from 源货币
     * @param to 目标货币
     * @returns 汇率
     */
    getRate(from: string, to: string): Promise<number>;
    /**
     * 货币转换
     * @param params 转换参数
     * @returns 转换结果
     */
    convert(params: ConvertCurrencyParams): Promise<ConvertCurrencyResult>;
    private ensureConfigured;
    private handleError;
    private extractErrorMessage;
}
