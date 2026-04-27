/**
 * 火山引擎 SMS Client
 *
 * 职责：仅负责与火山引擎 SMS API 通信
 * - 不访问数据库
 * - 不包含业务逻辑
 */
import { Logger } from 'winston';
import { SmsProviderConfig, SmsVolcengineTemplate, VerifyCodeResult } from './dto/sms.dto';
import { RedisService } from "../../../../redis/src";
export declare class SmsVolcengineClient {
    protected readonly config: SmsProviderConfig;
    protected readonly redis: RedisService;
    protected readonly logger: Logger;
    private smsService;
    private readonly defaultSign;
    private readonly defaultSmsAccount;
    private readonly defaultTemplateId;
    constructor(config: SmsProviderConfig, redis: RedisService, logger: Logger);
    sendVerifyCode(phone: string, template: SmsVolcengineTemplate): Promise<import("@volcengine/openapi/lib/base/types").OpenApiResponse<import("@volcengine/openapi/lib/services/sms/types").SendVerifyCodeResponse>>;
    sendSmsCode(phone: string, code: string, template: SmsVolcengineTemplate): Promise<import("@volcengine/openapi/lib/base/types").OpenApiResponse<import("@volcengine/openapi/lib/services/sms/types").SendVerifyCodeResponse>>;
    checkVerifyCode(phoneNumber: string, code: string, template: SmsVolcengineTemplate): Promise<{
        success: boolean;
        result: VerifyCodeResult;
        message: string;
        data?: any;
    }>;
}
