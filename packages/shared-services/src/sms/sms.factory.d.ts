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
import { SmsVendor, SmsTemplate, SmsTemplateMeta, SmsClientDependencies, SmsFactoryConfig, SmsSendResult, VerifyCodeCheckResult } from './types';
/**
 * SMS 客户端工厂
 *
 * 负责创建和管理不同供应商的 SMS 客户端
 */
export declare class SmsClientFactory {
    /** 当前供应商配置 */
    private readonly provider;
    /** 当前供应商类型 */
    private readonly vendor;
    /** SMS 客户端实例 */
    private readonly client;
    /** 模板配置映射 */
    private readonly templates;
    /** 日志器 */
    private readonly logger;
    /** HTTP 服务 */
    private readonly httpService?;
    /** Redis 服务 */
    private readonly redis?;
    constructor(dependencies: SmsClientDependencies, config?: SmsFactoryConfig);
    /**
     * 从配置初始化
     */
    private initializeFromConfig;
    /**
     * 初始化模板配置
     */
    private initializeTemplates;
    /**
     * 创建 SMS 客户端
     */
    private createClient;
    /**
     * 检查工厂是否已初始化
     */
    get isInitialized(): boolean;
    /**
     * 获取当前供应商类型
     */
    get currentVendor(): SmsVendor | null;
    /**
     * 获取当前供应商显示名称
     */
    get currentVendorName(): string;
    /**
     * 检查是否为火山引擎供应商
     */
    get isVolcengine(): boolean;
    /**
     * 获取所有模板名称
     */
    get templateNames(): string[];
    /**
     * 获取模板配置
     *
     * @param templateId - 模板 ID
     * @returns 模板配置，不存在返回 undefined
     */
    getTemplate(templateId: string): SmsTemplate | undefined;
    /**
     * 获取模板配置（必须存在）
     *
     * @param templateId - 模板 ID
     * @throws Error 如果模板不存在
     */
    getTemplateOrThrow(templateId: string): SmsTemplate;
    /**
     * 获取模板元数据
     *
     * @param templateId - 模板 ID
     * @returns 模板元数据
     */
    getTemplateMeta(templateId: string): SmsTemplateMeta | undefined;
    /**
     * 发送短信验证码
     *
     * @param phone - 手机号码
     * @param code - 验证码
     * @param templateId - 模板 ID
     * @returns 发送结果
     */
    sendSmsCode(phone: string, code: string, templateId?: string): Promise<SmsSendResult>;
    /**
     * 发送验证码（火山引擎自动生成）
     *
     * 仅火山引擎供应商支持此功能
     *
     * @param phoneNumber - 手机号码
     * @param templateId - 模板 ID
     * @throws Error 如果当前供应商不是火山引擎
     */
    sendVerifyCode(phoneNumber: string, templateId?: string): Promise<any>;
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
    checkVerifyCode(phoneNumber: string, code: string, templateId?: string): Promise<VerifyCodeCheckResult>;
    /**
     * 确保工厂已初始化
     */
    private ensureInitialized;
    /**
     * 确保当前供应商为火山引擎
     */
    private ensureVolcengine;
}
