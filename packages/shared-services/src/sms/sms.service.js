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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsService = void 0;
/**
 * @fileoverview SMS Service
 * @module @app/shared-services/sms
 *
 * 职责：提供短信发送的业务逻辑服务
 *
 * 功能：
 * - 验证码生成和验证
 * - 短信队列管理
 * - 发送频率限制
 * - 多供应商支持（阿里云、腾讯云、火山引擎等）
 *
 * @example
 * ```typescript
 * // 发送验证码（通过队列）
 * await smsService.processingSendSmsVerifyCode(
 *   { mobile: '13800138000' },
 *   { deviceid: 'xxx' },
 *   'verify'
 * );
 *
 * // 火山引擎：发送并校验验证码
 * await smsService.sendVerifyCode('13800138000');
 * const result = await smsService.checkVerifyCode('13800138000', '123456');
 * ```
 */
const common_1 = require("@nestjs/common");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const axios_1 = require("@nestjs/axios");
const redis_1 = require("../../../redis/src");
const rabbitmq_1 = require("../../../rabbitmq/src");
const verify_1 = require("../../../clients/src/internal/verify");
const errors_1 = require("@repo/contracts/errors");
const api_exception_1 = require("../../../common/src/filter/exception/api.exception");
const configuration_1 = require("../../../common/src/config/configuration");
const sms_factory_1 = require("./sms.factory");
const types_1 = require("./types");
const enviroment_util_1 = __importDefault(require("../../../utils/dist/enviroment.util"));
// ============================================================================
// SMS Service
// ============================================================================
let SmsService = class SmsService {
    redis;
    verifyService;
    rabbitmq;
    httpService;
    logger;
    /** SMS 客户端工厂 */
    factory = null;
    constructor(redis, verifyService, rabbitmq, httpService, logger) {
        this.redis = redis;
        this.verifyService = verifyService;
        this.rabbitmq = rabbitmq;
        this.httpService = httpService;
        this.logger = logger;
    }
    // ========================================================================
    // Lifecycle
    // ========================================================================
    onModuleInit() {
        this.initializeSmsClient();
    }
    /**
     * 初始化 SMS 客户端工厂
     */
    initializeSmsClient() {
        const secretConfig = (0, configuration_1.getKeysConfig)()?.sms;
        if (!secretConfig) {
            this.logger.warn('SMS config not found, SMS service disabled');
            return;
        }
        try {
            this.factory = new sms_factory_1.SmsClientFactory({
                logger: this.logger,
                httpService: this.httpService,
                redis: this.redis,
            }, {
                defaultVendor: secretConfig.default,
                providers: secretConfig.providers,
            });
            if (enviroment_util_1.default.isProduction()) {
                this.logger.info(`SMS service initialized with vendor: ${this.factory.currentVendorName}`);
            }
        }
        catch (error) {
            this.logger.error('Failed to initialize SMS client', { error });
        }
    }
    // ========================================================================
    // Public Accessors
    // ========================================================================
    /**
     * 检查服务是否已初始化
     */
    get isInitialized() {
        return this.factory?.isInitialized ?? false;
    }
    /**
     * 获取当前供应商类型
     */
    get currentVendor() {
        return this.factory?.currentVendor ?? null;
    }
    /**
     * 获取当前供应商显示名称
     */
    get currentVendorName() {
        return this.factory?.currentVendorName ?? 'Unknown';
    }
    /**
     * 检查是否为火山引擎供应商
     */
    get isVolcengine() {
        return this.factory?.isVolcengine ?? false;
    }
    // ========================================================================
    // Device Rate Limiting
    // ========================================================================
    /**
     * 获取设备发送日志
     *
     * @param deviceId - 设备 ID
     * @returns 发送日志数据，不存在返回 null
     */
    async getDeviceSendLogger(deviceId) {
        return await this.redis.getData(types_1.DEVICE_SEND_LOGGER_KEY, deviceId);
    }
    /**
     * 设置设备发送日志（用于频率限制）
     *
     * @param deviceId - 设备 ID
     * @param expire - 过期时间（秒），默认 30 秒
     */
    async setDeviceSendLogger(deviceId, expire = types_1.DEFAULT_SEND_FREQUENCY) {
        await this.redis.saveData(types_1.DEVICE_SEND_LOGGER_KEY, deviceId, '1', expire);
    }
    /**
     * 检查设备是否在冷却期
     *
     * @param deviceId - 设备 ID
     * @returns 是否在冷却期
     */
    async isDeviceInCooldown(deviceId) {
        const data = await this.getDeviceSendLogger(deviceId);
        return data !== null;
    }
    // ========================================================================
    // SMS Operations - Core
    // ========================================================================
    /**
     * 发送短信验证码（底层方法）
     *
     * @param mobile - 手机号码
     * @param code - 验证码
     * @param template - 短信模板
     * @returns 发送结果
     */
    async doSendSmsCode(mobile, code, template) {
        this.ensureInitialized();
        return await this.factory.sendSmsCode(mobile, code, template);
    }
    /**
     * 发送验证码（火山引擎自动生成验证码）
     *
     * 仅火山引擎供应商支持此功能
     *
     * @param phoneNumber - 手机号码
     * @param templateId - 模板 ID，默认 'verify'
     * @returns 发送结果
     * @throws Error 如果当前供应商不是火山引擎
     */
    async sendVerifyCode(phoneNumber, templateId = 'verify') {
        this.ensureInitialized();
        return await this.factory.sendVerifyCode(phoneNumber, templateId);
    }
    /**
     * 校验验证码（火山引擎）
     *
     * 仅火山引擎供应商支持此功能
     *
     * @param phoneNumber - 手机号码
     * @param code - 验证码
     * @param templateId - 模板 ID，默认 'verify'
     * @returns 校验结果
     * @throws Error 如果当前供应商不是火山引擎
     */
    async checkVerifyCode(phoneNumber, code, templateId = 'verify') {
        this.ensureInitialized();
        return await this.factory.checkVerifyCode(phoneNumber, code, templateId);
    }
    // ========================================================================
    // SMS Operations - Business Logic
    // ========================================================================
    /**
     * 处理发送短信验证码请求
     *
     * 包含完整的业务逻辑：
     * 1. 验证模板存在
     * 2. 检查发送频率限制
     * 3. 生成验证码
     * 4. 发送到消息队列（数据库写入由消费者处理）
     *
     * @param mobileAccount - 手机账户信息
     * @param deviceInfo - 设备信息
     * @param templateId - 模板 ID，默认 'verify'
     * @throws ApiException 如果模板不存在或发送太频繁
     */
    async processingSendSmsVerifyCode(mobileAccount, deviceInfo, templateId = 'verify') {
        this.ensureInitialized();
        // 1. 验证模板存在
        const template = this.factory.getTemplate(templateId);
        if (!template) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.TemplateNotFound);
        }
        // 2. 检查发送频率限制
        const isInCooldown = await this.isDeviceInCooldown(deviceInfo.deviceid);
        if (isInCooldown) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.TooFrequent);
        }
        // 3. 设置频率限制
        const templateMeta = this.factory.getTemplateMeta(templateId);
        const frequency = templateMeta?.frequency ?? types_1.DEFAULT_SEND_FREQUENCY;
        const codeExpire = templateMeta?.codeExpire ?? types_1.DEFAULT_CODE_EXPIRE;
        await this.setDeviceSendLogger(deviceInfo.deviceid, frequency);
        // 4. 生成验证码
        const code = await this.verifyService.generateMobileCode(mobileAccount.mobile, codeExpire);
        // 5. 发送到消息队列（数据库写入由消费者处理）
        await this.rabbitmq.sendMessageToRabbitMQ('smsSend', {
            mobile: mobileAccount.mobile,
            code,
            templateId,
            metadata: {
                deviceId: deviceInfo.deviceid,
            },
        });
    }
    // ========================================================================
    // Private Helpers
    // ========================================================================
    /**
     * 确保服务已初始化
     */
    ensureInitialized() {
        if (!this.factory?.isInitialized) {
            throw new Error('SMS service not initialized. Check SMS configuration.');
        }
    }
};
exports.SmsService = SmsService;
exports.SmsService = SmsService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [redis_1.RedisService,
        verify_1.VerifyClient,
        rabbitmq_1.RabbitmqService,
        axios_1.HttpService,
        winston_1.Logger])
], SmsService);
//# sourceMappingURL=sms.service.js.map