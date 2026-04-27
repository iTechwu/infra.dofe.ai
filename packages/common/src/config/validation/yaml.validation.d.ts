/**
 * YAML Configuration Validation Schema
 *
 * Validates the YAML configuration file (config.local.yaml) using Zod.
 * Ensures all required application settings are correctly configured.
 */
import { z } from 'zod';
/**
 * Microservice configuration schema
 */
export declare const microServiceSchema: z.ZodObject<{
    name: z.ZodString;
    ChineseName: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
    port: z.ZodNumber;
    logger: z.ZodDefault<z.ZodBoolean>;
    transport: z.ZodDefault<z.ZodEnum<{
        TCP: "TCP";
        UDP: "UDP";
        HTTP: "HTTP";
    }>>;
    host: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * Zone configuration schema
 */
export declare const zoneSchema: z.ZodObject<{
    zone: z.ZodString;
    locale: z.ZodEnum<{
        "zh-CN": "zh-CN";
        en: "en";
    }>;
    defaultPrivateBucket: z.ZodString;
    defaultPublicBucket: z.ZodString;
    transcodeBucket: z.ZodString;
}, z.core.$strip>;
/**
 * App configuration schema
 */
export declare const appConfigSchema: z.ZodObject<{
    name: z.ZodString;
    ChineseName: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
    port: z.ZodNumber;
    logger: z.ZodDefault<z.ZodBoolean>;
    transport: z.ZodDefault<z.ZodEnum<{
        TCP: "TCP";
        UDP: "UDP";
        HTTP: "HTTP";
    }>>;
    host: z.ZodOptional<z.ZodString>;
    domain: z.ZodString;
    MaxPageSize: z.ZodDefault<z.ZodNumber>;
    defaultPageSize: z.ZodDefault<z.ZodNumber>;
    defaultMiniPageSize: z.ZodDefault<z.ZodNumber>;
    defaultVendor: z.ZodDefault<z.ZodEnum<{
        tos: "tos";
        oss: "oss";
        us3: "us3";
        qiniu: "qiniu";
        gcs: "gcs";
        s3: "s3";
    }>>;
    defaultBucketPublic: z.ZodDefault<z.ZodBoolean>;
    nestLogOutput: z.ZodDefault<z.ZodEnum<{
        console: "console";
        file: "file";
        both: "both";
    }>>;
    admin: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        ChineseName: z.ZodOptional<z.ZodString>;
        version: z.ZodOptional<z.ZodString>;
        port: z.ZodNumber;
        logger: z.ZodDefault<z.ZodBoolean>;
        transport: z.ZodDefault<z.ZodEnum<{
            TCP: "TCP";
            UDP: "UDP";
            HTTP: "HTTP";
        }>>;
        host: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    zones: z.ZodArray<z.ZodObject<{
        zone: z.ZodString;
        locale: z.ZodEnum<{
            "zh-CN": "zh-CN";
            en: "en";
        }>;
        defaultPrivateBucket: z.ZodString;
        defaultPublicBucket: z.ZodString;
        transcodeBucket: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * IP info configuration schema
 */
export declare const ipInfoConfigSchema: z.ZodObject<{
    url: z.ZodString;
    token: z.ZodString;
}, z.core.$strip>;
/**
 * Video quality enum values
 */
export declare const videoQualitySchema: z.ZodEnum<{
    VIDEO_360P: "VIDEO_360P";
    VIDEO_720P: "VIDEO_720P";
    VIDEO_1080P: "VIDEO_1080P";
    VIDEO_4K: "VIDEO_4K";
    VIDEO_ORIGIN: "VIDEO_ORIGIN";
}>;
/**
 * JWT configuration schema
 */
export declare const jwtConfigSchema: z.ZodObject<{
    secret: z.ZodString;
    expireIn: z.ZodNumber;
}, z.core.$strip>;
/**
 * Crypto configuration schema
 */
export declare const cryptoConfigSchema: z.ZodObject<{
    key: z.ZodString;
    iv: z.ZodString;
}, z.core.$strip>;
/**
 * CDN zone configuration schema
 */
export declare const cdnZoneSchema: z.ZodObject<{
    url: z.ZodString;
    downloaderUrl: z.ZodString;
    vodUrl: z.ZodString;
    thumbTemplate: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * CDN configuration schema
 */
export declare const cdnConfigSchema: z.ZodObject<{
    cn: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        downloaderUrl: z.ZodString;
        vodUrl: z.ZodString;
        thumbTemplate: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    us: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        downloaderUrl: z.ZodString;
        vodUrl: z.ZodString;
        thumbTemplate: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    ap: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        downloaderUrl: z.ZodString;
        vodUrl: z.ZodString;
        thumbTemplate: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Redis cache key configuration schema
 */
export declare const redisCacheKeySchema: z.ZodObject<{
    name: z.ZodString;
    key: z.ZodString;
    expireIn: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/**
 * Path configuration schema
 */
export declare const pathConfigSchema: z.ZodObject<{
    post: z.ZodOptional<z.ZodArray<z.ZodString>>;
    get: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
/**
 * Permission configuration schema
 */
export declare const rolePermissionSchema: z.ZodObject<{
    role: z.ZodString;
    permission: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
/**
 * Bucket configuration schema
 */
export declare const bucketConfigSchema: z.ZodObject<{
    bucket: z.ZodString;
    region: z.ZodString;
    zone: z.ZodString;
    endpoint: z.ZodString;
    internalEndpoint: z.ZodString;
    domain: z.ZodString;
    vendor: z.ZodEnum<{
        tos: "tos";
        oss: "oss";
        us3: "us3";
        qiniu: "qiniu";
        gcs: "gcs";
        s3: "s3";
    }>;
    webhook: z.ZodOptional<z.ZodString>;
    locale: z.ZodOptional<z.ZodString>;
    isPublic: z.ZodDefault<z.ZodBoolean>;
    isDefault: z.ZodDefault<z.ZodBoolean>;
    tosEndpoint: z.ZodOptional<z.ZodString>;
    tosInternalEndpoint: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * Feature flag provider type
 */
export declare const featureFlagProviderSchema: z.ZodEnum<{
    memory: "memory";
    redis: "redis";
    unleash: "unleash";
}>;
/**
 * Redis feature flag configuration schema
 */
export declare const featureFlagRedisConfigSchema: z.ZodObject<{
    keyPrefix: z.ZodDefault<z.ZodString>;
    defaultTTL: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
/**
 * Unleash configuration schema
 */
export declare const unleashConfigSchema: z.ZodObject<{
    url: z.ZodString;
    appName: z.ZodString;
    instanceId: z.ZodOptional<z.ZodString>;
    environment: z.ZodOptional<z.ZodString>;
    refreshInterval: z.ZodDefault<z.ZodNumber>;
    metricsInterval: z.ZodDefault<z.ZodNumber>;
    customHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
/**
 * Feature flags configuration schema
 */
export declare const featureFlagsConfigSchema: z.ZodObject<{
    provider: z.ZodDefault<z.ZodEnum<{
        memory: "memory";
        redis: "redis";
        unleash: "unleash";
    }>>;
    redis: z.ZodOptional<z.ZodObject<{
        keyPrefix: z.ZodDefault<z.ZodString>;
        defaultTTL: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    unleash: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        appName: z.ZodString;
        instanceId: z.ZodOptional<z.ZodString>;
        environment: z.ZodOptional<z.ZodString>;
        refreshInterval: z.ZodDefault<z.ZodNumber>;
        metricsInterval: z.ZodDefault<z.ZodNumber>;
        customHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>>;
    defaultFlags: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodBoolean>>;
}, z.core.$strip>;
/**
 * Slow query thresholds configuration schema
 * 慢查询阈值配置
 */
export declare const slowQueryThresholdsSchema: z.ZodObject<{
    info: z.ZodDefault<z.ZodNumber>;
    warn: z.ZodDefault<z.ZodNumber>;
    error: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
/**
 * Database metrics configuration schema
 * 数据库监控配置
 */
export declare const dbMetricsConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    slowQueryThresholds: z.ZodDefault<z.ZodObject<{
        info: z.ZodDefault<z.ZodNumber>;
        warn: z.ZodDefault<z.ZodNumber>;
        error: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    logQueryParams: z.ZodDefault<z.ZodBoolean>;
    logQueryResult: z.ZodDefault<z.ZodBoolean>;
    maxParamLogLength: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
/**
 * Transaction retry configuration schema
 * 事务重试配置
 */
export declare const transactionRetryConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    maxRetries: z.ZodDefault<z.ZodNumber>;
    baseDelay: z.ZodDefault<z.ZodNumber>;
    backoffMultiplier: z.ZodDefault<z.ZodNumber>;
    maxDelay: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
/**
 * Transaction configuration schema
 * 事务配置
 */
export declare const transactionConfigSchema: z.ZodObject<{
    retry: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        maxRetries: z.ZodDefault<z.ZodNumber>;
        baseDelay: z.ZodDefault<z.ZodNumber>;
        backoffMultiplier: z.ZodDefault<z.ZodNumber>;
        maxDelay: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    defaultMaxWait: z.ZodDefault<z.ZodNumber>;
    defaultTimeout: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
/**
 * Rate limit dimension type
 */
export declare const rateLimitDimensionSchema: z.ZodEnum<{
    ip: "ip";
    userId: "userId";
    tenantId: "tenantId";
    apiKey: "apiKey";
    composite: "composite";
}>;
/**
 * Rate limit dimension config schema (limit + window)
 */
export declare const rateLimitDimensionConfigSchema: z.ZodObject<{
    limit: z.ZodNumber;
    window: z.ZodNumber;
}, z.core.$strip>;
/**
 * Rate limit whitelist configuration schema
 */
export declare const rateLimitWhitelistSchema: z.ZodObject<{
    ips: z.ZodDefault<z.ZodArray<z.ZodString>>;
    userIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    apiKeys: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
/**
 * Rate limit Redis configuration schema
 */
export declare const rateLimitRedisConfigSchema: z.ZodObject<{
    keyPrefix: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
/**
 * Rate limit dimensions configuration schema
 */
export declare const rateLimitDimensionsSchema: z.ZodObject<{
    ip: z.ZodDefault<z.ZodObject<{
        limit: z.ZodNumber;
        window: z.ZodNumber;
    }, z.core.$strip>>;
    userId: z.ZodDefault<z.ZodObject<{
        limit: z.ZodNumber;
        window: z.ZodNumber;
    }, z.core.$strip>>;
    tenantId: z.ZodDefault<z.ZodObject<{
        limit: z.ZodNumber;
        window: z.ZodNumber;
    }, z.core.$strip>>;
    apiKey: z.ZodDefault<z.ZodObject<{
        limit: z.ZodNumber;
        window: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Rate limit configuration schema
 */
export declare const rateLimitConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    featureFlag: z.ZodOptional<z.ZodString>;
    default: z.ZodDefault<z.ZodObject<{
        limit: z.ZodNumber;
        window: z.ZodNumber;
    }, z.core.$strip>>;
    dimensions: z.ZodOptional<z.ZodObject<{
        ip: z.ZodDefault<z.ZodObject<{
            limit: z.ZodNumber;
            window: z.ZodNumber;
        }, z.core.$strip>>;
        userId: z.ZodDefault<z.ZodObject<{
            limit: z.ZodNumber;
            window: z.ZodNumber;
        }, z.core.$strip>>;
        tenantId: z.ZodDefault<z.ZodObject<{
            limit: z.ZodNumber;
            window: z.ZodNumber;
        }, z.core.$strip>>;
        apiKey: z.ZodDefault<z.ZodObject<{
            limit: z.ZodNumber;
            window: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    redis: z.ZodOptional<z.ZodObject<{
        keyPrefix: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
    whitelist: z.ZodOptional<z.ZodObject<{
        ips: z.ZodDefault<z.ZodArray<z.ZodString>>;
        userIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        apiKeys: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Full YAML configuration schema
 */
export declare const yamlConfigSchema: z.ZodObject<{
    app: z.ZodObject<{
        name: z.ZodString;
        ChineseName: z.ZodOptional<z.ZodString>;
        version: z.ZodOptional<z.ZodString>;
        port: z.ZodNumber;
        logger: z.ZodDefault<z.ZodBoolean>;
        transport: z.ZodDefault<z.ZodEnum<{
            TCP: "TCP";
            UDP: "UDP";
            HTTP: "HTTP";
        }>>;
        host: z.ZodOptional<z.ZodString>;
        domain: z.ZodString;
        MaxPageSize: z.ZodDefault<z.ZodNumber>;
        defaultPageSize: z.ZodDefault<z.ZodNumber>;
        defaultMiniPageSize: z.ZodDefault<z.ZodNumber>;
        defaultVendor: z.ZodDefault<z.ZodEnum<{
            tos: "tos";
            oss: "oss";
            us3: "us3";
            qiniu: "qiniu";
            gcs: "gcs";
            s3: "s3";
        }>>;
        defaultBucketPublic: z.ZodDefault<z.ZodBoolean>;
        nestLogOutput: z.ZodDefault<z.ZodEnum<{
            console: "console";
            file: "file";
            both: "both";
        }>>;
        admin: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            ChineseName: z.ZodOptional<z.ZodString>;
            version: z.ZodOptional<z.ZodString>;
            port: z.ZodNumber;
            logger: z.ZodDefault<z.ZodBoolean>;
            transport: z.ZodDefault<z.ZodEnum<{
                TCP: "TCP";
                UDP: "UDP";
                HTTP: "HTTP";
            }>>;
            host: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        zones: z.ZodArray<z.ZodObject<{
            zone: z.ZodString;
            locale: z.ZodEnum<{
                "zh-CN": "zh-CN";
                en: "en";
            }>;
            defaultPrivateBucket: z.ZodString;
            defaultPublicBucket: z.ZodString;
            transcodeBucket: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    ipinfo: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        token: z.ZodString;
    }, z.core.$strip>>;
    outOfAnonymityPath: z.ZodOptional<z.ZodObject<{
        post: z.ZodOptional<z.ZodArray<z.ZodString>>;
        get: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    outOfUserPath: z.ZodOptional<z.ZodObject<{
        post: z.ZodOptional<z.ZodArray<z.ZodString>>;
        get: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    jwt: z.ZodObject<{
        secret: z.ZodString;
        expireIn: z.ZodNumber;
    }, z.core.$strip>;
    crypto: z.ZodObject<{
        key: z.ZodString;
        iv: z.ZodString;
    }, z.core.$strip>;
    cdn: z.ZodOptional<z.ZodObject<{
        cn: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            downloaderUrl: z.ZodString;
            vodUrl: z.ZodString;
            thumbTemplate: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        us: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            downloaderUrl: z.ZodString;
            vodUrl: z.ZodString;
            thumbTemplate: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        ap: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            downloaderUrl: z.ZodString;
            vodUrl: z.ZodString;
            thumbTemplate: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    redis: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        key: z.ZodString;
        expireIn: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    buckets: z.ZodOptional<z.ZodArray<z.ZodObject<{
        bucket: z.ZodString;
        region: z.ZodString;
        zone: z.ZodString;
        endpoint: z.ZodString;
        internalEndpoint: z.ZodString;
        domain: z.ZodString;
        vendor: z.ZodEnum<{
            tos: "tos";
            oss: "oss";
            us3: "us3";
            qiniu: "qiniu";
            gcs: "gcs";
            s3: "s3";
        }>;
        webhook: z.ZodOptional<z.ZodString>;
        locale: z.ZodOptional<z.ZodString>;
        isPublic: z.ZodDefault<z.ZodBoolean>;
        isDefault: z.ZodDefault<z.ZodBoolean>;
        tosEndpoint: z.ZodOptional<z.ZodString>;
        tosInternalEndpoint: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    featureFlags: z.ZodOptional<z.ZodObject<{
        provider: z.ZodDefault<z.ZodEnum<{
            memory: "memory";
            redis: "redis";
            unleash: "unleash";
        }>>;
        redis: z.ZodOptional<z.ZodObject<{
            keyPrefix: z.ZodDefault<z.ZodString>;
            defaultTTL: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        unleash: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            appName: z.ZodString;
            instanceId: z.ZodOptional<z.ZodString>;
            environment: z.ZodOptional<z.ZodString>;
            refreshInterval: z.ZodDefault<z.ZodNumber>;
            metricsInterval: z.ZodDefault<z.ZodNumber>;
            customHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, z.core.$strip>>;
        defaultFlags: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodBoolean>>;
    }, z.core.$strip>>;
    rateLimit: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        featureFlag: z.ZodOptional<z.ZodString>;
        default: z.ZodDefault<z.ZodObject<{
            limit: z.ZodNumber;
            window: z.ZodNumber;
        }, z.core.$strip>>;
        dimensions: z.ZodOptional<z.ZodObject<{
            ip: z.ZodDefault<z.ZodObject<{
                limit: z.ZodNumber;
                window: z.ZodNumber;
            }, z.core.$strip>>;
            userId: z.ZodDefault<z.ZodObject<{
                limit: z.ZodNumber;
                window: z.ZodNumber;
            }, z.core.$strip>>;
            tenantId: z.ZodDefault<z.ZodObject<{
                limit: z.ZodNumber;
                window: z.ZodNumber;
            }, z.core.$strip>>;
            apiKey: z.ZodDefault<z.ZodObject<{
                limit: z.ZodNumber;
                window: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        redis: z.ZodOptional<z.ZodObject<{
            keyPrefix: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>;
        whitelist: z.ZodOptional<z.ZodObject<{
            ips: z.ZodDefault<z.ZodArray<z.ZodString>>;
            userIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
            apiKeys: z.ZodDefault<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    dbMetrics: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        slowQueryThresholds: z.ZodDefault<z.ZodObject<{
            info: z.ZodDefault<z.ZodNumber>;
            warn: z.ZodDefault<z.ZodNumber>;
            error: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        logQueryParams: z.ZodDefault<z.ZodBoolean>;
        logQueryResult: z.ZodDefault<z.ZodBoolean>;
        maxParamLogLength: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    transaction: z.ZodOptional<z.ZodObject<{
        retry: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            maxRetries: z.ZodDefault<z.ZodNumber>;
            baseDelay: z.ZodDefault<z.ZodNumber>;
            backoffMultiplier: z.ZodDefault<z.ZodNumber>;
            maxDelay: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
        defaultMaxWait: z.ZodDefault<z.ZodNumber>;
        defaultTimeout: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/** 完整 YAML 配置类型 */
export type YamlConfig = z.infer<typeof yamlConfigSchema>;
/** 微服务配置类型 */
export type MicroServiceConfig = z.infer<typeof microServiceSchema>;
/** 应用配置类型 (扩展自 MicroServiceConfig) */
export type AppConfig = z.infer<typeof appConfigSchema>;
/** 区域配置类型 */
export type ZoneConfig = z.infer<typeof zoneSchema>;
/** IP 信息配置类型 */
export type IpInfoConfig = z.infer<typeof ipInfoConfigSchema>;
/** JWT 配置类型 */
export type JwtConfig = z.infer<typeof jwtConfigSchema>;
/** 加密配置类型 */
export type CryptoConfig = z.infer<typeof cryptoConfigSchema>;
/** CDN 区域配置类型 */
export type CdnZoneConfig = z.infer<typeof cdnZoneSchema>;
/** CDN 配置类型 */
export type CdnConfig = z.infer<typeof cdnConfigSchema>;
/** Redis 缓存键配置类型 */
export type RedisCacheKeyConfig = z.infer<typeof redisCacheKeySchema>;
/** 路径配置类型 */
export type PathConfig = z.infer<typeof pathConfigSchema>;
/** 角色权限配置类型 */
export type RolePermissionConfig = z.infer<typeof rolePermissionSchema>;
/** 存储桶配置类型 */
export type BucketConfig = z.infer<typeof bucketConfigSchema>;
/** 视频质量枚举类型 */
export type VideoQuality = z.infer<typeof videoQualitySchema>;
/** 功能开关 Provider 类型 */
export type FeatureFlagProvider = z.infer<typeof featureFlagProviderSchema>;
/** 功能开关 Redis 配置类型 */
export type FeatureFlagRedisConfig = z.infer<typeof featureFlagRedisConfigSchema>;
/** Unleash 配置类型 */
export type UnleashConfig = z.infer<typeof unleashConfigSchema>;
/** 功能开关配置类型 */
export type FeatureFlagsConfig = z.infer<typeof featureFlagsConfigSchema>;
/** 限流维度类型 */
export type RateLimitDimension = z.infer<typeof rateLimitDimensionSchema>;
/** 限流维度配置类型 */
export type RateLimitDimensionConfig = z.infer<typeof rateLimitDimensionConfigSchema>;
/** 限流白名单配置类型 */
export type RateLimitWhitelistConfig = z.infer<typeof rateLimitWhitelistSchema>;
/** 限流 Redis 配置类型 */
export type RateLimitRedisConfig = z.infer<typeof rateLimitRedisConfigSchema>;
/** 限流维度集合配置类型 */
export type RateLimitDimensionsConfig = z.infer<typeof rateLimitDimensionsSchema>;
/** 限流配置类型 */
export type RateLimitConfig = z.infer<typeof rateLimitConfigSchema>;
/** 慢查询阈值配置类型 */
export type SlowQueryThresholdsConfig = z.infer<typeof slowQueryThresholdsSchema>;
/** 数据库监控配置类型 */
export type DbMetricsConfig = z.infer<typeof dbMetricsConfigSchema>;
/** 事务重试配置类型 */
export type TransactionRetryConfig = z.infer<typeof transactionRetryConfigSchema>;
/** 事务配置类型 */
export type TransactionConfig = z.infer<typeof transactionConfigSchema>;
/**
 * Validation result type
 */
export interface YamlValidationResult {
    success: boolean;
    data?: YamlConfig;
    errors?: z.ZodError;
}
/**
 * Validates YAML configuration against the schema
 *
 * @param config - Parsed YAML configuration object
 * @returns Validated configuration
 * @throws Error if validation fails
 */
export declare function validateYamlConfig(config: unknown): YamlConfig;
/**
 * Validates YAML configuration and returns detailed result
 *
 * @param config - Parsed YAML configuration object
 * @returns Validation result with success status and data or errors
 */
export declare function validateYamlConfigSafe(config: unknown): YamlValidationResult;
