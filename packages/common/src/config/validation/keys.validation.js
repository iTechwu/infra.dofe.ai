"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.keysConfigSchema = exports.exchangerateSchema = exports.openaiSchema = exports.imageConfigSchema = exports.imageProviderSchema = exports.riskConfigSchema = exports.riskProviderSchema = exports.ttsConfigSchema = exports.ttsProviderSchema = exports.openspeechConfigSchema = exports.openspeechProviderSchema = exports.openspeechVolcengineProviderSchema = exports.openspeechAliyunProviderSchema = exports.storageConfigSchema = exports.storageCredentialsSchema = exports.smsConfigSchema = exports.smsProviderSchema = exports.smsTemplateBaseSchema = exports.sendcloudSchema = exports.emailTemplateSchema = void 0;
exports.validateKeysConfig = validateKeysConfig;
exports.validateKeysConfigSafe = validateKeysConfigSafe;
exports.isProviderConfigured = isProviderConfigured;
exports.getConfiguredSmsProviders = getConfiguredSmsProviders;
exports.getConfiguredStorageProviders = getConfiguredStorageProviders;
/**
 * Keys Configuration Validation Schema
 *
 * Validates the keys/config.json file using Zod.
 * This file contains sensitive API keys and credentials for third-party services.
 *
 * WARNING: This file contains sensitive information validation only.
 * Never log or expose the actual values.
 */
