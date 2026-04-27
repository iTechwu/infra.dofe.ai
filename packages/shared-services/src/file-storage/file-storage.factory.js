"use strict";
/**
 * @fileoverview 文件存储客户端工厂
 *
 * 本文件实现了文件存储客户端的工厂模式，负责：
 * - 根据存储供应商类型创建对应的客户端实例
 * - 管理客户端实例的生命周期（单例模式）
 * - 提供统一的客户端获取接口
 *
 * @module file-storage/factory
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileStorageClientFactory = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const file_storage_1 = require("../../../clients/src/internal/file-storage");
const redis_1 = require("../../../redis/src");
const configuration_1 = require("../../../common/src/config/configuration");
const errors_1 = require("@repo/contracts/errors");
const api_exception_1 = require("../../../common/src/filter/exception/api.exception");
const types_1 = require("./types");
const enviroment_util_1 = __importDefault(require("../../../utils/dist/enviroment.util"));
/**
 * 存储供应商到客户端类的映射
 *
 * @description 目前支持的存储供应商客户端实现。
 * `tencent` 和 `ksyun` 在枚举中定义但尚未实现客户端。
 */
const VENDOR_CLIENT_MAP = {
    s3: file_storage_1.FileS3Client,
    oss: file_storage_1.FileS3Client,
    tos: file_storage_1.FileTosClient,
    us3: file_storage_1.FileUs3Client,
    gcs: file_storage_1.FileGcsClient,
    qiniu: file_storage_1.FileQiniuClient,
    // tencent: 尚未实现
    // ksyun: 尚未实现
};
/**
 * 文件存储客户端工厂
 *
 * @description 使用工厂模式管理不同存储供应商的客户端实例。
 *
 * 主要职责：
 * - 根据 vendor 和 bucket 创建对应的客户端实例
 * - 使用单例模式缓存客户端实例，避免重复创建
 * - 统一管理存储配置和凭证
 *
 * 支持的存储供应商：
 * - 's3': AWS S3 兼容存储
 * - 'oss': 阿里云 OSS
 * - 'tos': 火山引擎 TOS
 * - 'us3': UCloud US3
 * - 'gcs': Google Cloud Storage
 * - 'qiniu': 七牛云存储
 *
 * @class FileStorageClientFactory
 *
 * @example
 * ```typescript
 * @Injectable()
 * class MyService {
 *   constructor(private readonly factory: FileStorageClientFactory) {}
 *
 *   async uploadFile(vendor: FileBucketVendor, bucket: string, file: Buffer) {
 *     const client = this.factory.getClient(vendor, bucket);
 *     await client.fileUploader(file, { key: 'path/to/file', bucket });
 *   }
 * }
 * ```
 */
