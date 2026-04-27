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
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Logger } from 'winston';
import { FileBucketVendor } from '@prisma/client';
import { FileStorageInterface, DoFeUploader } from "../../../clients/src/internal/file-storage";
import { RedisService } from "../../../redis/src";
import { AppConfig } from "../../../common/src/config/validation";
import { StorageClientKey } from './types';
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
export declare class FileStorageClientFactory {
    private readonly configService;
    private readonly redis;
    private readonly httpService;
    private readonly logger;
    /**
     * 客户端实例缓存
     * @private
     */
    private readonly clients;
    /**
     * 存储桶配置列表
     * @private
     */
    private readonly bucketConfigs;
    /**
     * 存储凭证配置
     * @private
     */
    private readonly storageCredentials;
    /**
     * 应用配置
     * @private
     */
    private readonly appConfig;
    /**
     * 默认存储供应商
     * @private
     */
    private readonly defaultVendor;
    /**
     * 构造函数
     *
     * @param {ConfigService} configService - NestJS 配置服务
     * @param {RedisService} redis - Redis 服务
     * @param {HttpService} httpService - HTTP 服务
     * @param {Logger} logger - Winston 日志记录器
     */
    constructor(configService: ConfigService, redis: RedisService, httpService: HttpService, logger: Logger);
    /**
     * 预初始化所有配置的存储客户端
     *
     * @private
     */
    private initializeClients;
    /**
     * 创建存储客户端实例
     *
     * @private
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {DoFeUploader.Config} config - 存储桶配置
     * @returns {FileStorageInterface} 客户端实例
     * @throws {Error} 不支持的供应商类型时抛出异常
     */
    private createClient;
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
    getClient(vendor: FileBucketVendor, bucket: string): FileStorageInterface | undefined;
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
    getClientOrThrow(vendor: FileBucketVendor, bucket: string): FileStorageInterface;
    /**
     * 检查客户端是否存在
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @returns {boolean} 是否存在
     */
    hasClient(vendor: FileBucketVendor, bucket: string): boolean;
    /**
     * 获取存储桶配置
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @returns {DoFeUploader.Config | undefined} 存储桶配置
     */
    getBucketConfig(vendor: FileBucketVendor, bucket: string): DoFeUploader.Config | undefined;
    /**
     * 获取所有存储桶配置
     *
     * @returns {DoFeUploader.Config[]} 存储桶配置列表
     */
    getAllBucketConfigs(): DoFeUploader.Config[];
    /**
     * 获取默认存储供应商
     *
     * @returns {FileBucketVendor} 默认供应商
     */
    getDefaultVendor(): FileBucketVendor;
    /**
     * 获取应用配置
     *
     * @returns {AppConfig} 应用配置
     */
    getAppConfig(): AppConfig;
    /**
     * 获取所有已初始化的客户端键
     *
     * @returns {StorageClientKey[]} 客户端键列表
     */
    getClientKeys(): StorageClientKey[];
}
