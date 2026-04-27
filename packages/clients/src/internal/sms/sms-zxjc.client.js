"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsZxjcClient = void 0;
const rxjs_1 = require("rxjs");
class SmsZxjcClient {
    config;
    httpService;
    logger;
    constructor(config, httpService, logger) {
        this.config = config;
        this.httpService = httpService;
        this.logger = logger;
    }
    async sendSmsCode(phone, code, template) {
        const content = template.content.replace('code', code);
        this.logger.info(`发送验证码 ${code} 到 ${phone} 使用模板 ${content}`);
        const sendContent = {
            ...template,
            content,
            calledNumber: phone,
        };
        this.logger.info('发送内容：', sendContent);
        const url = 'http://139.224.36.226:382/wgws/OrderServlet4J';
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, sendContent, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }));
            this.logger.info('doSendSmsCode success', response);
            return response.data;
        }
        catch (e) {
            this.logger.error('doSendSmsCode error', e);
            throw e;
        }
    }
}
exports.SmsZxjcClient = SmsZxjcClient;
//# sourceMappingURL=sms-zxjc.client.js.map