let FileStorageClientFactory = class FileStorageClientFactory {
    configService;
    redis;
    httpService;
    logger;
    /**
     * 客户端实例缓存
     * @private
     */
    clients = new Map();
    /**
     * 存储桶配置列表
     * @private
     */
    bucketConfigs;
    /**
     * 存储凭证配置
     * @private
     */
    storageCredentials;
    /**
     * 应用配置
     * @private
     */
    appConfig;
    /**
     * 默认存储供应商
     * @private
     */
    defaultVendor;
    /**
     * 构造函数
     *
     * @param {ConfigService} configService - NestJS 配置服务
     * @param {RedisService} redis - Redis 服务
     * @param {HttpService} httpService - HTTP 服务
     * @param {Logger} logger - Winston 日志记录器
     */
    constructor(configService, redis, httpService, logger) {
        this.configService = configService;
        this.redis = redis;
        this.httpService = httpService;
        this.logger = logger;
        // 加载配置
        this.bucketConfigs =
            configService.getOrThrow('buckets');
        this.appConfig = configService.getOrThrow('app');
        this.defaultVendor = this.appConfig.defaultVendor;
        this.storageCredentials =
            (0, configuration_1.getKeysConfig)()?.storage || {};
        // 预初始化所有配置的客户端
        this.initializeClients();
    }
    /**
     * 预初始化所有配置的存储客户端
     *
     * @private
     */
    initializeClients() {
        for (const config of this.bucketConfigs) {
            const vendor = config.vendor ?? this.defaultVendor;
            try {
                this.createClient(vendor, config);
            }
            catch (error) {
                this.logger.error('Failed to initialize storage client', {
                    vendor,
                    bucket: config.bucket,
                    error: error.message,
                });
            }
        }
        if (enviroment_util_1.default.isProduction()) {
            this.logger.info('FileStorageClientFactory module initialized', {
                clientCount: this.clients.size,
                vendors: [...new Set(this.bucketConfigs.map((c) => c.vendor))],
            });
        }
    }
    /**
     * 创建存储客户端实例
     *
     * @private
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {DoFeUploader.Config} config - 存储桶配置
     * @returns {FileStorageInterface} 客户端实例
     * @throws {Error} 不支持的供应商类型时抛出异常
     */
    createClient(vendor, config) {
        const ClientClass = VENDOR_CLIENT_MAP[vendor];
        if (!ClientClass) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.FileServiceUnsupportedVendor);
        }
        const storageConfig = this.storageCredentials[vendor];
        const client = new ClientClass(config, storageConfig, this.appConfig, this.redis, this.httpService, this.logger);
        // 缓存客户端
        const key = (0, types_1.buildStorageClientKey)(vendor, config.bucket);
        this.clients.set(key, client);
        return client;
    }
    /**
     * 获取存储客户端
     *
     * @description 根据供应商和存储桶获取对应的客户端实例。
     * 如果客户端不存在，将返回 undefined。
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @returns {FileStorageInterface | undefined} 客户端实例或 undefined
     *
     * @example
     * ```typescript
     * const client = factory.getClient('oss', 'my-bucket');
     * if (client) {
     *   await client.uploadFile('/path/to/file', 'key', 'my-bucket');
     * }
     * ```
     */
    getClient(vendor, bucket) {
        const key = (0, types_1.buildStorageClientKey)(vendor, bucket);
        return this.clients.get(key);
    }
    /**
     * 获取存储客户端（必须存在）
     *
     * @description 获取客户端实例，如果不存在则抛出异常。
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @returns {FileStorageInterface} 客户端实例
     * @throws {Error} 客户端不存在时抛出异常
     *
     * @example
     * ```typescript
     * const client = factory.getClientOrThrow('oss', 'my-bucket');
     * await client.uploadFile('/path/to/file', 'key', 'my-bucket');
     * ```
     */
    getClientOrThrow(vendor, bucket) {
        const client = this.getClient(vendor, bucket);
        if (!client) {
            throw new Error(`File storage client not found for vendor: ${vendor}, bucket: ${bucket}`);
        }
        return client;
    }
    /**
     * 检查客户端是否存在
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @returns {boolean} 是否存在
     */
    hasClient(vendor, bucket) {
        const key = (0, types_1.buildStorageClientKey)(vendor, bucket);
        return this.clients.has(key);
    }
    /**
     * 获取存储桶配置
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @returns {DoFeUploader.Config | undefined} 存储桶配置
     */
    getBucketConfig(vendor, bucket) {
        return this.bucketConfigs.find((config) => config.bucket === bucket &&
            (config.vendor ?? this.defaultVendor) === vendor);
    }
    /**
     * 获取所有存储桶配置
     *
     * @returns {DoFeUploader.Config[]} 存储桶配置列表
     */
    getAllBucketConfigs() {
        return [...this.bucketConfigs];
    }
    /**
     * 获取默认存储供应商
     *
     * @returns {FileBucketVendor} 默认供应商
     */
    getDefaultVendor() {
        return this.defaultVendor;
    }
    /**
     * 获取应用配置
     *
     * @returns {AppConfig} 应用配置
     */
    getAppConfig() {
        return this.appConfig;
    }
    /**
     * 获取所有已初始化的客户端键
     *
     * @returns {StorageClientKey[]} 客户端键列表
     */
    getClientKeys() {
        return [...this.clients.keys()];
    }
};
exports.FileStorageClientFactory = FileStorageClientFactory;
exports.FileStorageClientFactory = FileStorageClientFactory = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        redis_1.RedisService,
        axios_1.HttpService,
        winston_1.Logger])
], FileStorageClientFactory);
//# sourceMappingURL=file-storage.factory.js.map