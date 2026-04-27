import { Logger } from 'winston';
import { HttpService } from '@nestjs/axios';
import { DoFeUploader } from './dto/file.dto';
import { StorageCredentialsConfig, AppConfig } from "../../../../common/src/config/validation";
import { FileS3Client } from './file-s3.client';
import { RedisService } from "../../../../redis/src";
/**
 * Volcengine TOS (Tinder Object Storage) Client
 *
 * 职责：仅负责与火山引擎 TOS API 通信
 * - 不访问数据库
 * - 不包含业务逻辑
 */
export declare class FileTosClient extends FileS3Client {
    protected urlRedisKey: string;
    private tosClient;
    private tosInternalClient;
    constructor(config: DoFeUploader.Config, storageConfig: StorageCredentialsConfig, appConfig: AppConfig, redis: RedisService, httpService: HttpService, logger: Logger);
    /**
     * 初始化火山引擎 TOS 客户端
     * 参考：https://www.volcengine.com/docs/6349/113484?lang=zh
     */
    setTosClient(): void;
    /**
     * 保持与父类的兼容性，同时初始化 S3 客户端（用于其他操作）
     */
    setClient(): void;
    /**
     * 获取视频信息，并组合成 VideoInfo 结构
     *
     * @param fileKey 视频文件键名
     * @param internal 是否使用内部客户端，默认为false
     * @param bucket 存储桶名称（可选），如果未提供则使用配置中的默认存储桶
     * @returns 返回组合后的 VideoInfo 对象
     */
    getVideoInfo(fileKey: string, internal?: boolean, bucket?: string): Promise<any>;
    /**
     * 获取图片信息
     * 参考：https://www.volcengine.com/docs/6349/1179568?lang=zh
     *
     * 使用 TOS SDK 的图片信息获取功能，返回图片的基本信息（格式、宽度、高度、大小等）
     * 如果图片包含 Exif 信息，将按照 JSON 格式返回内容
     *
     * @param fileKey 图片文件键名
     * @param internal 是否使用内部客户端，默认为false
     * @param bucket 存储桶名称（可选），如果未提供则使用配置中的默认存储桶
     * @returns 返回图片信息的 JSON 字符串
     */
    getImageInfo(fileKey: string, internal?: boolean, bucket?: string): Promise<any>;
    /**
     * 获取音频信息
     * 参考：火山引擎 TOS 媒体处理文档
     *
     * 使用 TOS SDK 的音频信息获取功能，返回音频的详细信息（时长、采样率、声道数、比特率等）
     *
     * @param fileKey 音频文件键名
     * @param internal 是否使用内部客户端，默认为false
     * @param bucket 存储桶名称（可选），如果未提供则使用配置中的默认存储桶
     * @returns 返回音频信息的对象
     */
    /**
     * 获取音频信息，并组合成 AudioInfo 结构
     *
     * @param fileKey 音频文件键名
     * @param internal 是否使用内部客户端，默认为false
     * @param bucket 存储桶名称（可选），如果未提供则使用配置中的默认存储桶
     * @returns 返回组合后的 AudioInfo 对象
     */
    getAudioInfo(fileKey: string, internal?: boolean, bucket?: string): Promise<any>;
    /**
     * 视频第一帧截帧并持久化存储
     * 参考：https://www.volcengine.com/docs/6349/1179565?lang=zh
     *
     * 使用 TOS SDK 的视频截帧功能，截取视频第一帧并保存到指定位置
     *
     * @param fileKey 视频文件键名
     * @param internal 是否使用内部客户端，默认为false
     * @param bucket 存储桶名称（可选），如果未提供则使用配置中的默认存储桶
     * @returns 返回保存的截图文件键名
     */
    getSnapshot(fileKey: string, internal?: boolean, bucket?: string, time?: number, width?: number, height?: number, format?: string): Promise<string>;
    /**
     * 获取私有文件的下载链接
     * 参考：https://www.volcengine.com/docs/6349/113484?lang=zh
     *
     * 使用火山引擎官方 TOS SDK 生成预签名 URL
     *
     * @param fileKey 文件键名
     * @param expire 链接过期时间，单位为秒，默认为30秒
     * @param internal 是否使用内部客户端，默认为false
     * @param bucket 存储桶名称（可选），如果未提供则使用配置中的默认存储桶
     * @returns 返回一个Promise，解析后得到私有文件的下载链接
     */
    getPrivateDownloadUrl(fileKey: string, expire?: number, internal?: boolean, bucket?: string): Promise<string>;
    /**
     * 获取私有文件的下载链接（不进行 CDN 加密）
     * 参考：https://www.volcengine.com/docs/6349/113484?lang=zh
     *
     * 使用火山引擎官方 TOS SDK 生成预签名 URL
     *
     * @param fileKey 文件键名
     * @param expiresIn 链接过期时间，单位为秒，默认为30秒
     * @param internal 是否使用内部客户端，默认为false
     * @param bucket 存储桶名称（可选），如果未提供则使用配置中的默认存储桶
     * @returns 返回一个Promise，解析后得到私有文件的下载链接
     */
    getPrivateDownloadUrlWithoutCdnEncrypt(fileKey: string, expiresIn?: number, internal?: boolean, bucket?: string): Promise<string>;
}
