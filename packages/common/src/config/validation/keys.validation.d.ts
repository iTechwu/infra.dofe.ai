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
export declare const emailTemplateSchema: z.ZodObject<{
    name: z.ZodString;
    subject: z.ZodString;
    from: z.ZodString;
    templateInvokeName: z.ZodString;
    frequency: z.ZodOptional<z.ZodNumber>;
    codeExpire: z.ZodOptional<z.ZodNumber>;
    sub: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const sendcloudSchema: z.ZodObject<{
    vendor: z.ZodString;
    apiUser: z.ZodString;
    apiKey: z.ZodString;
    domain: z.ZodString;
    name: z.ZodString;
    templates: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        subject: z.ZodString;
        from: z.ZodString;
        templateInvokeName: z.ZodString;
        frequency: z.ZodOptional<z.ZodNumber>;
        codeExpire: z.ZodOptional<z.ZodNumber>;
        sub: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const smsTemplateBaseSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    sign: z.ZodOptional<z.ZodString>;
    frequency: z.ZodOptional<z.ZodNumber>;
    codeExpire: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const smsProviderSchema: z.ZodObject<{
    vendor: z.ZodEnum<{
        aliyun: "aliyun";
        volcengine: "volcengine";
        http: "http";
        zxjcsms: "zxjcsms";
        tencent: "tencent";
    }>;
    accessKey: z.ZodString;
    accessSecret: z.ZodString;
    endpoint: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodString>;
    appKey: z.ZodOptional<z.ZodString>;
    appCode: z.ZodOptional<z.ZodString>;
    templates: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodAny>>>;
}, z.core.$strip>;
export declare const smsConfigSchema: z.ZodObject<{
    default: z.ZodString;
    providers: z.ZodArray<z.ZodObject<{
        vendor: z.ZodEnum<{
            aliyun: "aliyun";
            volcengine: "volcengine";
            http: "http";
            zxjcsms: "zxjcsms";
            tencent: "tencent";
        }>;
        accessKey: z.ZodString;
        accessSecret: z.ZodString;
        endpoint: z.ZodOptional<z.ZodString>;
        region: z.ZodOptional<z.ZodString>;
        appKey: z.ZodOptional<z.ZodString>;
        appCode: z.ZodOptional<z.ZodString>;
        templates: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodAny>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const storageCredentialsSchema: z.ZodObject<{
    accessKey: z.ZodString;
    secretKey: z.ZodString;
}, z.core.$strip>;
export declare const storageConfigSchema: z.ZodObject<{
    gcs: z.ZodOptional<z.ZodObject<{
        accessKey: z.ZodString;
        secretKey: z.ZodString;
    }, z.core.$strip>>;
    us3: z.ZodOptional<z.ZodObject<{
        accessKey: z.ZodString;
        secretKey: z.ZodString;
    }, z.core.$strip>>;
    qiniu: z.ZodOptional<z.ZodObject<{
        accessKey: z.ZodString;
        secretKey: z.ZodString;
    }, z.core.$strip>>;
    oss: z.ZodOptional<z.ZodObject<{
        accessKey: z.ZodString;
        secretKey: z.ZodString;
    }, z.core.$strip>>;
    tos: z.ZodOptional<z.ZodObject<{
        accessKey: z.ZodString;
        secretKey: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const openspeechAliyunProviderSchema: z.ZodObject<{
    tokenEndpoint: z.ZodOptional<z.ZodString>;
    endpoint: z.ZodString;
    accessKeyId: z.ZodOptional<z.ZodString>;
    accessKeySecret: z.ZodOptional<z.ZodString>;
    accessKey: z.ZodOptional<z.ZodString>;
    secretKey: z.ZodOptional<z.ZodString>;
    nslAppId: z.ZodOptional<z.ZodString>;
    nslAppKey: z.ZodOptional<z.ZodString>;
    apiVersion: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const openspeechVolcengineProviderSchema: z.ZodObject<{
    appId: z.ZodString;
    appAccessToken: z.ZodString;
    uid: z.ZodString;
    appAccessSecret: z.ZodOptional<z.ZodString>;
    accessKey: z.ZodOptional<z.ZodString>;
    secretKey: z.ZodOptional<z.ZodString>;
    auc: z.ZodOptional<z.ZodObject<{
        endpoint: z.ZodString;
        resourceId: z.ZodString;
    }, z.core.$strip>>;
    sauc: z.ZodOptional<z.ZodObject<{
        endpoint: z.ZodString;
        resourceId: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const openspeechProviderSchema: z.ZodObject<{
    tokenEndpoint: z.ZodOptional<z.ZodString>;
    endpoint: z.ZodOptional<z.ZodString>;
    accessKeyId: z.ZodOptional<z.ZodString>;
    accessKeySecret: z.ZodOptional<z.ZodString>;
    accessKey: z.ZodOptional<z.ZodString>;
    secretKey: z.ZodOptional<z.ZodString>;
    nslAppId: z.ZodOptional<z.ZodString>;
    nslAppKey: z.ZodOptional<z.ZodString>;
    apiVersion: z.ZodOptional<z.ZodString>;
    appId: z.ZodOptional<z.ZodString>;
    appAccessToken: z.ZodOptional<z.ZodString>;
    appAccessSecret: z.ZodOptional<z.ZodString>;
    resourceId: z.ZodOptional<z.ZodString>;
    uid: z.ZodOptional<z.ZodString>;
    streamingEndpoint: z.ZodOptional<z.ZodString>;
    auc: z.ZodOptional<z.ZodObject<{
        endpoint: z.ZodString;
        resourceId: z.ZodString;
    }, z.core.$strip>>;
    sauc: z.ZodOptional<z.ZodObject<{
        endpoint: z.ZodString;
        resourceId: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const openspeechConfigSchema: z.ZodObject<{
    'oss-ram': z.ZodOptional<z.ZodObject<{
        tokenEndpoint: z.ZodOptional<z.ZodString>;
        endpoint: z.ZodString;
        accessKeyId: z.ZodOptional<z.ZodString>;
        accessKeySecret: z.ZodOptional<z.ZodString>;
        accessKey: z.ZodOptional<z.ZodString>;
        secretKey: z.ZodOptional<z.ZodString>;
        nslAppId: z.ZodOptional<z.ZodString>;
        nslAppKey: z.ZodOptional<z.ZodString>;
        apiVersion: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    oss: z.ZodOptional<z.ZodObject<{
        tokenEndpoint: z.ZodOptional<z.ZodString>;
        endpoint: z.ZodString;
        accessKeyId: z.ZodOptional<z.ZodString>;
        accessKeySecret: z.ZodOptional<z.ZodString>;
        accessKey: z.ZodOptional<z.ZodString>;
        secretKey: z.ZodOptional<z.ZodString>;
        nslAppId: z.ZodOptional<z.ZodString>;
        nslAppKey: z.ZodOptional<z.ZodString>;
        apiVersion: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    tos: z.ZodOptional<z.ZodObject<{
        appId: z.ZodString;
        appAccessToken: z.ZodString;
        uid: z.ZodString;
        appAccessSecret: z.ZodOptional<z.ZodString>;
        accessKey: z.ZodOptional<z.ZodString>;
        secretKey: z.ZodOptional<z.ZodString>;
        auc: z.ZodOptional<z.ZodObject<{
            endpoint: z.ZodString;
            resourceId: z.ZodString;
        }, z.core.$strip>>;
        sauc: z.ZodOptional<z.ZodObject<{
            endpoint: z.ZodString;
            resourceId: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ttsProviderSchema: z.ZodObject<{
    endpoint: z.ZodString;
    apiKey: z.ZodOptional<z.ZodString>;
    resourceId: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodString>;
    accessKey: z.ZodOptional<z.ZodString>;
    secretKey: z.ZodOptional<z.ZodString>;
    bucket: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ttsConfigSchema: z.ZodObject<{
    volcengine: z.ZodOptional<z.ZodObject<{
        endpoint: z.ZodString;
        apiKey: z.ZodOptional<z.ZodString>;
        resourceId: z.ZodOptional<z.ZodString>;
        region: z.ZodOptional<z.ZodString>;
        accessKey: z.ZodOptional<z.ZodString>;
        secretKey: z.ZodOptional<z.ZodString>;
        bucket: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    aliyun: z.ZodOptional<z.ZodObject<{
        endpoint: z.ZodString;
        apiKey: z.ZodOptional<z.ZodString>;
        resourceId: z.ZodOptional<z.ZodString>;
        region: z.ZodOptional<z.ZodString>;
        accessKey: z.ZodOptional<z.ZodString>;
        secretKey: z.ZodOptional<z.ZodString>;
        bucket: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const riskProviderSchema: z.ZodObject<{
    accessKey: z.ZodString;
    secretKey: z.ZodString;
    imageBaseUrl: z.ZodOptional<z.ZodString>;
    baseUrl: z.ZodString;
    appId: z.ZodOptional<z.ZodNumber>;
    region: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const riskConfigSchema: z.ZodObject<{
    volcengine: z.ZodOptional<z.ZodObject<{
        accessKey: z.ZodString;
        secretKey: z.ZodString;
        imageBaseUrl: z.ZodOptional<z.ZodString>;
        baseUrl: z.ZodString;
        appId: z.ZodOptional<z.ZodNumber>;
        region: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    aliyun: z.ZodOptional<z.ZodObject<{
        accessKey: z.ZodString;
        secretKey: z.ZodString;
        imageBaseUrl: z.ZodOptional<z.ZodString>;
        baseUrl: z.ZodString;
        appId: z.ZodOptional<z.ZodNumber>;
        region: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const imageProviderSchema: z.ZodObject<{
    accessKey: z.ZodString;
    secretKey: z.ZodString;
    imageBaseUrl: z.ZodOptional<z.ZodString>;
    baseUrl: z.ZodString;
    region: z.ZodOptional<z.ZodString>;
    serviceId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const imageConfigSchema: z.ZodObject<{
    volcengine: z.ZodOptional<z.ZodObject<{
        accessKey: z.ZodString;
        secretKey: z.ZodString;
        imageBaseUrl: z.ZodOptional<z.ZodString>;
        baseUrl: z.ZodString;
        region: z.ZodOptional<z.ZodString>;
        serviceId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    aliyun: z.ZodOptional<z.ZodObject<{
        accessKey: z.ZodString;
        secretKey: z.ZodString;
        imageBaseUrl: z.ZodOptional<z.ZodString>;
        baseUrl: z.ZodString;
        region: z.ZodOptional<z.ZodString>;
        serviceId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const openaiSchema: z.ZodObject<{
    apiKey: z.ZodString;
    baseUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const exchangerateSchema: z.ZodObject<{
    apiKey: z.ZodString;
    baseUrl: z.ZodString;
}, z.core.$strip>;
export declare const keysConfigSchema: z.ZodObject<{
    sendcloud: z.ZodOptional<z.ZodObject<{
        vendor: z.ZodString;
        apiUser: z.ZodString;
        apiKey: z.ZodString;
        domain: z.ZodString;
        name: z.ZodString;
        templates: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            subject: z.ZodString;
            from: z.ZodString;
            templateInvokeName: z.ZodString;
            frequency: z.ZodOptional<z.ZodNumber>;
            codeExpire: z.ZodOptional<z.ZodNumber>;
            sub: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    sms: z.ZodOptional<z.ZodObject<{
        default: z.ZodString;
        providers: z.ZodArray<z.ZodObject<{
            vendor: z.ZodEnum<{
                aliyun: "aliyun";
                volcengine: "volcengine";
                http: "http";
                zxjcsms: "zxjcsms";
                tencent: "tencent";
            }>;
            accessKey: z.ZodString;
            accessSecret: z.ZodString;
            endpoint: z.ZodOptional<z.ZodString>;
            region: z.ZodOptional<z.ZodString>;
            appKey: z.ZodOptional<z.ZodString>;
            appCode: z.ZodOptional<z.ZodString>;
            templates: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodAny>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    storage: z.ZodOptional<z.ZodObject<{
        gcs: z.ZodOptional<z.ZodObject<{
            accessKey: z.ZodString;
            secretKey: z.ZodString;
        }, z.core.$strip>>;
        us3: z.ZodOptional<z.ZodObject<{
            accessKey: z.ZodString;
            secretKey: z.ZodString;
        }, z.core.$strip>>;
        qiniu: z.ZodOptional<z.ZodObject<{
            accessKey: z.ZodString;
            secretKey: z.ZodString;
        }, z.core.$strip>>;
        oss: z.ZodOptional<z.ZodObject<{
            accessKey: z.ZodString;
            secretKey: z.ZodString;
        }, z.core.$strip>>;
        tos: z.ZodOptional<z.ZodObject<{
            accessKey: z.ZodString;
            secretKey: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    openspeech: z.ZodOptional<z.ZodObject<{
        'oss-ram': z.ZodOptional<z.ZodObject<{
            tokenEndpoint: z.ZodOptional<z.ZodString>;
            endpoint: z.ZodString;
            accessKeyId: z.ZodOptional<z.ZodString>;
            accessKeySecret: z.ZodOptional<z.ZodString>;
            accessKey: z.ZodOptional<z.ZodString>;
            secretKey: z.ZodOptional<z.ZodString>;
            nslAppId: z.ZodOptional<z.ZodString>;
            nslAppKey: z.ZodOptional<z.ZodString>;
            apiVersion: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        oss: z.ZodOptional<z.ZodObject<{
            tokenEndpoint: z.ZodOptional<z.ZodString>;
            endpoint: z.ZodString;
            accessKeyId: z.ZodOptional<z.ZodString>;
            accessKeySecret: z.ZodOptional<z.ZodString>;
            accessKey: z.ZodOptional<z.ZodString>;
            secretKey: z.ZodOptional<z.ZodString>;
            nslAppId: z.ZodOptional<z.ZodString>;
            nslAppKey: z.ZodOptional<z.ZodString>;
            apiVersion: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        tos: z.ZodOptional<z.ZodObject<{
            appId: z.ZodString;
            appAccessToken: z.ZodString;
            uid: z.ZodString;
            appAccessSecret: z.ZodOptional<z.ZodString>;
            accessKey: z.ZodOptional<z.ZodString>;
            secretKey: z.ZodOptional<z.ZodString>;
            auc: z.ZodOptional<z.ZodObject<{
                endpoint: z.ZodString;
                resourceId: z.ZodString;
            }, z.core.$strip>>;
            sauc: z.ZodOptional<z.ZodObject<{
                endpoint: z.ZodString;
                resourceId: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    tts: z.ZodOptional<z.ZodObject<{
        volcengine: z.ZodOptional<z.ZodObject<{
            endpoint: z.ZodString;
            apiKey: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
            region: z.ZodOptional<z.ZodString>;
            accessKey: z.ZodOptional<z.ZodString>;
            secretKey: z.ZodOptional<z.ZodString>;
            bucket: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        aliyun: z.ZodOptional<z.ZodObject<{
            endpoint: z.ZodString;
            apiKey: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
            region: z.ZodOptional<z.ZodString>;
            accessKey: z.ZodOptional<z.ZodString>;
            secretKey: z.ZodOptional<z.ZodString>;
            bucket: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    risk: z.ZodOptional<z.ZodObject<{
        volcengine: z.ZodOptional<z.ZodObject<{
            accessKey: z.ZodString;
            secretKey: z.ZodString;
            imageBaseUrl: z.ZodOptional<z.ZodString>;
            baseUrl: z.ZodString;
            appId: z.ZodOptional<z.ZodNumber>;
            region: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        aliyun: z.ZodOptional<z.ZodObject<{
            accessKey: z.ZodString;
            secretKey: z.ZodString;
            imageBaseUrl: z.ZodOptional<z.ZodString>;
            baseUrl: z.ZodString;
            appId: z.ZodOptional<z.ZodNumber>;
            region: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    image: z.ZodOptional<z.ZodObject<{
        volcengine: z.ZodOptional<z.ZodObject<{
            accessKey: z.ZodString;
            secretKey: z.ZodString;
            imageBaseUrl: z.ZodOptional<z.ZodString>;
            baseUrl: z.ZodString;
            region: z.ZodOptional<z.ZodString>;
            serviceId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        aliyun: z.ZodOptional<z.ZodObject<{
            accessKey: z.ZodString;
            secretKey: z.ZodString;
            imageBaseUrl: z.ZodOptional<z.ZodString>;
            baseUrl: z.ZodString;
            region: z.ZodOptional<z.ZodString>;
            serviceId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    openai: z.ZodOptional<z.ZodObject<{
        apiKey: z.ZodString;
        baseUrl: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    exchangerate: z.ZodOptional<z.ZodObject<{
        apiKey: z.ZodString;
        baseUrl: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
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
export type OpenSpeechAliyunProviderConfig = z.infer<typeof openspeechAliyunProviderSchema>;
/** 火山引擎语音识别配置类型 */
export type OpenSpeechVolcengineProviderConfig = z.infer<typeof openspeechVolcengineProviderSchema>;
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
export declare function validateKeysConfig(config: unknown): KeysConfig;
/**
 * Validates keys configuration and returns detailed result
 *
 * @param config - Parsed keys configuration object
 * @returns Validation result with success status and data or errors
 */
export declare function validateKeysConfigSafe(config: unknown): KeysValidationResult;
/**
 * Checks if a specific provider is configured
 *
 * @param config - Keys configuration
 * @param provider - Provider name to check
 * @returns Boolean indicating if provider is configured
 */
export declare function isProviderConfigured(config: KeysConfig, provider: 'sendcloud' | 'sms' | 'storage' | 'openspeech' | 'tts' | 'risk' | 'image' | 'openai' | 'exchangerate'): boolean;
/**
 * Get configured SMS providers
 *
 * @param config - Keys configuration
 * @returns Array of configured SMS vendor names
 */
export declare function getConfiguredSmsProviders(config: KeysConfig): string[];
/**
 * Get configured storage providers
 *
 * @param config - Keys configuration
 * @returns Array of configured storage provider names
 */
export declare function getConfiguredStorageProviders(config: KeysConfig): string[];
