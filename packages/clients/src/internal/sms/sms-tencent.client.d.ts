/**
 * 腾讯云 SMS Client
 *
 * 职责：仅负责与腾讯云 SMS API 通信
 * - 不访问数据库
 * - 不包含业务逻辑
 */
import { Logger } from 'winston';
import { SmsDefaultTemplate, SmsProviderConfig } from './dto/sms.dto';
export declare class SmsTencentClient {
    protected readonly config: SmsProviderConfig;
    protected readonly logger: Logger;
    private client;
    constructor(config: SmsProviderConfig, logger: Logger);
    private createClient;
    sendSmsCode(phone: string, code: string, template: SmsDefaultTemplate): Promise<import("tencentcloud-sdk-nodejs-sms/tencentcloud/services/sms/v20210111/sms_models").SendSmsResponse>;
}
