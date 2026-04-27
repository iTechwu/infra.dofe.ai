"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
/**
 * Email Service
 *
 * 职责：提供邮件发送的业务逻辑
 * - 验证码生成和验证
 * - 邮件队列管理
 * - 发送频率限制
 */
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const redis_1 = require("../../../redis/src");
const rabbitmq_1 = require("../../../rabbitmq/src");
const verify_1 = require("../../../clients/src/internal/verify");
const errors_1 = require("@repo/contracts/errors");
const api_exception_1 = require("../../../common/src/filter/exception/api.exception");
const configuration_1 = require("../../../common/src/config/configuration");
const email_1 = require("../../../clients/src/internal/email");
let EmailService = class EmailService {
    verify;
    rabbitmq;
    redis;
    httpService;
    logger;
    deviceSendLoggerKey = 'emailCodeDevice';
    emailSendLoggerKey = 'emailCodeDevice';
    emailCodePerDayLoggerKey = 'emailCodePerDay';
    deviceCodePerDayLoggerKey = 'deviceCodePerDay';
    secretConfig;
    templates = {};
    emailClient;
    constructor(verify, rabbitmq, redis, httpService, logger) {
        this.verify = verify;
        this.rabbitmq = rabbitmq;
        this.redis = redis;
        this.httpService = httpService;
        this.logger = logger;
    }
    onModuleInit() {
        this.initializeEmailClient();
    }
    initializeEmailClient() {
        const sendcloudConfig = (0, configuration_1.getKeysConfig)()?.sendcloud;
        if (!sendcloudConfig) {
            this.logger.warn('SendCloud config not found');
            return;
        }
        this.secretConfig = sendcloudConfig;
        this.emailClient = new email_1.SendCloudClient(sendcloudConfig, this.httpService, this.logger);
        (sendcloudConfig.templates || []).forEach((template) => {
            this.templates[template.name] = template;
        });
    }
    async checkSendEmailTooFrequent(deviceId, email) {
        const { deviceLogger, emailLogger } = await this.getEmailSendLogger(deviceId, email);
        if (deviceLogger || emailLogger) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.TooFrequent);
        }
        const emailSendToday = await this.redis.getData(this.emailCodePerDayLoggerKey, email);
        if (emailSendToday && emailSendToday > 30) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.TooFrequent);
        }
        const deviceSendToday = await this.redis.getData(this.deviceCodePerDayLoggerKey, email);
        if (deviceSendToday && deviceSendToday > 30) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.TooFrequent);
        }
        return false;
    }
    async getEmailSendLogger(deviceId, email) {
        const deviceLogger = await this.redis.getData(this.deviceSendLoggerKey, deviceId);
        const emailLogger = await this.redis.getData(this.emailSendLoggerKey, email);
        return { deviceLogger, emailLogger };
    }
    async setEmailSendLogger(deviceId, email, expire) {
        expire = expire || 30;
        await this.redis.saveData(this.deviceSendLoggerKey, deviceId, '1', expire);
        await this.redis.saveData(this.emailSendLoggerKey, email, '1', expire);
        await this.redis.incrData(this.emailCodePerDayLoggerKey, email);
        await this.redis.incrData(this.deviceCodePerDayLoggerKey, email);
    }
    async processingEmail(user, deviceInfo, templateName, subValues) {
        const message = await this.getEmailContent(user, deviceInfo, templateName, subValues);
        await this.rabbitmq.sendMessageToRabbitMQ('sendcloud', message);
        return true;
    }
    async processingSendVerifyEmail(userInfo, deviceInfo) {
        const templateName = 'verify';
        const template = this.templates[templateName];
        if (!template) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.TemplateNotFound);
        }
        await this.checkSendEmailTooFrequent(deviceInfo.deviceid, userInfo.email);
        const to = userInfo.email;
        const code = await this.verify.generateEmailCode(to, template.codeExpire);
        const subValues = {
            name: userInfo.nickname,
            code: code,
        };
        return this.processingEmail(userInfo, deviceInfo, templateName, subValues);
    }
    async processingSendResetPasswordeEmail(emailAccount, deviceInfo) {
        const templateName = 'resetpassword';
        const template = this.templates[templateName];
        if (!template) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.TemplateNotFound);
        }
        await this.checkSendEmailTooFrequent(deviceInfo.deviceid, emailAccount.email);
        const to = emailAccount.email;
        const code = await this.verify.generateEmailCode(to, template.codeExpire);
        const subValues = {
            name: emailAccount.name,
            code: code,
        };
        return this.processingEmail(emailAccount, deviceInfo, templateName, subValues);
    }
    async processingSendRegisterEmail(emailAccount, deviceInfo) {
        const templateName = 'register';
        const template = this.templates[templateName];
        if (!template) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.TemplateNotFound);
        }
        await this.checkSendEmailTooFrequent(deviceInfo.deviceid, emailAccount.email);
        const to = emailAccount.email;
        const code = await this.verify.generateEmailCode(to, template.codeExpire);
        const subValues = {
            name: emailAccount.name,
            code: code,
        };
        return this.processingEmail(emailAccount, deviceInfo, templateName, subValues);
    }
    async getEmailContent(user, deviceInfo, templateName, subValues) {
        const template = this.templates[templateName];
        if (!template) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.TemplateNotFound);
        }
        const to = user.email;
        await this.setEmailSendLogger(deviceInfo.deviceid, user.email, template.frequency);
        const sub = template.sub;
        const subVery = {};
        if (sub && subValues) {
            for (const key in sub) {
                const subKey = sub[key];
                const subValue = subValues[subKey];
                if (subValue) {
                    subVery['%' + subKey + '%'] = [subValue];
                }
            }
        }
        return {
            to,
            subject: template.subject,
            templateInvokeName: template.templateInvokeName,
            sub: subVery,
            metadata: {
                deviceId: deviceInfo.deviceid,
            },
        };
    }
    getTemplateSub() {
        // Object.entries(subValues).forEach(([key, value]) => {
        //     sub['%' + key + '%'] = value
        // })
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [verify_1.VerifyClient,
        rabbitmq_1.RabbitmqService,
        redis_1.RedisService,
        axios_1.HttpService,
        winston_1.Logger])
], EmailService);
//# sourceMappingURL=email.service.js.map