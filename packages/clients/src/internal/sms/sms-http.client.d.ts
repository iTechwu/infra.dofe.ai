/**
 * HTTP SMS Client
 *
 * 职责：仅负责通过 HTTP 接口发送短信
 * - 不访问数据库
 * - 不包含业务逻辑
 */
import { Logger } from 'winston';
import { HttpService } from '@nestjs/axios';
import { SmsProviderConfig, SmsHttpTemplate } from './dto/sms.dto';
export declare class SmsHttpClient {
    protected readonly config: SmsProviderConfig;
    protected readonly httpService: HttpService;
    protected readonly logger: Logger;
    constructor(config: SmsProviderConfig, httpService: HttpService, logger: Logger);
    sendSmsCode(phone: string, code: string, template: SmsHttpTemplate): Promise<any>;
    private prepareSendData;
    private executeHttpRequest;
    private generateMd5Sign;
}