const zod_1 = require("zod");
const enviroment_util_1 = __importDefault(require("@/utils/enviroment.util"));
// ============================================================================
// Exported Schemas (用于类型推断和外部使用)
// ============================================================================
// Email Service (SendCloud) Schema
exports.emailTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    subject: zod_1.z.string().min(1),
    from: zod_1.z.string().min(1),
    templateInvokeName: zod_1.z.string().min(1),
    frequency: zod_1.z.number().int().positive().optional(),
    codeExpire: zod_1.z.number().int().positive().optional(),
    sub: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.sendcloudSchema = zod_1.z.object({
    vendor: zod_1.z.string().min(1),
    apiUser: zod_1.z.string().min(1),
    apiKey: zod_1.z.string().min(1),
    domain: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    templates: zod_1.z.array(exports.emailTemplateSchema).optional(),
});
// SMS Provider Schemas
exports.smsTemplateBaseSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    sign: zod_1.z.string().optional(),
    frequency: zod_1.z.number().int().positive().optional(),
    codeExpire: zod_1.z.number().int().positive().optional(),
});
exports.smsProviderSchema = zod_1.z.object({
    vendor: zod_1.z.enum(['aliyun', 'volcengine', 'http', 'zxjcsms', 'tencent']),
    accessKey: zod_1.z.string().min(1),
    accessSecret: zod_1.z.string().min(1),
    endpoint: zod_1.z.string().optional(),
    region: zod_1.z.string().optional(),
    appKey: zod_1.z.string().optional(),
    appCode: zod_1.z.string().optional(),
    templates: zod_1.z.array(zod_1.z.record(zod_1.z.string(), zod_1.z.any())).optional(),
});
exports.smsConfigSchema = zod_1.z.object({
    default: zod_1.z.string().min(1),
    providers: zod_1.z.array(exports.smsProviderSchema).min(1),
});
// Storage Provider Schema
exports.storageCredentialsSchema = zod_1.z.object({
    accessKey: zod_1.z.string(),
    secretKey: zod_1.z.string(),
});
exports.storageConfigSchema = zod_1.z.object({
    gcs: exports.storageCredentialsSchema.optional(),
    us3: exports.storageCredentialsSchema.optional(),
    qiniu: exports.storageCredentialsSchema.optional(),
    oss: exports.storageCredentialsSchema.optional(),
    tos: exports.storageCredentialsSchema.optional(),
});
// OpenSpeech (Speech Recognition) Schema
// 阿里云语音识别配置
exports.openspeechAliyunProviderSchema = zod_1.z.object({
    /** Token 端点（用于获取 NLS Token） */
    tokenEndpoint: zod_1.z.string().url().optional(),
    /** 录音文件识别 API 端点 */
    endpoint: zod_1.z.string().url(),
    /** AccessKey ID */
    accessKeyId: zod_1.z.string().optional(),
    /** AccessKey Secret */
    accessKeySecret: zod_1.z.string().optional(),
    /** Access Key（备用字段） */
    accessKey: zod_1.z.string().optional(),
    /** Secret Key（备用字段） */
    secretKey: zod_1.z.string().optional(),
    /** NLS 应用 ID */
    nslAppId: zod_1.z.string().optional(),
    /** NLS 应用 AppKey */
    nslAppKey: zod_1.z.string().optional(),
    /** API 版本 */
    apiVersion: zod_1.z.string().optional(),
});
// 火山引擎语音识别配置
exports.openspeechVolcengineProviderSchema = zod_1.z.object({
    /** 应用 ID */
    appId: zod_1.z.string(),
    /** 应用访问令牌 */
    appAccessToken: zod_1.z.string(),
    /** 用户 ID */
    uid: zod_1.z.string(),
    /** 应用访问密钥（可选） */
    appAccessSecret: zod_1.z.string().optional(),
    /** Access Key（用于签名，可选） */
    accessKey: zod_1.z.string().optional(),
    /** Secret Key（用于签名，可选） */
    secretKey: zod_1.z.string().optional(),
    /** 录音文件识别配置（非流式，大模型语音识别） */
    auc: zod_1.z
        .object({
        /** API 端点（如：https://openspeech.bytedance.com/api/v3/auc/bigmodel） */
        endpoint: zod_1.z.string().url(),
        /** 资源 ID（如：volc.seedasr.auc） */
        resourceId: zod_1.z.string(),
    })
        .optional(),
    /** 流式语音识别配置（实时转写，大模型语音识别） */
    sauc: zod_1.z
        .object({
        /** WebSocket 端点（如：wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async） */
        endpoint: zod_1.z.string().url(),
        /** 资源 ID（如：volc.seedasr.sauc.duration） */
        resourceId: zod_1.z.string(),
    })
        .optional(),
});
// 兼容旧配置格式的通用 schema（用于迁移期间）
exports.openspeechProviderSchema = zod_1.z.object({
    tokenEndpoint: zod_1.z.string().url().optional(),
    endpoint: zod_1.z.string().url().optional(),
    accessKeyId: zod_1.z.string().optional(),
    accessKeySecret: zod_1.z.string().optional(),
    accessKey: zod_1.z.string().optional(),
    secretKey: zod_1.z.string().optional(),
    nslAppId: zod_1.z.string().optional(),
    nslAppKey: zod_1.z.string().optional(),
    apiVersion: zod_1.z.string().optional(),
    appId: zod_1.z.string().optional(),
    appAccessToken: zod_1.z.string().optional(),
    appAccessSecret: zod_1.z.string().optional(),
    resourceId: zod_1.z.string().optional(),
    uid: zod_1.z.string().optional(),
    streamingEndpoint: zod_1.z.string().url().optional(),
    // 新增：火山引擎分模式配置
    auc: zod_1.z
        .object({
        endpoint: zod_1.z.string().url(),
        resourceId: zod_1.z.string(),
    })
        .optional(),
    sauc: zod_1.z
        .object({
        endpoint: zod_1.z.string().url(),
        resourceId: zod_1.z.string(),
    })
        .optional(),
});
exports.openspeechConfigSchema = zod_1.z.object({
    /** 阿里云 OSS RAM 模式配置 */
    'oss-ram': exports.openspeechAliyunProviderSchema.optional(),
    /** 阿里云 OSS 配置 */
    oss: exports.openspeechAliyunProviderSchema.optional(),
    /** 火山引擎 TOS 配置（支持 auc 和 sauc 两种模式） */
    tos: exports.openspeechVolcengineProviderSchema.optional(),
});
// TTS (Text-to-Speech) Schema
exports.ttsProviderSchema = zod_1.z.object({
    endpoint: zod_1.z.string().url(),
    apiKey: zod_1.z.string().optional(),
    resourceId: zod_1.z.string().optional(),
    region: zod_1.z.string().optional(),
    accessKey: zod_1.z.string().optional(),
    secretKey: zod_1.z.string().optional(),
    bucket: zod_1.z.string().optional(),
});
exports.ttsConfigSchema = zod_1.z.object({
    volcengine: exports.ttsProviderSchema.optional(),
    aliyun: exports.ttsProviderSchema.optional(),
});
// Risk Detection Schema
exports.riskProviderSchema = zod_1.z.object({
    accessKey: zod_1.z.string().min(1),
    secretKey: zod_1.z.string().min(1),
    imageBaseUrl: zod_1.z.string().optional(),
    baseUrl: zod_1.z.string().url(),
    appId: zod_1.z.number().int().optional(),
    region: zod_1.z.string().optional(),
});
exports.riskConfigSchema = zod_1.z.object({
    volcengine: exports.riskProviderSchema.optional(),
    aliyun: exports.riskProviderSchema.optional(),
});
// Image Processing Schema
exports.imageProviderSchema = zod_1.z.object({
    accessKey: zod_1.z.string().min(1),
    secretKey: zod_1.z.string().min(1),
    imageBaseUrl: zod_1.z.string().optional(),
    baseUrl: zod_1.z.string().url(),
    region: zod_1.z.string().optional(),
    serviceId: zod_1.z.string().optional(),
});
exports.imageConfigSchema = zod_1.z.object({
    volcengine: exports.imageProviderSchema.optional(),
    aliyun: exports.imageProviderSchema.optional(),
});
// OpenAI Service Schema
exports.openaiSchema = zod_1.z.object({
    /** OpenAI API Key */
    apiKey: zod_1.z.string().min(1),
    /** OpenAI Base URL */
    baseUrl: zod_1.z.string().url().optional(),
});
// ExchangeRate Service Schema
exports.exchangerateSchema = zod_1.z.object({
    /** ExchangeRate Host API Key */
    apiKey: zod_1.z.string().min(1),
    /** ExchangeRate Host Base URL */
    baseUrl: zod_1.z.string().url(),
});
// Full Keys Configuration Schema
exports.keysConfigSchema = zod_1.z.object({
    sendcloud: exports.sendcloudSchema.optional(),
    sms: exports.smsConfigSchema.optional(),
    storage: exports.storageConfigSchema.optional(),
    openspeech: exports.openspeechConfigSchema.optional(),
    tts: exports.ttsConfigSchema.optional(),
    risk: exports.riskConfigSchema.optional(),
    image: exports.imageConfigSchema.optional(),
    openai: exports.openaiSchema.optional(),
    exchangerate: exports.exchangerateSchema.optional(),
});
/**
 * Validates keys configuration against the schema
 *
 * @param config - Parsed keys configuration object
 * @returns Validated keys configuration
 * @throws Error if validation fails
 */
