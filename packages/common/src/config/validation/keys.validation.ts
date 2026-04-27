/**
 * Keys Configuration Validation Schema
 *
 * Validates the keys/config.json file using Zod.
 * This file contains sensitive API keys and credentials for third-party services.
 *
 * WARNING: This file contains sensitive information validation only.
 * Never log or expose the actual values.
 */
import { z } from 'zod';
import environment from '@/utils/environment.util';

// ============================================================================
// Exported Schemas (用于类型推断和外部使用)
// ============================================================================

// Email Service (SendCloud) Schema
export const emailTemplateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  from: z.string().min(1),
  templateInvokeName: z.string().min(1),
  frequency: z.number().int().positive().optional(),
  codeExpire: z.number().int().positive().optional(),
  sub: z.array(z.string()).optional(),
});

export const sendcloudSchema = z.object({
  vendor: z.string().min(1),
  apiUser: z.string().min(1),
  apiKey: z.string().min(1),
  domain: z.string().min(1),
  name: z.string().min(1),
  templates: z.array(emailTemplateSchema).optional(),
});

// SMS Provider Schemas
export const smsTemplateBaseSchema = z.object({
  name: z.string().optional(),
  sign: z.string().optional(),
  frequency: z.number().int().positive().optional(),
  codeExpire: z.number().int().positive().optional(),
});

export const smsProviderSchema = z.object({
  vendor: z.enum(['aliyun', 'volcengine', 'http', 'zxjcsms', 'tencent']),
  accessKey: z.string().min(1),
  accessSecret: z.string().min(1),
  endpoint: z.string().optional(),
  region: z.string().optional(),
  appKey: z.string().optional(),
  appCode: z.string().optional(),
  templates: z.array(z.record(z.string(), z.any())).optional(),
});

export const smsConfigSchema = z.object({
  default: z.string().min(1),
  providers: z.array(smsProviderSchema).min(1),
});

// Storage Provider Schema
export const storageCredentialsSchema = z.object({
  accessKey: z.string(),
  secretKey: z.string(),
});

export const storageConfigSchema = z.object({
  gcs: storageCredentialsSchema.optional(),
  us3: storageCredentialsSchema.optional(),
  qiniu: storageCredentialsSchema.optional(),
  oss: storageCredentialsSchema.optional(),
  tos: storageCredentialsSchema.optional(),
});

// OpenSpeech (Speech Recognition) Schema
// 阿里云语音识别配置
export const openspeechAliyunProviderSchema = z.object({
  /** Token 端点（用于获取 NLS Token） */
  tokenEndpoint: z.string().url().optional(),
  /** 录音文件识别 API 端点 */
  endpoint: z.string().url(),
  /** AccessKey ID */
  accessKeyId: z.string().optional(),
  /** AccessKey Secret */
  accessKeySecret: z.string().optional(),
  /** Access Key（备用字段） */
  accessKey: z.string().optional(),
  /** Secret Key（备用字段） */
  secretKey: z.string().optional(),
  /** NLS 应用 ID */
  nslAppId: z.string().optional(),
  /** NLS 应用 AppKey */
  nslAppKey: z.string().optional(),
  /** API 版本 */
  apiVersion: z.string().optional(),
});

// 火山引擎语音识别配置
export const openspeechVolcengineProviderSchema = z.object({
  /** 应用 ID */
  appId: z.string(),
  /** 应用访问令牌 */
  appAccessToken: z.string(),
  /** 用户 ID */
  uid: z.string(),
  /** 应用访问密钥（可选） */
  appAccessSecret: z.string().optional(),
  /** Access Key（用于签名，可选） */
  accessKey: z.string().optional(),
  /** Secret Key（用于签名，可选） */
  secretKey: z.string().optional(),
  /** 录音文件识别配置（非流式，大模型语音识别） */
  auc: z
    .object({
      /** API 端点（如：https://openspeech.bytedance.com/api/v3/auc/bigmodel） */
      endpoint: z.string().url(),
      /** 资源 ID（如：volc.seedasr.auc） */
      resourceId: z.string(),
    })
    .optional(),
  /** 流式语音识别配置（实时转写，大模型语音识别） */
  sauc: z
    .object({
      /** WebSocket 端点（如：wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async） */
      endpoint: z.string().url(),
      /** 资源 ID（如：volc.seedasr.sauc.duration） */
      resourceId: z.string(),
    })
    .optional(),
});

