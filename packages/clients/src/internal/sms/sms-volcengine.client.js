"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsVolcengineClient = void 0;
const sms_dto_1 = require("./dto/sms.dto");
const openapi_1 = require("@volcengine/openapi");
const uuid_1 = require("uuid");
class SmsVolcengineClient {
    config;
    redis;
    logger;
    smsService;
    defaultSign;
    defaultSmsAccount;
    defaultTemplateId;
    constructor(config, redis, logger) {
        this.config = config;
        this.redis = redis;
        this.logger = logger;
        this.smsService = openapi_1.sms.defaultService;
        const accessKeyId = config.accessKey;
        const secretKey = config.accessSecret;
        if (!accessKeyId || !secretKey) {
            throw new Error('火山引擎SMS配置缺失：accessKey 或 accessSecret');
        }
        this.smsService.setAccessKeyId(accessKeyId);
        this.smsService.setSecretKey(secretKey);
        const defaultTemplate = config.templates?.[0];
        this.defaultSign = defaultTemplate?.sign || '';
        this.defaultSmsAccount = defaultTemplate?.smsAccount || '';
        this.defaultTemplateId = defaultTemplate?.templateId || '';
    }
    async sendVerifyCode(phone, template) {
        this.logger.info(`发送验证码到 ${phone} 使用模板 ${template.name}`);
        try {
            const response = await this.smsService.SendVerifyCode({
                SmsAccount: template.smsAccount || this.defaultSmsAccount,
                Sign: template.sign || this.defaultSign,
                TemplateID: template.templateId || this.defaultTemplateId,
                PhoneNumber: phone,
                Tag: template.tag || 'verify',
                UserExtCode: template.userExtCode || '',
                Scene: template.scene || 'verify',
                CodeType: template.codeType || 6,
                ExpireTime: template.expireTime || 300,
                TryCount: template.tryCount || 3,
            });
            this.logger.info(`火山引擎发送验证码成功，手机号码：${phone}`, {
                requestId: response.ResponseMetadata?.RequestId,
            });
            return response;
        }
        catch (error) {
            this.logger.error(`使用火山引擎发送验证码失败，手机号码：${phone}，错误信息：${error.message}`, error.stack);
            throw error;
        }
    }
    async sendSmsCode(phone, code, template) {
        this.logger.warn(`火山引擎SMS不支持传入验证码，将使用自动生成的验证码`);
        return await this.sendVerifyCode(phone, template);
    }
    async checkVerifyCode(phoneNumber, code, template) {
        try {
            const response = await this.smsService.CheckVerifyCode({
                SmsAccount: template.smsAccount || this.defaultSmsAccount,
                PhoneNumber: phoneNumber,
                Scene: template.scene || 'verify',
                Code: code,
            });
            if (response.ResponseMetadata?.Error) {
                return {
                    success: false,
                    result: sms_dto_1.VerifyCodeResult.INVALID_CODE,
                    message: response.ResponseMetadata.Error.Message || '验证码校验失败',
                };
            }
            const result = String(response.Result);
            if (result === sms_dto_1.VerifyCodeResult.SUCCESS) {
                const mobileTicket = (0, uuid_1.v4)();
                const requestId = response.ResponseMetadata?.RequestId || '';
                const ticketData = {
                    phoneNumber,
                    requestId,
                    createdAt: new Date().toISOString(),
                };
                await this.redis.set(`mobile_ticket:${mobileTicket}`, ticketData, {
                    EX: 300,
                });
                return {
                    success: true,
                    result: sms_dto_1.VerifyCodeResult.SUCCESS,
                    message: '验证码校验成功',
                    data: {
                        phoneNumber,
                        verifiedAt: new Date().toISOString(),
                        mobileTicket,
                    },
                };
            }
            const errorMessages = {
                [sms_dto_1.VerifyCodeResult.SUCCESS]: '验证成功',
                [sms_dto_1.VerifyCodeResult.INVALID_CODE]: '验证码错误',
                [sms_dto_1.VerifyCodeResult.EXPIRED]: '验证码已过期',
                [sms_dto_1.VerifyCodeResult.USED]: '验证码已使用',
                [sms_dto_1.VerifyCodeResult.NOT_FOUND]: '验证码不存在',
                [sms_dto_1.VerifyCodeResult.EXCEEDED]: '验证次数超限',
            };
            return {
                success: false,
                result,
                message: errorMessages[result] || '未知的验证结果',
            };
        }
        catch (error) {
            this.logger.error(`验证码校验异常: ${error.message}`, error.stack);
            return {
                success: false,
                result: sms_dto_1.VerifyCodeResult.INVALID_CODE,
                message: `验证码校验异常: ${error.message}`,
            };
        }
    }
}
exports.SmsVolcengineClient = SmsVolcengineClient;
//# sourceMappingURL=sms-volcengine.client.js.map