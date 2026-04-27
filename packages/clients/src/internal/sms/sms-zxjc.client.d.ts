/**
 * ZXJC SMS Client
 *
 * 职责：仅负责通过 ZXJC 接口发送短信
 * - 不访问数据库
 * - 不包含业务逻辑
 */
import { Logger } from 'winston';
import { HttpService } from '@nestjs/axios';
import { SmsProviderConfig, SmsZxjcTemplate } from './dto/sms.dto';
export declare class SmsZxjcClient {
    protected readonly config: SmsProviderConfig;
    protected readonly httpService: HttpService;
    protected readonly logger: Logger;
    constructor(config: SmsProviderConfig, httpService: HttpService, logger: Logger);
    sendSmsCode(phone: string, code: string, template: SmsZxjcTemplate): Promise<any>;
}
