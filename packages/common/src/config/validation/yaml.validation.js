"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.yamlConfigSchema = exports.rateLimitConfigSchema = exports.rateLimitDimensionsSchema = exports.rateLimitRedisConfigSchema = exports.rateLimitWhitelistSchema = exports.rateLimitDimensionConfigSchema = exports.rateLimitDimensionSchema = exports.transactionConfigSchema = exports.transactionRetryConfigSchema = exports.dbMetricsConfigSchema = exports.slowQueryThresholdsSchema = exports.featureFlagsConfigSchema = exports.unleashConfigSchema = exports.featureFlagRedisConfigSchema = exports.featureFlagProviderSchema = exports.bucketConfigSchema = exports.rolePermissionSchema = exports.pathConfigSchema = exports.redisCacheKeySchema = exports.cdnConfigSchema = exports.cdnZoneSchema = exports.cryptoConfigSchema = exports.jwtConfigSchema = exports.videoQualitySchema = exports.ipInfoConfigSchema = exports.appConfigSchema = exports.zoneSchema = exports.microServiceSchema = void 0;
exports.validateYamlConfig = validateYamlConfig;
exports.validateYamlConfigSafe = validateYamlConfigSafe;
/**
 * YAML Configuration Validation Schema
 *
 * Validates the YAML configuration file (config.local.yaml) using Zod.
 * Ensures all required application settings are correctly configured.
 */
const zod_1 = require("zod");
const enviroment_util_1 = __importDefault(require("@/utils/enviroment.util"));
// ============================================================================
// Exported Schemas (用于类型推断和外部使用)
// ============================================================================
/**
 * Microservice configuration schema
 */
exports.microServiceSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    ChineseName: zod_1.z.string().optional(),
    version: zod_1.z.string().optional(),
    port: zod_1.z.number().int().positive().max(65535),
    logger: zod_1.z.boolean().default(true),
    transport: zod_1.z.enum(['TCP', 'UDP', 'HTTP']).default('TCP'),
    host: zod_1.z.string().optional(),
});
/**
 * Zone configuration schema
 */
exports.zoneSchema = zod_1.z.object({
    zone: zod_1.z.string().min(1),
    locale: zod_1.z.enum(['zh-CN', 'en']),
    defaultPrivateBucket: zod_1.z.string().min(1),
    defaultPublicBucket: zod_1.z.string().min(1),
    transcodeBucket: zod_1.z.string().min(1),
});
/**
 * App configuration schema
 */
exports.appConfigSchema = exports.microServiceSchema.extend({
    domain: zod_1.z.string().min(1),
    MaxPageSize: zod_1.z.number().int().positive().default(500),
    defaultPageSize: zod_1.z.number().int().positive().default(100),
    defaultMiniPageSize: zod_1.z.number().int().positive().default(30),
    defaultVendor: zod_1.z
        .enum(['tos', 'oss', 'us3', 'qiniu', 'gcs', 's3'])
        .default('tos'),
    defaultBucketPublic: zod_1.z.boolean().default(false),
    // 日志输出配置 (从 .env 迁移)
    nestLogOutput: zod_1.z.enum(['console', 'file', 'both']).default('file'),
    admin: exports.microServiceSchema.optional(),
    zones: zod_1.z.array(exports.zoneSchema).min(1),
});
/**
 * IP info configuration schema
 */
exports.ipInfoConfigSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    token: zod_1.z.string().min(1),
});
/**
 * Video quality enum values
 */
exports.videoQualitySchema = zod_1.z.enum([
    'VIDEO_360P',
    'VIDEO_720P',
    'VIDEO_1080P',
    'VIDEO_4K',
    'VIDEO_ORIGIN',
]);
/**
 * JWT configuration schema
 */
exports.jwtConfigSchema = zod_1.z.object({
    secret: zod_1.z.string().min(8, 'JWT secret must be at least 8 characters'),
    expireIn: zod_1.z.number().int().positive(),
});
/**
 * Crypto configuration schema
 */
