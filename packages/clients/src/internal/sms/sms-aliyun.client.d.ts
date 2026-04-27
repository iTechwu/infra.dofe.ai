/**
 * 阿里云 SMS Client
 *
 * 职责：仅负责与阿里云 SMS API 通信
 * - 不访问数据库
 * - 不包含业务逻辑
 */
import { Logger } from 'winston';
import { SmsProviderConfig, SmsDefaultTemplate } from './dto/sms.dto';
import * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525';
export declare class SmsAliyunClient {
    protected readonly config: SmsProviderConfig;
    protected readonly logger: Logger;
    private client;
    constructor(config: SmsProviderConfig, logger: Logger);
    private createClient;
    sendSmsCode(phone: string, code: string, template: SmsDefaultTemplate): Promise<$Dysmsapi20170525.SendSmsResponse>;
}
