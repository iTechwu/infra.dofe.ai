/**
 * Configuration DTOs and Types
 *
 * 设计原则: 一次配置，多次使用
 * - 配置相关类型从 Zod validation schema 推断 (单一真相来源)
 * - 非配置相关的 DTO 类型在此定义
 * - 保持向后兼容的类型别名
 */
import type { SystemTaskQueue, FileEnvType, FileBucketVendor } from '@prisma/client';
import { ExtendedPaginatedResponse, PaginatedResponse } from "@repo/contracts";
export type { YamlConfig, MicroServiceConfig, AppConfig, ZoneConfig, IpInfoConfig, JwtConfig, CryptoConfig, CdnZoneConfig, CdnConfig, RedisCacheKeyConfig, PathConfig, RolePermissionConfig, BucketConfig, VideoQuality, SlowQueryThresholdsConfig, DbMetricsConfig, TransactionRetryConfig, TransactionConfig, } from '../validation';
export type { KeysConfig, EmailTemplateConfig, SendCloudConfig, SmsTemplateBaseConfig, SmsProviderConfig, SmsConfig, StorageCredentialsConfig, StorageConfig, OpenSpeechConfig, TtsProviderConfig, TtsConfig, RiskProviderConfig, RiskConfig, ImageProviderConfig, ImageConfig, } from '../validation';
export type { EnvConfig } from '../validation';
import type { YamlConfig as YamlConfigType, MicroServiceConfig as MicroServiceConfigType, AppConfig as AppConfigType, ZoneConfig as ZoneConfigType, IpInfoConfig as IpInfoConfigType, JwtConfig as JwtConfigType, CryptoConfig as CryptoConfigType, RedisCacheKeyConfig as RedisCacheKeyConfigType, PathConfig as PathConfigType, KeysConfig as KeysConfigType, StorageCredentialsConfig as StorageCredentialsConfigType, OpenSpeechConfig as OpenSpeechConfigType, TtsConfig as TtsConfigType, RiskConfig as RiskConfigType, ImageConfig as ImageConfigType } from '../validation';
export declare namespace DoFeApp {
    /**
     * 分页响应数据类型（zod-first）
     *
     * 继承自 @repo/contracts 的 ExtendedPaginatedResponse
     * 支持以下字段：
     * - list: T[] - 数据列表
     * - total: number - 总数
     * - page?: number - 当前页码
     * - limit?: number - 每页数量
     * - totalSize?: number - 总大小（字节）
     *
     * @template T - 列表项类型
     * @example
     * ```typescript
     * async getUsers(): Promise<DoFeApp.PageResponseData<User>> {
     *   return { list: users, total: 100, page: 1, limit: 20 };
     * }
     * ```
     */
    type PageResponseData<T> = ExtendedPaginatedResponse<T>;
    /**
     * 基础分页响应类型（仅包含 list, total, page, limit）
     * 用于简单的分页场景
     *
     * @template T - 列表项类型
     */
    type SimplePaginatedResponse<T> = PaginatedResponse<T>;
    class Task {
        task: Partial<SystemTaskQueue> | {
            id: string;
            ready: boolean;
            state: string;
            progress?: number;
            processing?: boolean;
            current_step?: string;
            estimated_remaining_time?: string;
            processing_timestamp?: string;
            date?: string;
            result?: any;
            error?: string;
        };
    }
    /** @deprecated 使用 CryptoConfig from '../validation' */
    type Crypto = CryptoConfigType;
    /** @deprecated 使用 JwtConfig from '../validation' */
    type JwtConfig = JwtConfigType;
    /** @deprecated 使用 RedisCacheKeyConfig from '../validation' */
    type RedisConfig = RedisCacheKeyConfigType;
    /** 完整 YAML 配置类型 - 从 Zod schema 推断 */
    type Config = YamlConfigType;
    /** @deprecated 使用 MicroServiceConfig from '../validation' */
    type MicroService = MicroServiceConfigType;
    /** @deprecated 使用 AppConfig from '../validation' */
    type LocalConfig = AppConfigType;
    /** @deprecated 使用 StorageCredentialsConfig from '../validation' */
    type StorageSecret = StorageCredentialsConfigType;
    /** @deprecated 使用 PathConfig from '../validation' */
    type OutOfUserPath = PathConfigType;
    /** @deprecated 使用 ZoneConfig from '../validation' */
    type Zone = ZoneConfigType;
    /** @deprecated 使用 OpenSpeechConfig from '../validation' */
    type OpenSpeechConfig = OpenSpeechConfigType;
    /** @deprecated 使用 TtsConfig from '../validation' */
    type TtsConfig = TtsConfigType;
    /** @deprecated 使用 RiskConfig from '../validation' */
    type RiskConfig = RiskConfigType;
    /** @deprecated 使用 ImageConfig from '../validation' */
    type ImageConfig = ImageConfigType;
    /** 完整 Keys 配置类型 - 从 Zod schema 推断 */
    type Keys = KeysConfigType;
    /** @deprecated 使用 IpInfoConfig from '../validation' */
    type IpInfoConfig = IpInfoConfigType;
    interface FileBase {
        bucket: string;
        key: string;
        ext?: string;
        env?: FileEnvType;
        vendor?: FileBucketVendor;
    }
    interface HeaderData {
        platform: string;
        os: string;
        deviceid: string;
        mptrail?: string;
    }
    interface IPInfo {
        ip: string;
        country: string;
        region?: string;
        city?: string;
        loc?: string;
        org?: string;
        postal?: string;
        timezone?: string;
    }
    interface CountryReation {
        us: string[];
        eu: string[];
        ap: string[];
        cn: string[];
    }
}
export declare enum Locale {
    English = "en",
    ChineseSimplified = "zh-CN"
}
export type LocaleString = Locale.English | Locale.ChineseSimplified;
export declare enum VideoResolutionDto {
    HD = "1080p",
    SD = "720p",
    SSD = "360p",
    UHD = "4k"
}
