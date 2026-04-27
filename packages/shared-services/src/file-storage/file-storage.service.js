"use strict";
/**
 * @fileoverview 文件存储服务
 *
 * 本文件是文件存储服务的统一入口（Facade 模式），提供了简洁的 API 接口。
 *
 * 架构说明：
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    FileStorageService                       │
 * │                     （Facade 门面）                          │
 * │  - 提供统一的文件操作 API                                    │
 * │  - 处理业务逻辑和参数验证                                    │
 * └─────────────────────────────┬───────────────────────────────┘
 *                               │
 *          ┌───────────────────┼───────────────────┐
 *          │                   │                   │
 *          ▼                   ▼                   ▼
 * ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
 * │  BucketResolver │ │ ClientFactory   │ │ Storage Clients │
 * │  （存储桶解析）   │ │ （客户端工厂）   │ │ （具体客户端）   │
 * └─────────────────┘ └─────────────────┘ └─────────────────┘
 * ```
 *
 * @module file-storage/service
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileStorageService = void 0;
const common_1 = require("@nestjs/common");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const errors_1 = require("@repo/contracts/errors");
const api_exception_1 = require("../../../common/src/filter/exception/api.exception");
const file_storage_factory_1 = require("./file-storage.factory");
const bucket_resolver_1 = require("./bucket-resolver");
/**
 * 文件存储服务
 *
 * @description 作为文件存储的统一门面，提供以下核心功能：
 *
 * **文件操作**
 * - `uploadFile` - 上传文件
 * - `deleteFile` / `batchDeleteFiles` - 删除文件
 * - `copyFile` - 复制文件
 * - `fetchToBucket` - 从 URL 抓取文件到存储桶
 *
 * **访问控制**
 * - `uploadToken` / `uploadTokenWithCallback` - 获取上传凭证
 * - `getPresignedUrl` - 获取预签名 URL
 * - `getPrivateDownloadUrl` - 获取私有下载链接
 *
 * **分片上传**
 * - `getMultipartUploadId` - 初始化分片上传
 * - `completeMultipartUpload` - 完成分片上传
 *
 * **媒体处理**
 * - `getSnapshot` - 视频截图
 * - `getVideoInfo` / `getImageInfo` / `getAudioInfo` - 获取媒体信息
 *
 * @class FileStorageService
 *
 * @example
 * ```typescript
 * // 注入服务
 * @Injectable()
 * class VideoService {
 *   constructor(private readonly fileStorage: FileStorageService) {}
 *
 *   // 上传文件
 *   async upload(file: Buffer, key: string) {
 *     const client = await this.fileStorage.getFileClient('oss', 'my-bucket');
 *     await client.fileUploader(file, { key, bucket: 'my-bucket' });
 *   }
 *
 *   // 获取私有下载链接
 *   async getDownloadUrl(key: string) {
 *     return await this.fileStorage.getPrivateDownloadUrl(
 *       'oss', 'my-bucket', key, { expire: 3600 }
 *     );
 *   }
 * }
 * ```
 */
