"use strict";
/**
 * @fileoverview SMS Client Factory
 * @module @app/shared-services/sms/sms.factory
 *
 * 负责创建和管理 SMS 客户端实例
 *
 * 功能：
 * - 根据供应商类型创建对应的 SMS 客户端
 * - 管理模板配置
 * - 提供统一的客户端访问接口
 *
 * @example
 * ```typescript
 * const factory = new SmsClientFactory(
 *   { logger, httpService, redis },
 *   { defaultVendor: 'volcengine', providers: [...] }
 * );
 *
 * // 发送短信
 * await factory.sendSmsCode('13800138000', '123456', 'verify');
 *
 * // 火山引擎专用：验证码校验
 * const result = await factory.checkVerifyCode('13800138000', '123456');
 * ```
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsClientFactory = void 0;
const sms_1 = require("../../../clients/src/internal/sms");
const types_1 = require("./types");
const enviroment_util_1 = __importDefault(require("../../../utils/dist/enviroment.util"));
// ============================================================================
// SMS Client Factory
// ============================================================================
/**
 * SMS 客户端工厂
 *
 * 负责创建和管理不同供应商的 SMS 客户端
 */
class SmsClientFactory {
    /** 当前供应商配置 */
    provider = null;
    /** 当前供应商类型 */
    vendor = null;
    /** SMS 客户端实例 */
    client = null;
    /** 模板配置映射 */
    templates = {};
    /** 日志器 */
    logger;
    /** HTTP 服务 */
    httpService;
    /** Redis 服务 */
    redis;
    constructor(dependencies, config) {
        this.logger = dependencies.logger;
        this.httpService = dependencies.httpService;
        this.redis = dependencies.redis;
        if (config) {
            this.initializeFromConfig(config);
        }
    }
    /**
     * 从配置初始化
     */
    initializeFromConfig(config) {
        const { defaultVendor, providers } = config;
        const providerConfig = providers.find((p) => p.vendor === defaultVendor);
        if (!providerConfig) {
            this.logger.warn(`SMS provider not found: ${defaultVendor}`);
            return;
        }
        // 使用类型断言来绕过 readonly 限制（仅在构造函数中）
        this.provider = providerConfig;
        this.vendor = defaultVendor;
        this.client = this.createClient(providerConfig);
        // 初始化模板
        this.initializeTemplates(providerConfig);
    }
    /**
     * 初始化模板配置
     */
    initializeTemplates(provider) {
        if (!provider.templates)
            return;
        provider.templates.forEach((template) => {
            const meta = template;
            const name = meta.name || 'default';
            this.templates[name] = template;
        });
        if (enviroment_util_1.default.isProduction()) {
            this.logger.info(`SMS templates initialized: ${Object.keys(this.templates).join(', ')}`);
        }
    }
    /**
     * 创建 SMS 客户端
     */
    createClient(provider) {
        const vendor = provider.vendor;
        if (enviroment_util_1.default.isProduction()) {
            this.logger.info(`Creating SMS client for vendor: ${types_1.SMS_VENDOR_NAMES[vendor] || vendor}`);
        }
        switch (vendor) {
            case 'aliyun':
                return new sms_1.SmsAliyunClient(provider, this.logger);
            case 'tencent':
                return new sms_1.SmsTencentClient(provider, this.logger);
            case 'http':
                if (!this.httpService) {
                    throw new Error('HttpService is required for HTTP SMS client');
                }
                return new sms_1.SmsHttpClient(provider, this.httpService, this.logger);
            case 'zxjcsms':
                if (!this.httpService) {
                    throw new Error('HttpService is required for ZXJC SMS client');
                }
                return new sms_1.SmsZxjcClient(provider, this.httpService, this.logger);
            case 'volcengine':
                if (!this.redis) {
                    throw new Error('RedisService is required for Volcengine SMS client');
                }
                return new sms_1.SmsVolcengineClient(provider, this.redis, this.logger);
            default:
                throw new Error(`Unsupported SMS vendor: ${vendor}`);
        }
    }
    // ========================================================================
    // Public Accessors
    // ========================================================================
    /**
     * 检查工厂是否已初始化
     */
    get isInitialized() {
        return this.client !== null;
    }
    /**
     * 获取当前供应商类型
     */
    get currentVendor() {
        return this.vendor;
    }
    /**
     * 获取当前供应商显示名称
     */
    get currentVendorName() {
        return this.vendor ? types_1.SMS_VENDOR_NAMES[this.vendor] : 'Unknown';
    }
    /**
     * 检查是否为火山引擎供应商
     */
    get isVolcengine() {
        return this.vendor === 'volcengine';
    }
    /**
     * 获取所有模板名称
     */
    get templateNames() {
        return Object.keys(this.templates);
    }
    // ========================================================================
    // Template Management
    // ========================================================================
    /**
     * 获取模板配置
     *
     * @param templateId - 模板 ID
     * @returns 模板配置，不存在返回 undefined
     */
    getTemplate(templateId) {
        return this.templates[templateId];
    }
    /**
     * 获取模板配置（必须存在）
     *
     * @param templateId - 模板 ID
     * @throws Error 如果模板不存在
     */
    getTemplateOrThrow(templateId) {
        const template = this.templates[templateId];
        if (!template) {
            throw new Error(`SMS template not found: ${templateId}`);
        }
        return template;
    }
    /**
     * 获取模板元数据
     *
     * @param templateId - 模板 ID
     * @returns 模板元数据
     */
    getTemplateMeta(templateId) {
        const template = this.templates[templateId];
        if (!template)
            return undefined;
        return {
            name: template.name,
            frequency: template.frequency,
            codeExpire: template.codeExpire,
        };
    }
    // ========================================================================
    // SMS Operations
    // ========================================================================
    /**
     * 发送短信验证码
     *
     * @param phone - 手机号码
     * @param code - 验证码
     * @param templateId - 模板 ID
     * @returns 发送结果
     */
    async sendSmsCode(phone, code, templateId = 'verify') {
        this.ensureInitialized();
        const template = this.getTemplateOrThrow(templateId);
        this.logger.info(`Sending SMS code to ${phone}`, {
            vendor: this.currentVendorName,
            templateId,
        });
        return await this.client.sendSmsCode(phone, code, template);
    }
    /**
     * 发送验证码（火山引擎自动生成）
     *
     * 仅火山引擎供应商支持此功能
     *
     * @param phoneNumber - 手机号码
     * @param templateId - 模板 ID
     * @throws Error 如果当前供应商不是火山引擎
     */
    async sendVerifyCode(phoneNumber, templateId = 'verify') {
        this.ensureInitialized();
        this.ensureVolcengine('sendVerifyCode');
        const template = this.getTemplateOrThrow(templateId);
        return await this.client.sendVerifyCode(phoneNumber, template);
    }
    /**
     * 校验验证码（火山引擎）
     *
     * 仅火山引擎供应商支持此功能
     *
     * @param phoneNumber - 手机号码
     * @param code - 验证码
     * @param templateId - 模板 ID
     * @throws Error 如果当前供应商不是火山引擎
     */
    async checkVerifyCode(phoneNumber, code, templateId = 'verify') {
        this.ensureInitialized();
        this.ensureVolcengine('checkVerifyCode');
        const template = this.getTemplateOrThrow(templateId);
        return await this.client.checkVerifyCode(phoneNumber, code, template);
    }
    // ========================================================================
    // Private Helpers
    // ========================================================================
    /**
     * 确保工厂已初始化
     */
    ensureInitialized() {
        if (!this.client) {
            throw new Error('SMS client not initialized. Check SMS configuration.');
        }
    }
    /**
     * 确保当前供应商为火山引擎
     */
    ensureVolcengine(methodName) {
        if (!this.isVolcengine) {
            throw new Error(`${methodName} is only supported by Volcengine SMS`);
        }
    }
}
exports.SmsClientFactory = SmsClientFactory;
//# sourceMappingURL=sms.factory.js.map