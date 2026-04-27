/**
 * @fileoverview File CDN 客户端
 *
 * 本文件实现了 CDN URL 生成服务，负责：
 * - 生成图片 CDN URL（火山引擎、CloudFlare）
 * - 生成视频点播 URL
 * - 生成文件下载 URL
 * - 处理 CDN 签名和认证
 *
 * @module file-cdn/client
 */
import { Logger } from 'winston';
import { ConfigService } from '@nestjs/config';
import { FileBucketVendor } from '@prisma/client';
import { RedisService } from "../../../../redis/src";
import { FileStorageService } from "../../../../shared-services/src/file-storage";
import { CryptClient } from "../crypt";
import { CdnUrlResponse, ImageTemplateId, CloudFlareTemplate } from './dto/file-cdn.dto';
/**
 * File CDN 客户端
 *
 * @description 提供 CDN URL 生成服务，支持多种 CDN 供应商和 URL 类型。
 *
 * 主要功能：
 * - **图片 CDN**: 火山引擎图片处理、CloudFlare 图片优化
 * - **视频 CDN**: 视频点播 URL 生成
 * - **下载 CDN**: 文件下载 URL 生成
 *
 * 安全特性：
 * - 支持 AWS 签名 V4 认证
 * - 支持 URL 签名验证
 * - 私有文件访问控制
 *
 * @class FileCdnClient
 *
 * @example
 * ```typescript
 * @Injectable()
 * class ImageService {
 *   constructor(private readonly cdnClient: FileCdnClient) {}
 *
 *   // 获取图片 CDN URL
 *   async getImageUrl(vendor: FileBucketVendor, bucket: string, key: string) {
 *     return await this.cdnClient.getImageVolcengineCdn(
 *       vendor,
 *       bucket,
 *       key,
 *       'mini',
 *     );
 *   }
 *
 *   // 获取视频 URL
 *   async getVideoUrl(vendor: FileBucketVendor, bucket: string, key: string) {
 *     return await this.cdnClient.getVodUrl(vendor, bucket, key);
 *   }
 * }
 * ```
 */