let FileStorageService = class FileStorageService {
    clientFactory;
    bucketResolver;
    logger;
    /**
     * 构造函数
     *
     * @param {FileStorageClientFactory} clientFactory - 客户端工厂
     * @param {BucketResolver} bucketResolver - 存储桶解析器
     * @param {Logger} logger - Winston 日志记录器
     */
    constructor(clientFactory, bucketResolver, logger) {
        this.clientFactory = clientFactory;
        this.bucketResolver = bucketResolver;
        this.logger = logger;
    }
    // =========================================================================
    // 客户端获取
    // =========================================================================
    /**
     * 获取文件存储客户端
     *
     * @description 根据供应商和存储桶获取对应的存储客户端。
     * 支持根据 IP 地址自动选择区域最优的存储桶。
     *
     * @param {FileBucketVendor} [vendor] - 存储供应商
     * @param {string} [bucket] - 存储桶名称
     * @param {string} [ip] - 客户端 IP（用于区域感知）
     * @param {boolean} [isPublic] - 是否公开存储桶
     * @param {string} [locale] - 区域设置
     * @returns {Promise<FileStorageInterface>} 存储客户端
     *
     * @example
     * ```typescript
     * // 获取指定存储桶的客户端
     * const client = await service.getFileClient('oss', 'my-bucket');
     *
     * // 根据 IP 自动选择最优存储桶
     * const client = await service.getFileClient(undefined, undefined, '8.8.8.8');
     * ```
     */
    async getFileClient(vendor, bucket, ip, isPublic, locale) {
        const resolved = await this.bucketResolver.resolve({
            vendor,
            bucket,
            ip,
            isPublic,
            locale,
        });
        const client = this.clientFactory.getClient(resolved.vendor, resolved.bucket);
        if (!client) {
            throw new Error(`File storage client not available for vendor: ${resolved.vendor}, bucket: ${resolved.bucket}`);
        }
        return client;
    }
    /**
     * @deprecated 使用 getFileClient 代替
     */
    async getFileService(vendor, bucket, ip, isPublic, locale) {
        return this.getFileClient(vendor, bucket, ip, isPublic, locale);
    }
    // =========================================================================
    // 配置获取
    // =========================================================================
    /**
     * 获取文件服务配置
     *
     * @param {FileBucketVendor} [vendor] - 存储供应商
     * @param {string} [bucket] - 存储桶名称
     * @param {string} [ip] - 客户端 IP
     * @param {boolean} [isPublic] - 是否公开
     * @param {string} [locale] - 区域设置
     * @returns {Promise<DoFeUploader.Config>} 存储桶配置
     */
    async getFileServiceConfig(vendor, bucket, ip, isPublic, locale) {
        const client = await this.getFileClient(vendor, bucket, ip, isPublic, locale);
        if (!client) {
            throw new Error(`File service not available for vendor: ${vendor}, bucket: ${bucket}`);
        }
        return client.getConfig();
    }
    /**
     * 根据存储桶获取供应商
     *
     * @param {string} bucket - 存储桶名称
     * @param {FileBucketVendor} [vendor] - 默认供应商
     * @returns {FileBucketVendor} 供应商类型
     */
    getFileVendorByBucket(bucket, vendor) {
        return (this.bucketResolver.getVendorForBucket(bucket) ??
            vendor ??
            this.clientFactory.getDefaultVendor());
    }
    // =========================================================================
    // 存储桶操作
    // =========================================================================
    /**
     * 获取存储桶字符串
     *
     * @param {string} [bucket] - 存储桶名称
     * @param {string} [ip] - 客户端 IP
     * @param {boolean} [isPublic] - 是否公开
     * @param {string} [locale] - 区域设置
     * @param {FileBucketVendor} [vendor] - 存储供应商
     * @returns {Promise<string>} 解析后的存储桶名称
     */
    async getBucketString(bucket, ip, isPublic, locale, vendor) {
        const resolved = await this.bucketResolver.resolve({
            bucket,
            ip,
            isPublic,
            locale,
            vendor,
        });
        return resolved.bucket;
    }
    /**
     * 获取默认存储桶
     *
     * @param {boolean} [isPublic] - 是否公开
     * @param {string} [ip] - 客户端 IP
     * @param {string} [locale] - 区域设置
     * @returns {Promise<string>} 默认存储桶名称
     */
    async getDefaultBucket(isPublic, ip, locale) {
        return this.bucketResolver.resolveDefaultBucket(isPublic, ip, locale);
    }
    /**
     * @deprecated 使用 getDefaultBucket 代替
     */
    async getDefauleBucket(isPublic, ip, locale) {
        return this.getDefaultBucket(isPublic, ip, locale);
    }
    /**
     * 检查存储桶是否有效
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @returns {boolean} 是否有效
     */
    checkBucketValidate(vendor, bucket) {
        return this.bucketResolver.validateBucket(vendor, bucket);
    }
    /**
     * 格式化新的文件键
     *
     * @param {string} root - 根路径
     * @param {string} ext - 文件扩展名
     * @param {string} [bucket] - 存储桶名称
     * @param {string} [ip] - 客户端 IP
     * @param {boolean} [isPublic] - 是否公开
     * @param {string} [locale] - 区域设置
     * @returns {Promise<string>} 生成的文件键
     */
    async formatNewKeyString(root, ext, bucket, ip, isPublic, locale) {
        const finalBucket = await this.getBucketString(bucket, ip, isPublic, locale);
        return this.bucketResolver.generateFileKey(root, ext, finalBucket);
    }
    // =========================================================================
    // 文件操作
    // =========================================================================
    /**
     * 复制文件
     *
     * @param {DoFeApp.FileBase} source - 源文件信息
     * @param {DoFeApp.FileBase} destination - 目标文件信息
     * @returns {Promise<void>}
     */
    async copyFile(source, destination) {
        this.logger.info('Copying file', { source, destination });
        const srcClient = await this.getFileClient(source.vendor, source.bucket);
        const destClient = await this.getFileClient(destination.vendor, destination.bucket);
        try {
            const buffer = await srcClient.fileDownloader(source);
            await destClient.fileUploader(buffer, destination);
            this.logger.info('File copied successfully', {
                source,
                destination,
            });
        }
        catch (error) {
            this.logger.error('copyFile error', {
                source,
                destination,
                error: error.message,
            });
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.InternalServerError, {
                message: 'copyFileToBucketError',
            });
        }
    }
    /**
     * 上传文件
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} key - 文件键
     * @param {string} filePath - 本地文件路径
     * @returns {Promise<void>}
     */
    async uploadFile(vendor, bucket, key, filePath) {
        const client = await this.getFileClient(vendor, bucket);
        return client.uploadFile(filePath, key, bucket);
    }
    /**
     * 上传 Base64 数据
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} key - 文件键
     * @param {string} base64Data - Base64 编码的数据
     * @returns {Promise<void>}
     */
    async fileDataUploader(vendor, bucket, key, base64Data) {
        const client = await this.getFileClient(vendor, bucket);
        return client.fileDataUploader(base64Data, key, bucket);
    }
    /**
     * 上传 Buffer 数据
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} key - 文件键
     * @param {Buffer} buffer - 文件数据
     * @returns {Promise<void>}
     */
    async streamDownloader(vendor, bucket, key, buffer) {
        const client = await this.getFileClient(vendor, bucket);
        return client.fileUploader(buffer, { key, bucket });
    }
    /**
     * 删除文件
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} fileKey - 文件键
     * @returns {Promise<any>}
     */
    async deleteFile(vendor, bucket, fileKey) {
        const client = await this.getFileClient(vendor, bucket);
        return client.deleteFile(fileKey);
    }
    /**
     * 批量删除文件
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string[]} fileKeys - 文件键列表
     * @returns {Promise<any>}
     */
    async batchDeleteFiles(vendor, bucket, fileKeys) {
        const client = await this.getFileClient(vendor, bucket);
        return client.batchDeleteFiles(fileKeys, bucket);
    }
    /**
     * 获取文件信息
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} fileKey - 文件键
     * @returns {Promise<any>}
     */
    async getFileInfo(vendor, bucket, fileKey) {
        const client = await this.getFileClient(vendor, bucket);
        return client.getFileInfo(fileKey);
    }
    /**
     * 列出文件前缀
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} [prefix] - 前缀
     * @param {number} [limit] - 限制数量
     * @param {string} [delimiter] - 分隔符
     * @param {any} [options] - 附加选项
     * @returns {Promise<any>}
     */
    async listFilesPrefix(vendor, bucket, prefix, limit, delimiter, options) {
        const client = await this.getFileClient(vendor, bucket);
        return client.listFilesPrefix(prefix, limit, delimiter, bucket, options);
    }
    /**
     * 从 URL 抓取文件到存储桶
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} fileKey - 目标文件键
     * @param {string} resUrl - 源 URL
     * @param {string} [ip] - 客户端 IP
     * @returns {Promise<any>}
     */
    async fetchToBucket(vendor, bucket, fileKey, resUrl, ip) {
        const client = await this.getFileClient(vendor, bucket, ip);
        return client.fetchToBucket(resUrl, fileKey, bucket);
    }
    /**
     * 设置文件内容处置
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} key - 文件键
     * @returns {Promise<void>}
     */
    async setFileContentDisposition(vendor, bucket, key) {
        const client = await this.getFileClient(vendor, bucket);
        return client.setFileContentDisposition(key, bucket);
    }
    // =========================================================================
    // 访问控制
    // =========================================================================
    /**
     * 获取上传令牌
     *
     * @param {FileBucketVendor} [vendor] - 存储供应商
     * @param {string} [bucket] - 存储桶名称
     * @param {any} [options] - 附加选项
     * @returns {Promise<string>} 上传令牌
     */
    async uploadToken(vendor, bucket, options) {
        const client = await this.getFileClient(vendor, bucket);
        return client.uploadToken(bucket, options);
    }
    /**
     * 获取带回调的上传令牌
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} callbackAuthKey - 回调验证密钥
     * @param {any} [options] - 附加选项
     * @param {boolean} [needSplitPart] - 是否需要分片上传
     * @returns {Promise<string>} 上传令牌
     */
    async uploadTokenWithCallback(vendor, bucket, callbackAuthKey, options, needSplitPart) {
        const client = await this.getFileClient(vendor, bucket);
        return client.uploadTokenWithCallback(callbackAuthKey, bucket, options, needSplitPart);
    }
    /**
     * 获取预签名 URL
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {PresignedUrlOptions} [options] - 选项
     * @returns {Promise<string>} 预签名 URL
     */
    async getPresignedUrl(vendor, bucket, options) {
        const client = await this.getFileClient(vendor, bucket);
        return client.getPresignedUrl(bucket, options?.uploadId, options?.key, options?.partNumber);
    }
    /**
     * 获取私有下载 URL
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} fileKey - 文件键
     * @param {PrivateDownloadOptions} [options] - 选项
     * @returns {Promise<string>} 私有下载 URL
     */
    async getPrivateDownloadUrl(vendor, bucket, fileKey, options = {}) {
        const { expire = 30, internal = false } = options;
        if (!fileKey) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.S3NoSuchKey);
        }
        if (!bucket || !this.checkBucketValidate(vendor, bucket)) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.S3NoSuchBucket);
        }
        const client = await this.getFileClient(vendor, bucket);
        return client.getPrivateDownloadUrl(fileKey, expire, internal, bucket);
    }
    // =========================================================================
    // 分片上传
    // =========================================================================
    /**
     * 获取分片上传 ID
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} key - 文件键
     * @param {string} [ip] - 客户端 IP
     * @returns {Promise<string>} 上传 ID
     */
    async getMultipartUploadId(vendor, bucket, key, ip) {
        const client = await this.getFileClient(vendor, bucket, ip);
        return client.getMultipartUploadId(key, bucket);
    }
    /**
     * 完成分片上传
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} key - 文件键
     * @param {string} uploadId - 上传 ID
     * @param {MultipartPart[]} parts - 分片信息
     * @returns {Promise<void>}
     */
    async completeMultipartUpload(vendor, bucket, key, uploadId, parts) {
        if (!this.checkBucketValidate(vendor, bucket)) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.S3NoSuchBucket);
        }
        const client = await this.getFileClient(vendor, bucket);
        return client.completeMultipartUpload(uploadId, key, parts, bucket);
    }
    // =========================================================================
    // 媒体处理
    // =========================================================================
    /**
     * 获取视频截图
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} fileKey - 视频文件键
     * @param {SnapshotOptions} [options] - 截图选项
     * @returns {Promise<string>} 截图文件键
     */
    async getSnapshot(vendor, bucket, fileKey, options = {}) {
        const { time = 0, width = 0, height = 0, format = 'jpg', internal = false, } = options;
        if (!fileKey) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.S3NoSuchKey);
        }
        if (!bucket || !this.checkBucketValidate(vendor, bucket)) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.S3NoSuchBucket);
        }
        const client = await this.getFileClient(vendor, bucket);
        if (!client.getSnapshot) {
            throw new Error(`getSnapshot is not supported for vendor: ${vendor}, bucket: ${bucket}`);
        }
        return client.getSnapshot(fileKey, internal, bucket, time, width, height, format);
    }
    /**
     * 获取视频信息
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} fileKey - 视频文件键
     * @param {boolean} [internal] - 是否使用内部端点
     * @returns {Promise<any>} 视频信息
     */
    async getVideoInfo(vendor, bucket, fileKey, internal = false) {
        if (!fileKey) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.S3NoSuchKey);
        }
        if (!bucket || !this.checkBucketValidate(vendor, bucket)) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.S3NoSuchBucket);
        }
        const client = await this.getFileClient(vendor, bucket);
        if (!client.getVideoInfo) {
            throw new Error(`getVideoInfo is not supported for vendor: ${vendor}, bucket: ${bucket}`);
        }
        return client.getVideoInfo(fileKey, internal, bucket);
    }
    /**
     * 获取图片信息
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} fileKey - 图片文件键
     * @param {boolean} [internal] - 是否使用内部端点
     * @returns {Promise<any>} 图片信息
     */
    async getImageInfo(vendor, bucket, fileKey, internal = false) {
        if (!fileKey) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.S3NoSuchKey);
        }
        if (!bucket || !this.checkBucketValidate(vendor, bucket)) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.S3NoSuchBucket);
        }
        const client = await this.getFileClient(vendor, bucket);
        if (!client.getImageInfo) {
            throw new Error(`getImageInfo is not supported for vendor: ${vendor}, bucket: ${bucket}`);
        }
        return client.getImageInfo(fileKey, internal, bucket);
    }
    /**
     * 获取音频信息
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} fileKey - 音频文件键
     * @param {boolean} [internal] - 是否使用内部端点
     * @returns {Promise<any>} 音频信息
     */
    async getAudioInfo(vendor, bucket, fileKey, internal = false) {
        if (!fileKey) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.S3NoSuchKey);
        }
        if (!bucket || !this.checkBucketValidate(vendor, bucket)) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.S3NoSuchBucket);
        }
        const client = await this.getFileClient(vendor, bucket);
        if (!client.getAudioInfo) {
            throw new Error(`getAudioInfo is not supported for vendor: ${vendor}, bucket: ${bucket}`);
        }
        return client.getAudioInfo(fileKey, internal, bucket);
    }
};
exports.FileStorageService = FileStorageService;
exports.FileStorageService = FileStorageService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [file_storage_factory_1.FileStorageClientFactory,
        bucket_resolver_1.BucketResolver,
        winston_1.Logger])
], FileStorageService);
//# sourceMappingURL=file-storage.service.js.map