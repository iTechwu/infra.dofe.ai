/**
 * Configuration Validation Module
 *
 * Central export for all configuration validation schemas.
 * Provides Zod-based validation for:
 * - Environment variables (.env)
 * - YAML configuration (config.local.yaml)
 * - Keys configuration (keys/config.json)
 *
 * 设计原则: 一次配置，多次使用
 * - Zod schema 是类型的唯一真相来源
 * - 所有配置类型都从 Zod schema 推断
 * - 不再需要手动维护重复的 interface 定义
 */
export { envSchema, validateEnv, validateEnvSafe, getEnvVar, } from './env.validation';
export type { EnvConfig, EnvValidationResult } from './env.validation';
export { yamlConfigSchema, microServiceSchema, appConfigSchema, zoneSchema, ipInfoConfigSchema, videoQualitySchema, jwtConfigSchema, cryptoConfigSchema, cdnZoneSchema, cdnConfigSchema, redisCacheKeySchema, pathConfigSchema, rolePermissionSchema, bucketConfigSchema, featureFlagProviderSchema, featureFlagRedisConfigSchema, unleashConfigSchema, featureFlagsConfigSchema, rateLimitDimensionSchema, rateLimitDimensionConfigSchema, rateLimitWhitelistSchema, rateLimitRedisConfigSchema, rateLimitDimensionsSchema, rateLimitConfigSchema, slowQueryThresholdsSchema, dbMetricsConfigSchema, transactionRetryConfigSchema, transactionConfigSchema, validateYamlConfig, validateYamlConfigSafe, } from './yaml.validation';
export type { YamlConfig, YamlValidationResult, MicroServiceConfig, AppConfig, ZoneConfig, IpInfoConfig, JwtConfig, CryptoConfig, CdnZoneConfig, CdnConfig, RedisCacheKeyConfig, PathConfig, RolePermissionConfig, BucketConfig, VideoQuality, FeatureFlagProvider, FeatureFlagRedisConfig, UnleashConfig, FeatureFlagsConfig, RateLimitDimension, RateLimitDimensionConfig, RateLimitWhitelistConfig, RateLimitRedisConfig, RateLimitDimensionsConfig, RateLimitConfig, SlowQueryThresholdsConfig, DbMetricsConfig, TransactionRetryConfig, TransactionConfig, } from './yaml.validation';
export { keysConfigSchema, emailTemplateSchema, sendcloudSchema, smsTemplateBaseSchema, smsProviderSchema, smsConfigSchema, storageCredentialsSchema, storageConfigSchema, openspeechProviderSchema, openspeechAliyunProviderSchema, openspeechVolcengineProviderSchema, openspeechConfigSchema, ttsProviderSchema, ttsConfigSchema, riskProviderSchema, riskConfigSchema, imageProviderSchema, imageConfigSchema, openaiSchema, validateKeysConfig, validateKeysConfigSafe, isProviderConfigured, getConfiguredSmsProviders, getConfiguredStorageProviders, } from './keys.validation';
export type { KeysConfig, KeysValidationResult, EmailTemplateConfig, SendCloudConfig, SmsTemplateBaseConfig, SmsProviderConfig, SmsConfig, StorageCredentialsConfig, StorageConfig, OpenSpeechAliyunProviderConfig, OpenSpeechVolcengineProviderConfig, OpenSpeechConfig, TtsProviderConfig, TtsConfig, RiskProviderConfig, RiskConfig, ImageProviderConfig, ImageConfig, OpenAIConfig, ExchangeRateConfig, } from './keys.validation';