exports.cryptoConfigSchema = zod_1.z.object({
    key: zod_1.z.string().min(1),
    iv: zod_1.z.string().min(1),
});
/**
 * CDN zone configuration schema
 */
exports.cdnZoneSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    downloaderUrl: zod_1.z.string().url(),
    vodUrl: zod_1.z.string().url(),
    thumbTemplate: zod_1.z.string().optional(),
});
/**
 * CDN configuration schema
 */
exports.cdnConfigSchema = zod_1.z.object({
    cn: exports.cdnZoneSchema.optional(),
    us: exports.cdnZoneSchema.optional(),
    ap: exports.cdnZoneSchema.optional(),
});
/**
 * Redis cache key configuration schema
 */
exports.redisCacheKeySchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    key: zod_1.z.string().min(1),
    expireIn: zod_1.z.number().int().optional(),
});
/**
 * Path configuration schema
 */
exports.pathConfigSchema = zod_1.z.object({
    post: zod_1.z.array(zod_1.z.string()).optional(),
    get: zod_1.z.array(zod_1.z.string()).optional(),
});
/**
 * Permission configuration schema
 */
exports.rolePermissionSchema = zod_1.z.object({
    role: zod_1.z.string().min(1),
    permission: zod_1.z.array(zod_1.z.string()),
});
/**
 * Bucket configuration schema
 */
exports.bucketConfigSchema = zod_1.z.object({
    bucket: zod_1.z.string().min(1),
    region: zod_1.z.string().min(1),
    zone: zod_1.z.string().min(1),
    endpoint: zod_1.z.string().url(),
    internalEndpoint: zod_1.z.string(),
    domain: zod_1.z.string().url(),
    vendor: zod_1.z.enum(['tos', 'oss', 'us3', 'qiniu', 'gcs', 's3']),
    webhook: zod_1.z.string().optional(),
    locale: zod_1.z.string().optional(),
    isPublic: zod_1.z.boolean().default(false),
    isDefault: zod_1.z.boolean().default(false),
    tosEndpoint: zod_1.z.string().optional(),
    tosInternalEndpoint: zod_1.z.string().optional(),
});
/**
 * Feature flag provider type
 */
exports.featureFlagProviderSchema = zod_1.z.enum(['memory', 'redis', 'unleash']);
/**
 * Redis feature flag configuration schema
 */
exports.featureFlagRedisConfigSchema = zod_1.z.object({
    /** Redis key prefix (default: 'dofe:feature:') */
    keyPrefix: zod_1.z.string().default('dofe:feature:'),
    /** Default TTL in seconds, 0 = never expire (default: 0) */
    defaultTTL: zod_1.z.number().int().min(0).default(0),
});
/**
 * Unleash configuration schema
 */
exports.unleashConfigSchema = zod_1.z.object({
    /** Unleash server URL */
    url: zod_1.z.string().url(),
    /** Application name registered in Unleash */
    appName: zod_1.z.string().min(1),
    /** Unique instance identifier */
    instanceId: zod_1.z.string().optional(),
    /** Environment name (dev, staging, production) */
    environment: zod_1.z.string().optional(),
    /** Refresh interval in milliseconds (default: 15000) */
    refreshInterval: zod_1.z.number().int().positive().default(15000),
    /** Metrics reporting interval in milliseconds (default: 60000) */
    metricsInterval: zod_1.z.number().int().positive().default(60000),
    /** Custom headers for authentication */
    customHeaders: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
});
/**
 * Feature flags configuration schema
 */
exports.featureFlagsConfigSchema = zod_1.z
    .object({
    /** Feature flag provider: memory (dev), redis (prod), unleash (enterprise) */
    provider: exports.featureFlagProviderSchema.default('memory'),
    /** Redis configuration (used when provider is 'redis') */
    redis: exports.featureFlagRedisConfigSchema.optional(),
    /** Unleash configuration (required if provider is 'unleash') */
    unleash: exports.unleashConfigSchema.optional(),
    /** Default feature flags (key-value pairs) */
    defaultFlags: zod_1.z.record(zod_1.z.string(), zod_1.z.boolean()).optional(),
})
    .refine((data) => {
    // If provider is 'unleash', unleash config must be provided
    if (data.provider === 'unleash' && !data.unleash) {
        return false;
    }
    return true;
}, {
    message: "Unleash configuration is required when provider is 'unleash'",
    path: ['unleash'],
});
// ============================================================================
// Rate Limit Configuration Schemas
// ============================================================================
// ============================================================================
// Database Metrics Configuration Schemas
// ============================================================================
/**
 * Slow query thresholds configuration schema
 * 慢查询阈值配置
 */
