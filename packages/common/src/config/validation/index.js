"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.riskConfigSchema = exports.riskProviderSchema = exports.ttsConfigSchema = exports.ttsProviderSchema = exports.openspeechConfigSchema = exports.openspeechVolcengineProviderSchema = exports.openspeechAliyunProviderSchema = exports.openspeechProviderSchema = exports.storageConfigSchema = exports.storageCredentialsSchema = exports.smsConfigSchema = exports.smsProviderSchema = exports.smsTemplateBaseSchema = exports.sendcloudSchema = exports.emailTemplateSchema = exports.keysConfigSchema = exports.validateYamlConfigSafe = exports.validateYamlConfig = exports.transactionConfigSchema = exports.transactionRetryConfigSchema = exports.dbMetricsConfigSchema = exports.slowQueryThresholdsSchema = exports.rateLimitConfigSchema = exports.rateLimitDimensionsSchema = exports.rateLimitRedisConfigSchema = exports.rateLimitWhitelistSchema = exports.rateLimitDimensionConfigSchema = exports.rateLimitDimensionSchema = exports.featureFlagsConfigSchema = exports.unleashConfigSchema = exports.featureFlagRedisConfigSchema = exports.featureFlagProviderSchema = exports.bucketConfigSchema = exports.rolePermissionSchema = exports.pathConfigSchema = exports.redisCacheKeySchema = exports.cdnConfigSchema = exports.cdnZoneSchema = exports.cryptoConfigSchema = exports.jwtConfigSchema = exports.videoQualitySchema = exports.ipInfoConfigSchema = exports.zoneSchema = exports.appConfigSchema = exports.microServiceSchema = exports.yamlConfigSchema = exports.getEnvVar = exports.validateEnvSafe = exports.validateEnv = exports.envSchema = void 0;
exports.getConfiguredStorageProviders = exports.getConfiguredSmsProviders = exports.isProviderConfigured = exports.validateKeysConfigSafe = exports.validateKeysConfig = exports.openaiSchema = exports.imageConfigSchema = exports.imageProviderSchema = void 0;
// ============================================================================
// Environment Validation
// ============================================================================
var env_validation_1 = require("./env.validation");
Object.defineProperty(exports, "envSchema", { enumerable: true, get: function () { return env_validation_1.envSchema; } });
Object.defineProperty(exports, "validateEnv", { enumerable: true, get: function () { return env_validation_1.validateEnv; } });
Object.defineProperty(exports, "validateEnvSafe", { enumerable: true, get: function () { return env_validation_1.validateEnvSafe; } });
Object.defineProperty(exports, "getEnvVar", { enumerable: true, get: function () { return env_validation_1.getEnvVar; } });
// ============================================================================
// YAML Configuration Validation
// ============================================================================
var yaml_validation_1 = require("./yaml.validation");
// Schemas
Object.defineProperty(exports, "yamlConfigSchema", { enumerable: true, get: function () { return yaml_validation_1.yamlConfigSchema; } });
Object.defineProperty(exports, "microServiceSchema", { enumerable: true, get: function () { return yaml_validation_1.microServiceSchema; } });
Object.defineProperty(exports, "appConfigSchema", { enumerable: true, get: function () { return yaml_validation_1.appConfigSchema; } });
Object.defineProperty(exports, "zoneSchema", { enumerable: true, get: function () { return yaml_validation_1.zoneSchema; } });
Object.defineProperty(exports, "ipInfoConfigSchema", { enumerable: true, get: function () { return yaml_validation_1.ipInfoConfigSchema; } });
Object.defineProperty(exports, "videoQualitySchema", { enumerable: true, get: function () { return yaml_validation_1.videoQualitySchema; } });
Object.defineProperty(exports, "jwtConfigSchema", { enumerable: true, get: function () { return yaml_validation_1.jwtConfigSchema; } });
Object.defineProperty(exports, "cryptoConfigSchema", { enumerable: true, get: function () { return yaml_validation_1.cryptoConfigSchema; } });
Object.defineProperty(exports, "cdnZoneSchema", { enumerable: true, get: function () { return yaml_validation_1.cdnZoneSchema; } });
Object.defineProperty(exports, "cdnConfigSchema", { enumerable: true, get: function () { return yaml_validation_1.cdnConfigSchema; } });
Object.defineProperty(exports, "redisCacheKeySchema", { enumerable: true, get: function () { return yaml_validation_1.redisCacheKeySchema; } });
Object.defineProperty(exports, "pathConfigSchema", { enumerable: true, get: function () { return yaml_validation_1.pathConfigSchema; } });
Object.defineProperty(exports, "rolePermissionSchema", { enumerable: true, get: function () { return yaml_validation_1.rolePermissionSchema; } });
Object.defineProperty(exports, "bucketConfigSchema", { enumerable: true, get: function () { return yaml_validation_1.bucketConfigSchema; } });
// Feature Flag Schemas
Object.defineProperty(exports, "featureFlagProviderSchema", { enumerable: true, get: function () { return yaml_validation_1.featureFlagProviderSchema; } });
Object.defineProperty(exports, "featureFlagRedisConfigSchema", { enumerable: true, get: function () { return yaml_validation_1.featureFlagRedisConfigSchema; } });
Object.defineProperty(exports, "unleashConfigSchema", { enumerable: true, get: function () { return yaml_validation_1.unleashConfigSchema; } });
Object.defineProperty(exports, "featureFlagsConfigSchema", { enumerable: true, get: function () { return yaml_validation_1.featureFlagsConfigSchema; } });
// Rate Limit Schemas
Object.defineProperty(exports, "rateLimitDimensionSchema", { enumerable: true, get: function () { return yaml_validation_1.rateLimitDimensionSchema; } });
Object.defineProperty(exports, "rateLimitDimensionConfigSchema", { enumerable: true, get: function () { return yaml_validation_1.rateLimitDimensionConfigSchema; } });
Object.defineProperty(exports, "rateLimitWhitelistSchema", { enumerable: true, get: function () { return yaml_validation_1.rateLimitWhitelistSchema; } });
Object.defineProperty(exports, "rateLimitRedisConfigSchema", { enumerable: true, get: function () { return yaml_validation_1.rateLimitRedisConfigSchema; } });
Object.defineProperty(exports, "rateLimitDimensionsSchema", { enumerable: true, get: function () { return yaml_validation_1.rateLimitDimensionsSchema; } });
Object.defineProperty(exports, "rateLimitConfigSchema", { enumerable: true, get: function () { return yaml_validation_1.rateLimitConfigSchema; } });
// Database Metrics Schemas
Object.defineProperty(exports, "slowQueryThresholdsSchema", { enumerable: true, get: function () { return yaml_validation_1.slowQueryThresholdsSchema; } });
Object.defineProperty(exports, "dbMetricsConfigSchema", { enumerable: true, get: function () { return yaml_validation_1.dbMetricsConfigSchema; } });
// Transaction Schemas
Object.defineProperty(exports, "transactionRetryConfigSchema", { enumerable: true, get: function () { return yaml_validation_1.transactionRetryConfigSchema; } });
Object.defineProperty(exports, "transactionConfigSchema", { enumerable: true, get: function () { return yaml_validation_1.transactionConfigSchema; } });
// Functions
Object.defineProperty(exports, "validateYamlConfig", { enumerable: true, get: function () { return yaml_validation_1.validateYamlConfig; } });
Object.defineProperty(exports, "validateYamlConfigSafe", { enumerable: true, get: function () { return yaml_validation_1.validateYamlConfigSafe; } });
// ============================================================================
// Keys Configuration Validation
// ============================================================================
var keys_validation_1 = require("./keys.validation");
// Schemas
Object.defineProperty(exports, "keysConfigSchema", { enumerable: true, get: function () { return keys_validation_1.keysConfigSchema; } });
Object.defineProperty(exports, "emailTemplateSchema", { enumerable: true, get: function () { return keys_validation_1.emailTemplateSchema; } });
Object.defineProperty(exports, "sendcloudSchema", { enumerable: true, get: function () { return keys_validation_1.sendcloudSchema; } });
Object.defineProperty(exports, "smsTemplateBaseSchema", { enumerable: true, get: function () { return keys_validation_1.smsTemplateBaseSchema; } });
Object.defineProperty(exports, "smsProviderSchema", { enumerable: true, get: function () { return keys_validation_1.smsProviderSchema; } });
Object.defineProperty(exports, "smsConfigSchema", { enumerable: true, get: function () { return keys_validation_1.smsConfigSchema; } });
Object.defineProperty(exports, "storageCredentialsSchema", { enumerable: true, get: function () { return keys_validation_1.storageCredentialsSchema; } });
Object.defineProperty(exports, "storageConfigSchema", { enumerable: true, get: function () { return keys_validation_1.storageConfigSchema; } });
Object.defineProperty(exports, "openspeechProviderSchema", { enumerable: true, get: function () { return keys_validation_1.openspeechProviderSchema; } });
Object.defineProperty(exports, "openspeechAliyunProviderSchema", { enumerable: true, get: function () { return keys_validation_1.openspeechAliyunProviderSchema; } });
Object.defineProperty(exports, "openspeechVolcengineProviderSchema", { enumerable: true, get: function () { return keys_validation_1.openspeechVolcengineProviderSchema; } });
Object.defineProperty(exports, "openspeechConfigSchema", { enumerable: true, get: function () { return keys_validation_1.openspeechConfigSchema; } });
Object.defineProperty(exports, "ttsProviderSchema", { enumerable: true, get: function () { return keys_validation_1.ttsProviderSchema; } });
Object.defineProperty(exports, "ttsConfigSchema", { enumerable: true, get: function () { return keys_validation_1.ttsConfigSchema; } });
Object.defineProperty(exports, "riskProviderSchema", { enumerable: true, get: function () { return keys_validation_1.riskProviderSchema; } });
Object.defineProperty(exports, "riskConfigSchema", { enumerable: true, get: function () { return keys_validation_1.riskConfigSchema; } });
Object.defineProperty(exports, "imageProviderSchema", { enumerable: true, get: function () { return keys_validation_1.imageProviderSchema; } });
Object.defineProperty(exports, "imageConfigSchema", { enumerable: true, get: function () { return keys_validation_1.imageConfigSchema; } });
Object.defineProperty(exports, "openaiSchema", { enumerable: true, get: function () { return keys_validation_1.openaiSchema; } });
// Functions
Object.defineProperty(exports, "validateKeysConfig", { enumerable: true, get: function () { return keys_validation_1.validateKeysConfig; } });
Object.defineProperty(exports, "validateKeysConfigSafe", { enumerable: true, get: function () { return keys_validation_1.validateKeysConfigSafe; } });
Object.defineProperty(exports, "isProviderConfigured", { enumerable: true, get: function () { return keys_validation_1.isProviderConfigured; } });
Object.defineProperty(exports, "getConfiguredSmsProviders", { enumerable: true, get: function () { return keys_validation_1.getConfiguredSmsProviders; } });
Object.defineProperty(exports, "getConfiguredStorageProviders", { enumerable: true, get: function () { return keys_validation_1.getConfiguredStorageProviders; } });
//# sourceMappingURL=index.js.map