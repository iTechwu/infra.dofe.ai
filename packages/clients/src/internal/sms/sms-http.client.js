"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsHttpClient = void 0;
const crypto_1 = require("crypto");
const rxjs_1 = require("rxjs");
class SmsHttpClient {
    config;
    httpService;
    logger;
    constructor(config, httpService, logger) {
        this.config = config;
        this.httpService = httpService;
        this.logger = logger;
    }
    async sendSmsCode(phone, code, template) {
        try {
            const content = template.content.replace('{code}', code);
            this.logger.info(`发送HTTP短信验证码 ${code} 到 ${phone} 使用模板 ${template.name}`);
            const sendData = this.prepareSendData(phone, content, template);
            const response = await this.executeHttpRequest(sendData);
            this.logger.info('HTTP短信发送成功', {
                phone,
                code,
                template: template.name,
                response: response.data,
            });
            return {
                statusCode: 200,
                error: '0',
                data: response.data,
            };
        }
        catch (error) {
            this.logger.error(`HTTP短信发送失败: ${phone}`, {
                error: error.message,
                stack: error.stack,
            });
            return {
                statusCode: 500,
                error: '1',
                message: error.message,
            };
        }
    }
    prepareSendData(phone, content, template) {
        const timestamp = Date.now().toString();
        const sign = this.generateMd5Sign(this.config.appKey, this.config.accessSecret, timestamp);
        return {
            appkey: this.config.appKey,
            appcode: this.config.appCode,
            sign,
            phone,
            msg: content,
            timestamp,
        };
    }
    async executeHttpRequest(data) {
        const jsonData = JSON.stringify(data);
        const config = {
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
            },
            timeout: 30000,
        };
        this.logger.debug(`发送HTTP短信请求: ${this.config.endpoint}`, {
            data,
        });
        return await (0, rxjs_1.firstValueFrom)(this.httpService.post(this.config.endpoint, jsonData, config));
    }
    generateMd5Sign(appkey, appsecret, timestamp) {
        const param = appkey + appsecret + timestamp;
        return (0, crypto_1.createHash)('md5').update(param, 'utf8').digest('hex');
    }
}
exports.SmsHttpClient = SmsHttpClient;
//# sourceMappingURL=sms-http.client.js.map