exports.slowQueryThresholdsSchema = zod_1.z.object({
    /** INFO level threshold in ms (default: 100) */
    info: zod_1.z.number().int().positive().default(100),
    /** WARN level threshold in ms (default: 500) */
    warn: zod_1.z.number().int().positive().default(500),
    /** ERROR level threshold in ms (default: 1000) */
    error: zod_1.z.number().int().positive().default(1000),
});
/**
 * Database metrics configuration schema
 * 数据库监控配置
 */
exports.dbMetricsConfigSchema = zod_1.z.object({
    /** Enable/disable database metrics (default: true) */
    enabled: zod_1.z.boolean().default(true),
    /** Slow query thresholds by log level */
    slowQueryThresholds: exports.slowQueryThresholdsSchema.default({
        info: 100,
        warn: 500,
        error: 1000,
    }),
    /** Log query parameters (default: true) */
    logQueryParams: zod_1.z.boolean().default(true),
    /** Log query results (default: false, for security) */
    logQueryResult: zod_1.z.boolean().default(false),
    /** Maximum length for logged parameters (default: 1000) */
    maxParamLogLength: zod_1.z.number().int().positive().default(1000),
});
// ============================================================================
// Transaction Configuration Schemas
// ============================================================================
/**
 * Transaction retry configuration schema
 * 事务重试配置
 */
exports.transactionRetryConfigSchema = zod_1.z.object({
    /** Enable retry mechanism (default: true) */
    enabled: zod_1.z.boolean().default(true),
    /** Maximum retry attempts (default: 3) */
    maxRetries: zod_1.z.number().int().positive().default(3),
    /** Base delay between retries in ms (default: 100) */
    baseDelay: zod_1.z.number().int().positive().default(100),
    /** Exponential backoff multiplier (default: 2) */
    backoffMultiplier: zod_1.z.number().positive().default(2),
    /** Maximum delay between retries in ms (default: 5000) */
    maxDelay: zod_1.z.number().int().positive().default(5000),
});
/**
 * Transaction configuration schema
 * 事务配置
 */
exports.transactionConfigSchema = zod_1.z.object({
    /** Retry configuration */
    retry: exports.transactionRetryConfigSchema.default({
        enabled: true,
        maxRetries: 3,
        baseDelay: 100,
        backoffMultiplier: 2,
        maxDelay: 5000,
    }),
    /** Default max wait time for transaction lock in ms (default: 5000) */
    defaultMaxWait: zod_1.z.number().int().positive().default(5000),
    /** Default transaction timeout in ms (default: 30000) */
    defaultTimeout: zod_1.z.number().int().positive().default(30000),
});
// ============================================================================
// Rate Limit Configuration Schemas
// ============================================================================
/**
 * Rate limit dimension type
 */
exports.rateLimitDimensionSchema = zod_1.z.enum([
    'ip',
    'userId',
    'tenantId',
    'apiKey',
    'composite',
]);
/**
 * Rate limit dimension config schema (limit + window)
 */
exports.rateLimitDimensionConfigSchema = zod_1.z.object({
    /** Maximum requests allowed in the window */
    limit: zod_1.z.number().int().positive(),
    /** Time window in seconds */
    window: zod_1.z.number().int().positive(),
});
/**
 * Rate limit whitelist configuration schema
 */