// 兼容旧配置格式的通用 schema（用于迁移期间）
export const openspeechProviderSchema = z.object({
  tokenEndpoint: z.string().url().optional(),
  endpoint: z.string().url().optional(),
  accessKeyId: z.string().optional(),
  accessKeySecret: z.string().optional(),
  accessKey: z.string().optional(),
  secretKey: z.string().optional(),
  nslAppId: z.string().optional(),
  nslAppKey: z.string().optional(),
  apiVersion: z.string().optional(),
  appId: z.string().optional(),
  appAccessToken: z.string().optional(),
  appAccessSecret: z.string().optional(),
  resourceId: z.string().optional(),
  uid: z.string().optional(),
  streamingEndpoint: z.string().url().optional(),
  // 新增：火山引擎分模式配置
  auc: z
    .object({
      endpoint: z.string().url(),
      resourceId: z.string(),
    })
    .optional(),
  sauc: z
    .object({
      endpoint: z.string().url(),
      resourceId: z.string(),
    })
    .optional(),
});

export const openspeechConfigSchema = z.object({
  /** 阿里云 OSS RAM 模式配置 */
  'oss-ram': openspeechAliyunProviderSchema.optional(),
  /** 阿里云 OSS 配置 */
  oss: openspeechAliyunProviderSchema.optional(),
  /** 火山引擎 TOS 配置（支持 auc 和 sauc 两种模式） */
  tos: openspeechVolcengineProviderSchema.optional(),
});

// TTS (Text-to-Speech) Schema
export const ttsProviderSchema = z.object({
  endpoint: z.string().url(),
  apiKey: z.string().optional(),
  resourceId: z.string().optional(),
  region: z.string().optional(),
  accessKey: z.string().optional(),
  secretKey: z.string().optional(),
  bucket: z.string().optional(),
});

export const ttsConfigSchema = z.object({
  volcengine: ttsProviderSchema.optional(),
  aliyun: ttsProviderSchema.optional(),
});

// Risk Detection Schema
export const riskProviderSchema = z.object({
  accessKey: z.string().min(1),
  secretKey: z.string().min(1),
  imageBaseUrl: z.string().optional(),
  baseUrl: z.string().url(),
  appId: z.number().int().optional(),
  region: z.string().optional(),
});

export const riskConfigSchema = z.object({
  volcengine: riskProviderSchema.optional(),
  aliyun: riskProviderSchema.optional(),
});

// Image Processing Schema
export const imageProviderSchema = z.object({
  accessKey: z.string().min(1),
  secretKey: z.string().min(1),
  imageBaseUrl: z.string().optional(),
  baseUrl: z.string().url(),
  region: z.string().optional(),
  serviceId: z.string().optional(),
});

export const imageConfigSchema = z.object({
  volcengine: imageProviderSchema.optional(),
  aliyun: imageProviderSchema.optional(),
});

// OpenAI Service Schema
export const openaiSchema = z.object({
  /** OpenAI API Key */
  apiKey: z.string().min(1),
  /** OpenAI Base URL */
  baseUrl: z.string().url().optional(),
});

// ExchangeRate Service Schema
export const exchangerateSchema = z.object({
  /** ExchangeRate Host API Key */
  apiKey: z.string().min(1),
  /** ExchangeRate Host Base URL */
  baseUrl: z.string().url(),
});

// Full Keys Configuration Schema
export const keysConfigSchema = z.object({
  sendcloud: sendcloudSchema.optional(),
  sms: smsConfigSchema.optional(),
  storage: storageConfigSchema.optional(),
  openspeech: openspeechConfigSchema.optional(),
  tts: ttsConfigSchema.optional(),
  risk: riskConfigSchema.optional(),
  image: imageConfigSchema.optional(),
  openai: openaiSchema.optional(),
  exchangerate: exchangerateSchema.optional(),
});

// ============================================================================
// Inferred Types (从 Zod schema 推断的类型)
// ============================================================================

/** 完整 Keys 配置类型 */
export type KeysConfig = z.infer<typeof keysConfigSchema>;

