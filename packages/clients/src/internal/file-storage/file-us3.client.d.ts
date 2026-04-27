import { Logger } from 'winston';
import { HttpService } from '@nestjs/axios';
import { DoFeUploader } from './dto/file.dto';
import { StorageCredentialsConfig, AppConfig } from "../../../../common/src/config/validation";
import { FileS3Client } from './file-s3.client';
import { RedisService } from "../../../../redis/src";
/**
 * UCloud US3 Storage Client
 *
 * 职责：仅负责与 UCloud US3 API 通信
 * - 不访问数据库
 * - 不包含业务逻辑
 */
export declare class FileUs3Client extends FileS3Client {
    protected urlRedisKey: string;
    constructor(config: DoFeUploader.Config, storageConfig: StorageCredentialsConfig, appConfig: AppConfig, redis: RedisService, httpService: HttpService, logger: Logger);
    setClient(): void;
    /**
     * 获取私有文件的下载链接
     *
     * @param fileKey 文件键名
     * @param expire 链接过期时间，单位为秒，默认为3600秒
     * @param internal 是否使用内部客户端，默认为false
     * @returns 返回一个Promise，解析后得到私有文件的下载链接
     */
    getPrivateDownloadUrl(fileKey: string, expire?: number, internal?: boolean, bucket?: string): Promise<string>;
    getPrivateDownloadUrlWithoutCdnEncrypt(fileKey: string, expiresIn?: number, internal?: boolean, bucket?: string): Promise<string>;
    getSignedUrl(fileKey: string, expiresIn?: number, bucket?: string): string;
}