exports.rateLimitWhitelistSchema = zod_1.z.object({
    /** Whitelisted IP addresses (supports CIDR notation) */
    ips: zod_1.z.array(zod_1.z.string()).default(['127.0.0.1', '::1']),
    /** Whitelisted user IDs */
    userIds: zod_1.z.array(zod_1.z.string()).default([]),
    /** Whitelisted API keys */
    apiKeys: zod_1.z.array(zod_1.z.string()).default([]),
});
/**
 * Rate limit Redis configuration schema
 */
exports.rateLimitRedisConfigSchema = zod_1.z.object({
    /** Redis key prefix (default: 'dofe:ratelimit:') */
    keyPrefix: zod_1.z.string().default('dofe:ratelimit:'),
});
/**
 * Rate limit dimensions configuration schema
 */
exports.rateLimitDimensionsSchema = zod_1.z.object({
    /** IP-based rate limiting */
    ip: exports.rateLimitDimensionConfigSchema.default({ limit: 200, window: 60 }),
    /** User-based rate limiting */
    userId: exports.rateLimitDimensionConfigSchema.default({ limit: 500, window: 60 }),
    /** Tenant-based rate limiting */
    tenantId: exports.rateLimitDimensionConfigSchema.default({
        limit: 2000,
        window: 60,
    }),
    /** API key-based rate limiting */
    apiKey: exports.rateLimitDimensionConfigSchema.default({ limit: 1000, window: 60 }),
});
/**
 * Rate limit configuration schema
 */
exports.rateLimitConfigSchema = zod_1.z.object({
    /** Enable/disable rate limiting (static, requires restart) */
    enabled: zod_1.z.boolean().default(true),
    /** Feature flag name for dynamic control (optional) */
    featureFlag: zod_1.z.string().optional(),
    /** Default rate limit configuration (fallback) */
    default: exports.rateLimitDimensionConfigSchema.default({ limit: 100, window: 60 }),
    /** Dimension-specific configurations */
    dimensions: exports.rateLimitDimensionsSchema.optional(),
    /** Redis configuration */
    redis: exports.rateLimitRedisConfigSchema.optional(),
    /** Whitelist configuration */
    whitelist: exports.rateLimitWhitelistSchema.optional(),
});
/**
 * Full YAML configuration schema
 */
exports.yamlConfigSchema = zod_1.z.object({
    app: exports.appConfigSchema,
    ipinfo: exports.ipInfoConfigSchema.optional(),
    outOfAnonymityPath: exports.pathConfigSchema.optional(),
    outOfUserPath: exports.pathConfigSchema.optional(),
    jwt: exports.jwtConfigSchema,
    crypto: exports.cryptoConfigSchema,
    cdn: exports.cdnConfigSchema.optional(),
    redis: zod_1.z.array(exports.redisCacheKeySchema).optional(),
    buckets: zod_1.z.array(exports.bucketConfigSchema).optional(),
    featureFlags: exports.featureFlagsConfigSchema.optional(),
    rateLimit: exports.rateLimitConfigSchema.optional(),
    // Database monitoring and transaction configuration
    dbMetrics: exports.dbMetricsConfigSchema.optional(),
    transaction: exports.transactionConfigSchema.optional(),
});
/**
 * Validates YAML configuration against the schema
 *
 * @param config - Parsed YAML configuration object
 * @returns Validated configuration
 * @throws Error if validation fails
 */
function validateYamlConfig(config) {
    const result = exports.yamlConfigSchema.safeParse(config);
    if (!result.success) {
        // Zod 4 uses issues instead of errors
        const issues = result.error.issues || [];
        const errorMessages = issues
            .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
            .join('\n');
        console.error('❌ YAML configuration validation failed:');
        console.error(errorMessages);
        throw new Error(`YAML configuration validation failed:\n${errorMessages}`);
    }
    if (enviroment_util_1.default.isProduction()) {
        console.log('✅ YAML configuration validated successfully');
    }
    return result.data;
}
/**
 * Validates YAML configuration and returns detailed result
 *
 * @param config - Parsed YAML configuration object
 * @returns Validation result with success status and data or errors
 */
function validateYamlConfigSafe(config) {
    const result = exports.yamlConfigSchema.safeParse(config);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
}
//# sourceMappingURL=yaml.validation.js.map