function validateKeysConfig(config) {
    const result = exports.keysConfigSchema.safeParse(config);
    if (!result.success) {
        // Mask sensitive data in error messages
        // Zod 4 uses issues instead of errors
        const issues = result.error.issues || [];
        const errorMessages = issues
            .map((err) => {
            const path = err.path.join('.');
            // Don't log actual values for security
            return `  - ${path}: ${err.message}`;
        })
            .join('\n');
        console.error('❌ Keys configuration validation failed:');
        console.error(errorMessages);
        throw new Error(`Keys configuration validation failed:\n${errorMessages}`);
    }
    if (enviroment_util_1.default.isProduction()) {
        console.log('✅ Keys configuration validated successfully');
    }
    return result.data;
}
/**
 * Validates keys configuration and returns detailed result
 *
 * @param config - Parsed keys configuration object
 * @returns Validation result with success status and data or errors
 */
function validateKeysConfigSafe(config) {
    const result = exports.keysConfigSchema.safeParse(config);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
}
/**
 * Checks if a specific provider is configured
 *
 * @param config - Keys configuration
 * @param provider - Provider name to check
 * @returns Boolean indicating if provider is configured
 */
function isProviderConfigured(config, provider) {
    return !!config[provider];
}
/**
 * Get configured SMS providers
 *
 * @param config - Keys configuration
 * @returns Array of configured SMS vendor names
 */
function getConfiguredSmsProviders(config) {
    return config.sms?.providers.map((p) => p.vendor) || [];
}
/**
 * Get configured storage providers
 *
 * @param config - Keys configuration
 * @returns Array of configured storage provider names
 */
function getConfiguredStorageProviders(config) {
    if (!config.storage)
        return [];
    return Object.entries(config.storage)
        .filter(([_, value]) => value && value.accessKey)
        .map(([key]) => key);
}
//# sourceMappingURL=keys.validation.js.map