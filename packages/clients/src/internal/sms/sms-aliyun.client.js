"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsAliyunClient = void 0;
const dysmsapi20170525_1 = __importStar(require("@alicloud/dysmsapi20170525")), $Dysmsapi20170525 = dysmsapi20170525_1;
const $OpenApi = __importStar(require("@alicloud/openapi-client"));
class SmsAliyunClient {
    config;
    logger;
    client;
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.client = this.createClient(config);
    }
    createClient(smsConfig) {
        const config = new $OpenApi.Config({
            accessKeyId: smsConfig.accessKey,
            accessKeySecret: smsConfig.accessSecret,
        });
        config.endpoint = smsConfig.endpoint;
        return new dysmsapi20170525_1.default(config);
    }
    async sendSmsCode(phone, code, template) {
        this.logger.info(`发送验证码 ${code} 到 ${phone} 使用模板 ${template.name}`);
        const sendSmsRequest = new $Dysmsapi20170525.SendSmsRequest({
            phoneNumbers: phone,
            signName: template.sign,
            templateCode: template.templateCode,
            templateParam: `{"code":"${code}"}`,
        });
        try {
            return await this.client.sendSms(sendSmsRequest);
        }
        catch (error) {
            this.logger.error(`使用aliyun发送短信失败，手机号码：${phone}，错误信息：${error.message}`, error.data?.['Recommend']);
            throw error;
        }
    }
}
exports.SmsAliyunClient = SmsAliyunClient;
//# sourceMappingURL=sms-aliyun.client.js.map