/** 邮件模板配置类型 */
export type EmailTemplateConfig = z.infer<typeof emailTemplateSchema>;

/** SendCloud 配置类型 */
export type SendCloudConfig = z.infer<typeof sendcloudSchema>;

/** SMS 模板基础配置类型 */
export type SmsTemplateBaseConfig = z.infer<typeof smsTemplateBaseSchema>;

/** SMS 提供商配置类型 */
export type SmsProviderConfig = z.infer<typeof smsProviderSchema>;

/** SMS 配置类型 */
export type SmsConfig = z.infer<typeof smsConfigSchema>;

/** 存储凭证配置类型 */
export type StorageCredentialsConfig = z.infer<typeof storageCredentialsSchema>;

/** 存储配置类型 */
export type StorageConfig = z.infer<typeof storageConfigSchema>;

/** 阿里云语音识别配置类型 */
export type OpenSpeechAliyunProviderConfig = z.infer<
  typeof openspeechAliyunProviderSchema
>;

/** 火山引擎语音识别配置类型 */
export type OpenSpeechVolcengineProviderConfig = z.infer<
  typeof openspeechVolcengineProviderSchema
>;

/** OpenSpeech 配置类型 */
export type OpenSpeechConfig = z.infer<typeof openspeechConfigSchema>;

/** TTS 提供商配置类型 */
export type TtsProviderConfig = z.infer<typeof ttsProviderSchema>;

/** TTS 配置类型 */
export type TtsConfig = z.infer<typeof ttsConfigSchema>;

/** 风控提供商配置类型 */
export type RiskProviderConfig = z.infer<typeof riskProviderSchema>;

/** 风控配置类型 */
export type RiskConfig = z.infer<typeof riskConfigSchema>;

/** 图像提供商配置类型 */
export type ImageProviderConfig = z.infer<typeof imageProviderSchema>;

/** 图像配置类型 */
export type ImageConfig = z.infer<typeof imageConfigSchema>;

/** OpenAI 配置类型 */
export type OpenAIConfig = z.infer<typeof openaiSchema>;

/** ExchangeRate 配置类型 */
export type ExchangeRateConfig = z.infer<typeof exchangerateSchema>;

/**
 * Validation result type
 */
export interface KeysValidationResult {
  success: boolean;
  data?: KeysConfig;
  errors?: z.ZodError;
}

/**
 * Validates keys configuration against the schema
 *
 * @param config - Parsed keys configuration object
 * @returns Validated keys configuration
 * @throws Error if validation fails
 */
export function validateKeysConfig(config: unknown): KeysConfig {
  const result = keysConfigSchema.safeParse(config);

  if (!result.success) {
    // Mask sensitive data in error messages
    // Zod 4 uses issues instead of errors
    const issues = (result.error as any).issues || [];
    const errorMessages = issues
      .map((err: any) => {
        const path = err.path.join('.');
        // Don't log actual values for security
        return `  - ${path}: ${err.message}`;
      })
      .join('\n');

    console.error('❌ Keys configuration validation failed:');
    console.error(errorMessages);

    throw new Error(`Keys configuration validation failed:\n${errorMessages}`);
  }

  if (environment.isProduction()) {
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
export function validateKeysConfigSafe(config: unknown): KeysValidationResult {
  const result = keysConfigSchema.safeParse(config);

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
export function isProviderConfigured(
  config: KeysConfig,
  provider:
    | 'sendcloud'
    | 'sms'
    | 'storage'
    | 'openspeech'
    | 'tts'
    | 'risk'
    | 'image'
    | 'openai'
    | 'exchangerate',
): boolean {
  return !!config[provider];
}

/**
 * Get configured SMS providers
 *
 * @param config - Keys configuration
 * @returns Array of configured SMS vendor names
 */
export function getConfiguredSmsProviders(config: KeysConfig): string[] {
  return config.sms?.providers.map((p) => p.vendor) || [];
}

/**
 * Get configured storage providers
 *
 * @param config - Keys configuration
 * @returns Array of configured storage provider names
 */
export function getConfiguredStorageProviders(config: KeysConfig): string[] {
  if (!config.storage) return [];

  return Object.entries(config.storage)
    .filter(([_, value]) => value && value.accessKey)
    .map(([key]) => key);
}