export declare class FileCdnClient {
    private readonly config;
    private readonly redis;
    private readonly fileApi;
    private readonly crypt;
    private readonly logger;
    /**
     * CDN 配置
     * @private
     */
    private readonly cdnConfig;
    /**
     * 默认存储供应商
     * @private
     */
    private readonly defaultVendor;
    /**
     * 构造函数
     *
     * @param {ConfigService} config - NestJS 配置服务
     * @param {RedisService} redis - Redis 服务
     * @param {FileStorageService} fileApi - 文件存储服务
     * @param {CryptClient} crypt - 加密服务
     * @param {Logger} logger - Winston 日志记录器
     */
    constructor(config: ConfigService, redis: RedisService, fileApi: FileStorageService, crypt: CryptClient, logger: Logger);
    /**
     * 获取文件下载 URL
     *
     * @description 生成文件下载器的 CDN URL，支持公开和私有文件。
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} key - 文件键
     * @returns {Promise<string>} CDN 下载 URL
     *
     * @example
     * ```typescript
     * const url = await cdnClient.getDownloaderUrl('oss', 'my-bucket', 'files/doc.pdf');
     * // 返回: "https://cdn.example.com/signed-url..."
     * ```
     */
    getDownloaderUrl(vendor: FileBucketVendor, bucket: string, key: string): Promise<string>;
    /**
     * 获取视频点播 URL
     *
     * @description 生成视频点播的 CDN URL，支持公开和私有视频。
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} key - 视频文件键
     * @returns {Promise<string>} CDN 视频 URL
     *
     * @example
     * ```typescript
     * const url = await cdnClient.getVodUrl('tos', 'video-bucket', 'videos/movie.mp4');
     * // 返回: "https://vod.example.com/signed-url..."
     * ```
     */
    getVodUrl(vendor: FileBucketVendor, bucket: string, key: string): Promise<string>;
    /**
     * 获取火山引擎图片 CDN URL
     *
     * @description 生成火山引擎图片处理的 CDN URL，支持多种图片模板。
     *
     * 支持的模板：
     * - `origin`: 原图预览
     * - `preview`: 预览图
     * - `mini`: 缩略图
     * - 自定义尺寸: `183:103:360:360` 格式
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} key - 图片文件键
     * @param {ImageTemplateId} [templateId='183:103:360:360'] - 图片模板 ID
     * @returns {Promise<string>} CDN 图片 URL
     *
     * @example
     * ```typescript
     * // 获取缩略图
     * const miniUrl = await cdnClient.getImageVolcengineCdn(
     *   'tos',
     *   'image-bucket',
     *   'images/photo.jpg',
     *   'mini',
     * );
     *
     * // 获取自定义尺寸
     * const customUrl = await cdnClient.getImageVolcengineCdn(
     *   'tos',
     *   'image-bucket',
     *   'images/photo.jpg',
     *   '640:480:640:480',
     * );
     * ```
     */
    getImageVolcengineCdn(vendor: FileBucketVendor, bucket: string, key: string, templateId?: ImageTemplateId): Promise<string>;
    /**
     * 获取 CloudFlare 图片 CDN URL
     *
     * @description 生成 CloudFlare 图片优化的 CDN URL。
     *
     * 支持的模板：
     * - `360:360:360:360`: 360x360 裁剪
     * - `183:103:360:360`: 320x180 裁剪
     * - `origin`: 原图
     * - `mini`: 360x360 包含
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} key - 图片文件键
     * @param {CloudFlareTemplate} [templateId='183:103:360:360'] - CloudFlare 模板
     * @returns {Promise<string>} CDN 图片 URL
     *
     * @example
     * ```typescript
     * const url = await cdnClient.getImageCloudFlareCdnUrl(
     *   'oss',
     *   'image-bucket',
     *   'images/photo.jpg',
     *   'mini',
     * );
     * ```
     */
    getImageCloudFlareCdnUrl(vendor: FileBucketVendor, bucket: string, key: string, templateId?: CloudFlareTemplate): Promise<string>;
    /**
     * 获取原始 CDN 图片（带验证）
     *
     * @description 验证签名后返回原始图片 URL，用于 CDN 回源。
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @param {string} key - 图片文件键
     * @param {string} [auth] - 认证信息
     * @param {string} [expireIn] - 过期时间
     * @param {string} [signature] - 签名
     * @param {string} [signedHeaders] - 签名头
     * @param {string} [signedId] - 签名 ID
     * @param {string} [templateId='183:103:360:360'] - 模板 ID
     * @returns {Promise<CdnUrlResponse>} CDN URL 响应
     *
     * @example
     * ```typescript
     * const response = await cdnClient.getCdnOriginImages(
     *   'tos',
     *   'bucket',
     *   'key',
     *   auth,
     *   expireIn,
     *   signature,
     *   signedHeaders,
     *   signedId,
     * );
     *
     * if (response.code === 200) {
     *   console.log('Origin URL:', response.url);
     * }
     * ```
     */
    getCdnOriginImages(vendor: FileBucketVendor, bucket: string, key: string, auth?: string, expireIn?: string, signature?: string, signedHeaders?: string, signedId?: string, templateId?: string): Promise<CdnUrlResponse>;
    /**
     * 构建 URI 路径
     *
     * @private
     */
    private buildUri;
    /**
     * 构建公开 URL
     *
     * @private
     */
    private buildPublicUrl;
    /**
     * 构建私有 URL（带 AWS 签名 V4）
     *
     * @private
     */
    private buildPrivateUrl;
    /**
     * 构建私有图片 URL
     *
     * @private
     */
    private buildPrivateImageUrl;
    /**
     * 构建 CloudFlare 私有 URL
     *
     * @private
     */
    private buildCloudFlarePrivateUrl;
    /**
     * 构建 AWS 签名 URL
     *
     * @private
     */
    private buildAwsSignedUrl;
    /**
     * 生成签名
     *
     * @private
     */
    private generateSignature;
    /**
     * 获取火山引擎图片模板
     *
     * @private
     */
    private getVolcengineTemplate;
    /**
     * 获取 CloudFlare 图片模板
     *
     * @private
     */
    private getCloudFlareTemplate;
    /**
     * 验证签名
     *
     * @private
     */
    private validateSignature;
    /**
     * 创建禁止访问响应
     *
     * @private
     */
    private createForbiddenResponse;
    /**
     * 创建成功响应
     *
     * @private
     */
    private createSuccessResponse;
}
