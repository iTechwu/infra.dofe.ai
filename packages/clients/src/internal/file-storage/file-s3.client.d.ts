import { Logger } from 'winston';
import { DoFeUploader, GetObjectOptions } from './dto/file.dto';
import { S3Client } from '@aws-sdk/client-s3';
import { DoFeApp } from "../../../../common/src/config/dto/config.dto";
import { StorageCredentialsConfig, AppConfig } from "../../../../common/src/config/validation";
import { FileStorageInterface } from './file-storage.interface';
import { HttpService } from '@nestjs/axios';
import { RedisService } from "../../../../redis/src";
/**
 * S3 File Storage Client
 *
 * 职责：仅负责与 S3 兼容的存储 API 通信
 * - 不访问数据库
 * - 不包含业务逻辑
 */
export declare class FileS3Client implements FileStorageInterface {
    protected externalClient: S3Client;
    protected internalClient: S3Client;
    config: DoFeUploader.Config;
    storageConfig: StorageCredentialsConfig;
    appConfig: AppConfig;
    redis: RedisService;
    protected httpService: HttpService;
    protected logger: Logger;
    protected urlRedisKey: string;
    private readonly enableRetryMechanism;
    private readonly enableEnhancedLogging;
    private readonly maxRetries;
    private readonly baseRetryDelay;
    /**
     * 构造函数，用于创建AppFile类的实例
     *
     */
    constructor(config: DoFeUploader.Config, storageConfig: StorageCredentialsConfig, appConfig: AppConfig, redis: RedisService, httpService: HttpService, logger: Logger);
    /**
     * 通用重试包装器 - 支持指数退避和智能错误分类
     */
    private withRetry;
    /**
     * 增强的错误处理 - 统一错误日志格式和分类
     */
    private logOperationResult;
    setClient(): void;
    /**
     * 获取存储桶的字符串表示
     *
     * @param bucket 存储桶名称，可选参数
     * @returns 返回存储桶的字符串表示，若未提供bucket参数，则使用默认存储桶
     */
    getBucketString(bucket?: string): any;
    /**
     * 获取分片上传的ID
     *
     * @param key 文件在存储��中的键（Key）
     * @param filePath 文件的本地路径
     * @param bucket 存储桶的名称（可选），如果未指定，则使用默认的存储桶名称
     * @returns 返回一个 Promise 对象，解析后得到分片上传的ID
     */
    getMultipartUploadId(key: string, bucket?: string): Promise<string>;
    completeMultipartUpload(uploadId: string, key: string, parts: {
        ETag: string;
        PartNumber: number;
    }[], bucket?: string): Promise<void>;
    fileDownloader(source: DoFeApp.FileBase): Promise<Buffer>;
    fileUploader(buffer: Buffer, destination: DoFeApp.FileBase): Promise<void>;
    fileDataUploader(base64Data: string, key: string, bucket?: string): Promise<void>;
    /**
     * 使用S3协议上传文件
     *
     * @param filePath 文件的本地路径
     * @param key 文件在存储桶中的键（Key）
     * @param bucket 存储桶的名称（可选），如果未指定，则使用默认的存储桶名称
     * @returns 返回一个 Promise 对象，解析后得到上传结果
     */
    uploadFile(filePath: string, key: string, bucket?: string): Promise<void>;
    /**
     * 设置文件的Content-Disposition属性为attachment。
     * 这个方法首先会检查文件是否存在，然后根据提供的bucket参数获取最终的存储桶名称。
     * 然后，它构建一个参数对象，该对象指定了操作的存储桶和键名，
     * 以及要执行的操作——使用CopyObjectCommand命令替换元数据，
     * 其中包括将Content-Disposition设置为attachment，同时保持原有的ContentType不变。
     * 如果操作成功，它会记录一条成功的日志。
     * 如果操作失败，它会记录错误并跳过操作。
     *
     * @param fileKey 文件在存储桶中的键名
     * @param bucket 存储桶的名称（可选）
     * @param maxRetries 最大重试次数，默认为2次
     */
    setFileContentDisposition(fileKey: string, bucket?: string, maxRetries?: number): Promise<void>;
    /**
     * 获取内部签名URL
     *
     * @param bucket 存储桶名称
     * @param key 对象键名
     * @returns 签名URL的Promise对象
     */
    private getInternalSignedUrl;
    /**
     * 生成带签名的GET对象URL
     *
     * @param bucket 存储桶名称
     * @param key 对象键名
     * @param options GET对象选项，可选参数
     * @returns 返回带签名的GET对象URL的Promise对象
     */
    signGetUrl(bucket: string, key: string, options?: GetObjectOptions): Promise<string>;
    /**
     * 获取批量上传预签名URL
     *
     * @param bucket 存储桶名称
     * @param uploadId 分块上传ID
     * @param key 对象键
     * @param partNumber 分块号
     * @returns 返回预签名URL的Promise对象
     * @throws 当S3不存在指定键时，抛出ApiException异常
     */
    getPresignedUrl(bucket?: string, uploadId?: string, key?: string, partNumber?: number): Promise<string>;
    uploadToken(bucket?: string, options?: any): Promise<string>;
    uploadTokenWithCallback(callbackAuthKey?: string, scope?: string, options?: {
        saveKey: string;
        forceSaveKey?: boolean;
        contentType?: string;
    }, neeSpiltPart?: boolean): Promise<string>;
    /**
     * 列出所有的存储桶
     *
     * @returns 返回包含存储桶信息的Promise对象
     */
    listBuckets(): Promise<any[] | import("@aws-sdk/client-s3").ListBucketsCommandOutput>;
    getConfig(): DoFeUploader.Config;
    /**
     * 列出指定前缀的文件列表
     *
     * @param prefix 文件前缀，默认为空字符串
     * @param limit 返回的文件列表数量限制，默认为无限制
     * @param delimiter 分隔符，用于返回文件夹列表，默认为空字符串
     * @param bucket 存储桶名称，默认为当前实例的存储桶
     * @param options 其他配置选项
     * @returns 返回符合前缀的文件列表的Promise
     */
    listFilesPrefix(prefix?: string, limit?: number, delimiter?: string, bucket?: string, options?: any): Promise<string[]>;
    /**
     * 删除指定文件
     *
     * @param fileKey 文件键名
     * @param bucket 存储桶名称（可选，默认为当前实例的存储桶）
     * @returns 返回一个Promise对象，解析为删除操作的结果
     */
    deleteFile(fileKey: string, bucket?: string): Promise<boolean>;
    batchDeleteFiles(fileKeys: string[], bucket?: string): Promise<any>;
    getFileInfo(fileKey: string, bucket?: string): Promise<any>;
    /**
     * 获取私有文件的下载链接
     *
     * @param fileKey 文件键名
     * @param expire 链接过期时间，单位为秒，默认为30秒
     * @param internal 是否使用内部客户端，默认为false
     * @param bucket 存储桶名称（可选），如果未提供则使用配置中的默认存储桶
     * @returns 返回一个Promise，解析后得到私有文件的下载链接
     */
    getPrivateDownloadUrl(fileKey: string, expire?: number, internal?: boolean, bucket?: string): Promise<string>;
    fetchToBucket(resUrl: string, fileKey: string, bucket?: string): Promise<any>;
    copyFile(sourceBucket: string, sourceObject: string, targetBucket: string, targetObject: string): Promise<import("@aws-sdk/client-s3").CopyObjectCommandOutput>;
    replaceUrlToOwnDoamin(url: string): string;
}
