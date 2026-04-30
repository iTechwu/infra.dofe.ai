import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import {
    AudioInfo,
    FileBucketVendor,
    ImageInfo,
    VideoInfo,
    VideoQuality,
} from '@prisma/client';
import { FileStorageService, PardxUploader } from '@dofe/infra-shared-services';
import { arrayUtil } from '@dofe/infra-utils';
import { getKeysConfig } from '@dofe/infra-common';
import { StorageCredentialsConfig } from '@dofe/infra-common';
import {
    AliyunImmClient,
    MediaConvertTaskResult,
    AudioExtractOptions,
} from '../aliyun-imm/aliyun-imm.client';
import { AliyunOssTranscodeConfig } from '../../config/aliyun-oss.config';
import OSS from 'ali-oss';
import { firstValueFrom } from 'rxjs';
import { fileUtil } from '@dofe/infra-utils';
import imm, * as $imm from '@alicloud/imm20200930';

export interface TranscodeOptions {
    format?: string;
    resolution?: string;
    bitrate?: string;
    frameRate?: string;
    quality?: string;
    videoCodec?: string;
    audioCodec?: string;
    audioBitrate?: string;
}

export interface SpriteOptions {
    width?: number;
    height?: number;
    interval?: number;
    columns?: number;
    lines?: number;
    startTime?: string; // 起始时间（HH:mm:ss 格式）
    format?: string; // 输出格式：jpg 或 png
    scaleType?: string; // 缩放方式：crop, stretch, fill, fit
    padding?: number; // 子图间隔
    margin?: number; // 边缘间隔
    maxFrames?: number; // 最大帧数
    percentWidth?: number; // 百分比宽度 (0,200]
    percentHeight?: number; // 百分比高度 (0,200]
}

export interface SnapshotOptions {
    time?: string;
    width?: number;
    height?: number;
    format?: string;
    quality?: number;
}

export interface MediaMetaResult {
    type: 'video' | 'audio' | 'image';
    info: Partial<VideoInfo | AudioInfo | ImageInfo>;
    rawData: any;
}
export interface TaskStatus {
    status: string;
    progress?: number;
    result?: any;
    error?: string;
}

@Injectable()
export class AliyunOssTranscodeClient {
    private ossClients: Record<string, OSS>;
    private configs: Record<string, AliyunOssTranscodeConfig>;

    constructor(
        private readonly configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        private readonly aliyunImm: AliyunImmClient,
        private readonly httpService: HttpService,
    ) {
        // 预初始化所有OSS客户端
        this.configs = {
            'pardx-files': this.getAliyunOssConfig('oss', 'pardx-files'),
            'pardx-image': this.getAliyunOssConfig('oss', 'pardx-image'),
            'pardx-ai': this.getAliyunOssConfig('oss', 'pardx-ai'),
            'pardx-transcoding': this.getAliyunOssConfig(
                'oss',
                'pardx-transcoding',
            ),
        };

        // 创建OSS客户端实例
        this.ossClients = {};
        Object.entries(this.configs).forEach(([bucket, config]) => {
            this.ossClients[bucket] = this.createOssClient(config);
        });
    }

    /**
     * 获取阿里云 OSS 配置
     */
    private getAliyunOssConfig(
        vendor: FileBucketVendor,
        bucket: string,
    ): AliyunOssTranscodeConfig {
        if (vendor !== 'oss') {
            throw new Error(`Unsupported vendor: ${vendor}`);
        }
        const bucketConfigs =
            this.configService.getOrThrow<PardxUploader.Config[]>('buckets');
        const bucketConfig = arrayUtil.findOne(bucketConfigs, {
            bucket,
            vendor,
        });
        if (!bucketConfig) {
            throw new Error(`Bucket config not found: ${bucket}`);
        }

        // 从配置中获取阿里云 OSS 配置
        const ossConfig = getKeysConfig()?.storage?.[
            vendor
        ] as StorageCredentialsConfig;

        if (!ossConfig) {
            throw new Error('Aliyun OSS configuration not found');
        }

        return {
            endpoint: bucketConfig.endpoint,
            accessKeyId: ossConfig.accessKey,
            accessKeySecret: ossConfig.secretKey,
            bucket,
        };
    }

    /**
     * 构建 OSS 处理 URL
     */
    private buildProcessUrl(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        process: string,
    ): string {
        if (vendor !== 'oss') {
            throw new Error(`Unsupported vendor: ${vendor}`);
        }

        const config = this.getAliyunOssConfig(vendor, bucket);
        const encodedProcess = encodeURIComponent(process);

        return `${config.endpoint}/${bucket}/${key}?x-oss-process=${encodedProcess}`;
    }
    /**
     * 执行 OSS 处理请求
     */
    private async executeOssProcess(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        process: string,
    ): Promise<any> {
        if (vendor !== 'oss') {
            throw new Error(`Unsupported vendor: ${vendor}`);
        }

        try {
            this.logger.debug('Executing OSS process', {
                bucket,
                key,
                process,
            });

            // 使用 ali-oss 客户端直接处理
            const result = await this.executeOssProcessWithClient(
                vendor,
                bucket,
                key,
                process,
            );

            return result;
        } catch (error) {
            this.logger.error('OSS process failed', {
                vendor,
                bucket,
                key,
                process,
                error: error.message,
            });
            throw new Error(`OSS process failed: ${error.message}`);
        }
    }

    /**
     * 使用 ali-oss 客户端直接执行 OSS 处理请求
     * 参考：https://github.com/ali-sdk/ali-oss/tree/master?tab=readme-ov-file#getname-file-options
     */
    private async executeOssProcessWithClient(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        process: string,
        outputKey: string = null,
    ): Promise<any> {
        if (vendor !== 'oss') {
            throw new Error(`Unsupported vendor: ${vendor}`);
        }

        try {
            const ossClient = this.getOssClient(bucket);

            console.log('Executing OSS process with client', {
                bucket,
                key,
                process,
                outputKey,
            });

            // 使用 ali-oss 的 get 方法直接处理
            // 参考：https://github.com/ali-sdk/ali-oss/tree/master?tab=readme-ov-file#getname-file-options
            const result = await ossClient.processObjectSave(
                key,
                outputKey,
                process,
                bucket,
            );

            this.logger.debug('OSS process completed successfully', {
                bucket,
                key,
                process,
                resultSize: result.content?.length || 0,
            });

            return result;
        } catch (error) {
            this.logger.error('OSS process with client failed', {
                vendor,
                bucket,
                key,
                process,
                error: error.message,
                errorCode: error.code,
                errorName: error.name,
            });

            // 根据错误类型提供更详细的错误信息
            if (error.code === 'NoSuchKey') {
                throw new Error(`File not found: ${key} in bucket ${bucket}`);
            } else if (error.code === 'AccessDenied') {
                throw new Error(
                    `Access denied to bucket ${bucket} or file ${key}`,
                );
            } else if (error.code === 'InvalidArgument') {
                throw new Error(`Invalid process parameters: ${process}`);
            } else if (error.name === 'RequestTimeoutError') {
                throw new Error(`Request timeout for process: ${process}`);
            } else {
                throw new Error(`OSS process failed: ${error.message}`);
            }
        }
    }

    /**
     * 获取视频信息（使用 IMM 服务）
     */
    async getVideoInfo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        type: 'imm' | 'oss' = 'imm',
    ): Promise<Partial<VideoInfo>> {
        try {
            this.logger.info('Getting video info using IMM service', {
                vendor,
                bucket,
                key,
                type,
            });

            const fileType = 'video';
            // 统一使用 IMM 服务获取视频信息
            const result = await this.aliyunImm.detectMediaMeta(
                vendor,
                bucket,
                key,
                fileType,
            );

            this.logger.info('Video info extracted successfully', {
                type: result.type,
                info: result.info,
            });

            return result.info as VideoInfo;
        } catch (error) {
            this.logger.error('Failed to get video info', {
                vendor,
                bucket,
                key,
                type,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * 获取音频信息（使用 IMM 服务）
     */
    async getAudioInfo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        type: 'imm' | 'oss' = 'imm',
    ): Promise<Partial<AudioInfo>> {
        try {
            this.logger.info('Getting audio info using IMM service', {
                vendor,
                bucket,
                key,
                type,
            });

            const fileType = 'audio';
            // 统一使用 IMM 服务获取音频信息
            const result = await this.aliyunImm.detectMediaMeta(
                vendor,
                bucket,
                key,
                fileType,
            );

            this.logger.info('Audio info extracted successfully', {
                type: result.type,
                info: result.info,
            });

            return result.info as AudioInfo;
        } catch (error) {
            this.logger.error('Failed to get audio info', {
                vendor,
                bucket,
                key,
                type,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * 获取图片信息（使用 IMM 服务）
     */
    async getImageInfo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        type: 'imm' | 'oss' = 'imm',
    ): Promise<Partial<ImageInfo>> {
        try {
            this.logger.info('Getting image info using IMM service', {
                vendor,
                bucket,
                key,
                type,
            });

            const fileType = 'image';
            // 统一使用 IMM 服务获取图片信息
            const result = await this.aliyunImm.detectMediaMeta(
                vendor,
                bucket,
                key,
                fileType,
            );

            this.logger.info('Image info extracted successfully', {
                type: result.type,
                info: result.info,
            });

            return result.info as ImageInfo;
        } catch (error) {
            this.logger.error('Failed to get image info', {
                vendor,
                bucket,
                key,
                type,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * 视频转码（使用 IMM 服务）
     */
    async transcodeVideo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        quality: VideoQuality[] = [
            VideoQuality.VIDEO_4K,
            VideoQuality.VIDEO_1080P,
            VideoQuality.VIDEO_720P,
            VideoQuality.VIDEO_360P,
        ],
        index: number = 0,
    ): Promise<MediaConvertTaskResult> {
        try {
            this.logger.info(
                'Creating video transcode task using IMM service',
                {
                    vendor,
                    bucket,
                    key,
                    quality,
                },
            );

            // 使用 IMM 服务创建媒体转码任务
            const result = await this.aliyunImm.createMediaConvertTask(
                vendor,
                bucket,
                key,
                quality,
                index,
            );

            console.log(
                'Video transcode task created successfully using IMM',
                result,
            );

            return result;
        } catch (error) {
            this.logger.error(
                'Failed to create video transcode task using IMM',
                {
                    vendor,
                    bucket,
                    key,
                    quality,
                    error: error.message,
                },
            );
            throw error;
        }
    }

    /**
     * 构建异步处理指令
     */
    private buildAsyncProcessCommand(
        style: string,
        bucket: string,
        targetKey: string,
    ): string {
        // Base64 编码 bucket 和 targetKey
        const bucketEncoded = Buffer.from(bucket)
            .toString('base64')
            .replace(/=/g, '');
        const targetEncoded = Buffer.from(targetKey)
            .toString('base64')
            .replace(/=/g, '');

        // 构建完整的异步处理指令
        return `${style}|sys/saveas,b_${bucketEncoded},o_${targetEncoded}`;
    }

    /**
     * 执行异步处理任务
     */
    private async executeAsyncProcess(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        process: string,
    ): Promise<{ taskId: string }> {
        const config = this.getAliyunOssConfig(vendor, bucket);
        const url = `${config.endpoint}/${bucket}/${key}?x-oss-async-process`;

        try {
            const headers = this.buildCompleteAuthorizationHeaders(
                config,
                'POST',
                bucket,
                key,
                'application/x-www-form-urlencoded',
            );

            const response = await firstValueFrom(
                this.httpService.post(url, process, {
                    headers,
                }),
            );
            return { taskId: this.extractTaskId(response.data) };
        } catch (error) {
            this.logger.error('Async process execution failed', {
                url,
                process,
                error: error.message,
            });
            throw new Error(`Async process failed: ${error.message}`);
        }
    }

    /**
     * 构建授权头
     */
    private buildAuthorizationHeader(
        config: AliyunOssTranscodeConfig,
        method: string,
        bucket: string,
        key: string,
    ): string {
        try {
            const signature = this.generateSignature(
                method,
                bucket,
                key,
                config,
            );
            return `OSS ${config.accessKeyId}:${signature}`;
        } catch (error) {
            this.logger.error('Failed to build authorization header', {
                method,
                bucket,
                key,
                error: error.message,
            });
            throw new Error(
                `Failed to build authorization header: ${error.message}`,
            );
        }
    }

    /**
     * 解析媒体元信息响应
     */
    private parseMediaMetaResponse(
        mediaMetadata: $imm.DetectMediaMetaResponseBody | any,
        type: 'video' | 'audio' | 'image' | 'else',
    ): MediaMetaResult {
        if (!mediaMetadata) {
            throw new Error('No media metadata found in response');
        }
        if (type === 'image') {
            const imageInfo: Partial<ImageInfo> = {
                width: mediaMetadata?.ImageWidth.value,
                height: mediaMetadata?.ImageHeight.value,
                sar:
                    mediaMetadata?.ImageWidth.value +
                    ':' +
                    mediaMetadata?.ImageHeight.value,
                dar:
                    mediaMetadata?.ImageWidth.value +
                    ':' +
                    mediaMetadata?.ImageHeight.value,
                ffmpegInfo: JSON.parse(JSON.stringify(mediaMetadata)), // 确保序列化
            };

            return {
                type,
                info: imageInfo,
                rawData: mediaMetadata,
            };
        }

        const {
            duration,
            videoStreams,
            audioStreams,
            videoWidth,
            videoHeight,
        } = mediaMetadata;

        if (type === 'video' && videoStreams && videoStreams.length > 0) {
            const videoInfo: Partial<VideoInfo> = {
                width: videoWidth,
                height: videoHeight,
                duration: duration,
                streamDuration: videoStreams[0]?.streamDuration,
                sar: videoStreams[0]?.sampleAspectRatio,
                dar: videoStreams[0]?.displayAspectRatio,
                rFrameRate: videoStreams[0]?.frameRate,
                ffmpegInfo: JSON.parse(JSON.stringify(mediaMetadata)), // 确保序列化
            };

            return {
                type,
                info: videoInfo,
                rawData: mediaMetadata,
            };
        }

        if (type === 'audio' && audioStreams && audioStreams.length > 0) {
            const audioInfo: Partial<AudioInfo> = {
                duration: duration,
                streamDuration: audioStreams[0]?.streamDuration,
                channels: audioStreams[0]?.channels,
                channelLayout: audioStreams[0]?.channelLayout,
                sampleRate: audioStreams[0]?.sampleRate?.toString(),
                bitRate: audioStreams[0]?.bitRate,
                ffmpegInfo: JSON.parse(JSON.stringify(mediaMetadata)), // 确保序列化
            };

            return {
                type,
                info: audioInfo,
                rawData: mediaMetadata,
            };
        }

        // 如果无法确定类型或没有流信息，返回原始数据
        return {
            type: 'else' as any,
            info: {
                ffmpegInfo: JSON.parse(JSON.stringify(mediaMetadata)), // 确保序列化
            },
            rawData: mediaMetadata,
        };
    }

    /**
     * 解析OSS图片响应
     */
    private parseOssImageResponse(response: any): any {
        try {
            if (response.content) {
                const content = response.content.toString('utf-8');
                return this.parseOssImageContent(content);
            }
            return response;
        } catch (error) {
            this.logger.warn('Failed to parse OSS image response', {
                error: error.message,
            });
            return response;
        }
    }

    /**
     * 解析OSS图片内容
     */
    private parseOssImageContent(content: string): any {
        try {
            // 尝试解析JSON
            if (content.startsWith('{') || content.startsWith('[')) {
                return JSON.parse(content);
            }

            // 解析文本格式
            const lines = content.split('\n').filter((line) => line.trim());
            const imageInfo: any = {};

            lines.forEach((line) => {
                const [key, value] = line.split(':').map((s) => s.trim());
                if (key && value) {
                    if (['width', 'height', 'size'].includes(key)) {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                            imageInfo[key] = numValue;
                        } else {
                            imageInfo[key] = value;
                        }
                    } else {
                        imageInfo[key] = value;
                    }
                }
            });

            return {
                ImageWidth: { value: imageInfo.width },
                ImageHeight: { value: imageInfo.height },
                format: imageInfo.format || 'unknown',
                size: imageInfo.size,
                rawContent: content,
            };
        } catch (error) {
            this.logger.warn('Failed to parse OSS image content', {
                error: error.message,
                content: content.substring(0, 200),
            });
            return { rawContent: content };
        }
    }

    /**
     * 解析OSS视频响应
     */
    private parseOssVideoResponse(response: any): any {
        try {
            if (response.content) {
                const content = response.content.toString('utf-8');
                return this.parseOssVideoContent(content);
            }
            return response;
        } catch (error) {
            this.logger.warn('Failed to parse OSS video response', {
                error: error.message,
            });
            return response;
        }
    }

    /**
     * 解析OSS视频内容
     */
    private parseOssVideoContent(content: string): any {
        try {
            // 尝试解析JSON
            if (content.startsWith('{') || content.startsWith('[')) {
                return JSON.parse(content);
            }

            // 解析文本格式
            const lines = content.split('\n').filter((line) => line.trim());
            const videoInfo: any = {};

            lines.forEach((line) => {
                const [key, value] = line.split(':').map((s) => s.trim());
                if (key && value) {
                    if (
                        [
                            'width',
                            'height',
                            'duration',
                            'bitrate',
                            'frameRate',
                        ].includes(key)
                    ) {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                            videoInfo[key] = numValue;
                        } else {
                            videoInfo[key] = value;
                        }
                    } else {
                        videoInfo[key] = value;
                    }
                }
            });

            return {
                videoWidth: videoInfo.width,
                videoHeight: videoInfo.height,
                duration: videoInfo.duration,
                bitrate: videoInfo.bitrate,
                frameRate: videoInfo.frameRate,
                format: videoInfo.format || 'unknown',
                codec: videoInfo.codec || 'unknown',
                videoStreams: [
                    {
                        width: videoInfo.width,
                        height: videoInfo.height,
                        duration: videoInfo.duration,
                        bitrate: videoInfo.bitrate,
                        frameRate: videoInfo.frameRate,
                        codec: videoInfo.codec || 'unknown',
                        format: videoInfo.format || 'unknown',
                    },
                ],
                rawContent: content,
            };
        } catch (error) {
            this.logger.warn('Failed to parse OSS video content', {
                error: error.message,
                content: content.substring(0, 200),
            });
            return { rawContent: content };
        }
    }

    /**
     * 解析OSS音频响应
     */
    private parseOssAudioResponse(response: any): any {
        try {
            if (response.content) {
                const content = response.content.toString('utf-8');
                return this.parseOssAudioContent(content);
            }
            return response;
        } catch (error) {
            this.logger.warn('Failed to parse OSS audio response', {
                error: error.message,
            });
            return response;
        }
    }

    /**
     * 解析OSS音频内容
     */
    private parseOssAudioContent(content: string): any {
        try {
            // 尝试解析JSON
            if (content.startsWith('{') || content.startsWith('[')) {
                return JSON.parse(content);
            }

            // 解析文本格式
            const lines = content.split('\n').filter((line) => line.trim());
            const audioInfo: any = {};

            lines.forEach((line) => {
                const [key, value] = line.split(':').map((s) => s.trim());
                if (key && value) {
                    if (
                        [
                            'duration',
                            'channels',
                            'sampleRate',
                            'bitrate',
                        ].includes(key)
                    ) {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                            audioInfo[key] = numValue;
                        } else {
                            audioInfo[key] = value;
                        }
                    } else {
                        audioInfo[key] = value;
                    }
                }
            });

            return {
                duration: audioInfo.duration,
                audioStreams: [
                    {
                        duration: audioInfo.duration,
                        channels: audioInfo.channels,
                        sampleRate: audioInfo.sampleRate,
                        bitRate: audioInfo.bitrate,
                        codec: audioInfo.codec || 'unknown',
                        format: audioInfo.format || 'unknown',
                    },
                ],
                rawContent: content,
            };
        } catch (error) {
            this.logger.warn('Failed to parse OSS audio content', {
                error: error.message,
                content: content.substring(0, 200),
            });
            return { rawContent: content };
        }
    }

    /**
     * 解析OSS head响应
     */
    private parseOssHeadResponse(headResult: any, mediaType: string): any {
        try {
            const result: any = {
                type: mediaType,
                rawData: headResult,
            };

            // 从headers中提取信息
            if (headResult.res && headResult.res.headers) {
                const headers = headResult.res.headers;

                if (mediaType === 'image') {
                    result.ImageWidth = {
                        value: parseInt(headers['x-oss-image-width']) || 0,
                    };
                    result.ImageHeight = {
                        value: parseInt(headers['x-oss-image-height']) || 0,
                    };
                    result.format = headers['x-oss-image-format'] || 'unknown';
                    result.size = parseInt(headers['content-length']) || 0;
                } else if (mediaType === 'video') {
                    result.videoWidth =
                        parseInt(headers['x-oss-video-width']) || 0;
                    result.videoHeight =
                        parseInt(headers['x-oss-video-height']) || 0;
                    result.duration =
                        parseFloat(headers['x-oss-video-duration']) || 0;
                    result.format = headers['x-oss-video-format'] || 'unknown';
                } else if (mediaType === 'audio') {
                    result.duration =
                        parseFloat(headers['x-oss-audio-duration']) || 0;
                    result.channels =
                        parseInt(headers['x-oss-audio-channels']) || 0;
                    result.sampleRate =
                        parseInt(headers['x-oss-audio-sample-rate']) || 0;
                    result.format = headers['x-oss-audio-format'] || 'unknown';
                }
            }

            return result;
        } catch (error) {
            this.logger.warn('Failed to parse OSS head response', {
                error: error.message,
            });
            return headResult;
        }
    }

    /**
     * 获取OSS客户端实例（缓存版本）
     */
    public getOssClient(bucket: string): OSS {
        if (!this.ossClients[bucket]) {
            this.logger.warn(
                `OSS client not found for bucket: ${bucket}, creating new instance`,
            );
            this.ossClients[bucket] = this.createOssClient(
                this.configs[bucket],
            );
        }
        return this.ossClients[bucket];
    }

    /**
     * 创建优化的OSS客户端实例
     */
    private createOssClient(config: AliyunOssTranscodeConfig): OSS {
        return new OSS({
            region: config.region || 'cn-shanghai',
            accessKeyId: config.accessKeyId,
            accessKeySecret: config.accessKeySecret,
            bucket: config.bucket,
            endpoint: config.endpoint,
            // 启用V4签名
            authorizationV4: true,
            // 优化配置
            timeout: 30000,
            retryMax: 3,
            // 启用调试模式（生产环境可关闭）
            debug: process.env.NODE_ENV === 'dev',
        });
    }

    /**
     * 生成签名（使用 ali-oss 客户端）
     */
    private generateSignature(
        method: string,
        bucket: string,
        key: string,
        config: AliyunOssTranscodeConfig,
    ): string {
        try {
            const ossClient = this.createOssClient(config);
            const date = new Date().toUTCString();

            // 构建资源路径
            const resource = `/${bucket}/${key}`;

            // 构建请求头
            const headers = {
                date: date,
                'content-type': 'application/x-www-form-urlencoded',
            };

            // 使用 OSS 客户端的 authorization 方法生成签名
            const authHeader = ossClient.authorization(
                method,
                resource,
                {},
                headers,
            );

            // 从 Authorization 头中提取签名部分
            const signature = authHeader.replace(
                `OSS ${config.accessKeyId}:`,
                '',
            );

            return signature;
        } catch (error) {
            this.logger.error('Failed to generate OSS signature', {
                method,
                bucket,
                key,
                error: error.message,
            });
            // 如果签名生成失败，使用简单的占位符
            return 'signature_placeholder';
        }
    }

    /**
     * 生成OSS媒体处理签名（专门处理查询参数）
     */
    private generateMediaProcessSignature(
        method: string,
        bucket: string,
        key: string,
        process: string,
        config: AliyunOssTranscodeConfig,
    ): string {
        try {
            const ossClient = this.createOssClient(config);
            const date = new Date().toUTCString();

            // 构建资源路径
            const resource = `/${bucket}/${key}`;

            // 构建查询参数
            const subres = {
                'x-oss-process': process,
            };

            // 构建请求头
            const headers = {
                date: date,
                'content-type': 'application/x-www-form-urlencoded',
            };

            // 使用 OSS 客户端的 authorization 方法生成签名，包含查询参数
            const authHeader = ossClient.authorization(
                method,
                resource,
                subres,
                headers,
            );

            // 从 Authorization 头中提取签名部分
            const signature = authHeader.replace(
                `OSS ${config.accessKeyId}:`,
                '',
            );

            return signature;
        } catch (error) {
            this.logger.error(
                'Failed to generate OSS media process signature',
                {
                    method,
                    bucket,
                    key,
                    process,
                    error: error.message,
                },
            );
            throw new Error(
                `Failed to generate OSS media process signature: ${error.message}`,
            );
        }
    }

    /**
     * 构建OSS媒体处理的完整授权头
     */
    private buildMediaProcessHeaders(
        config: AliyunOssTranscodeConfig,
        method: string,
        bucket: string,
        key: string,
        process: string,
    ): Record<string, string> {
        const date = new Date().toUTCString();
        const signature = this.generateMediaProcessSignature(
            method,
            bucket,
            key,
            process,
            config,
        );

        return {
            Authorization: `OSS ${config.accessKeyId}:${signature}`,
            Date: date,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'PardxTranscodeClient/1.0',
        };
    }

    /**
     * 构建完整的授权头（包含所有必要的头部）
     */
    private buildCompleteAuthorizationHeaders(
        config: AliyunOssTranscodeConfig,
        method: string,
        bucket: string,
        key: string,
        contentType: string = 'application/x-www-form-urlencoded',
    ): Record<string, string> {
        const date = new Date().toUTCString();
        const signature = this.generateSignature(method, bucket, key, config);

        return {
            Authorization: `OSS ${config.accessKeyId}:${signature}`,
            Date: date,
            'Content-Type': contentType,
            'User-Agent': 'PardxTranscodeClient/1.0',
        };
    }

    /**
     * 从响应中提取 taskId
     */
    private extractTaskId(responseData: any): string {
        // 根据实际响应格式提取 taskId
        if (responseData && responseData.taskId) {
            return responseData.taskId;
        }

        // 如果没有直接的 taskId，可能需要从其他字段获取
        // 或者通过其他方式获取任务标识
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 生成视频雪碧图
     * 参考阿里云OSS文档：https://help.aliyun.com/zh/oss/video-cut-sprite
     */
    async generateSprite(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options: SpriteOptions = {},
    ): Promise<string> {
        try {
            // 验证参数
            this.validateSpriteOptions(options);

            const {
                width = 160,
                height = 90,
                interval = 10,
                columns = 10,
                lines = 10,
                startTime = '00:00:00',
                format = 'jpg',
                scaleType = 'fit',
                padding = 2,
                margin = 2,
                maxFrames,
                percentWidth,
                percentHeight,
            } = options;

            // 将起始时间转换为毫秒
            const startTimeMs = this.convertTimeToMilliseconds(startTime);

            // 构建OSS处理参数，按照阿里云文档规范
            const processParams = [
                'video/sprite',
                `f_${format}`, // 输出格式
            ];

            // 添加起始时间参数
            if (startTimeMs > 0) {
                processParams.push(`ss_${startTimeMs}`);
            }

            // 添加尺寸参数（像素或百分比）
            if (percentWidth && percentWidth > 0 && percentWidth <= 200) {
                processParams.push(`psw_${percentWidth}`);
            } else if (width > 0) {
                processParams.push(`sw_${width}`);
            }

            if (percentHeight && percentHeight > 0 && percentHeight <= 200) {
                processParams.push(`psh_${percentHeight}`);
            } else if (height > 0) {
                processParams.push(`sh_${height}`);
            }

            // 添加抽帧参数
            if (interval > 0) {
                processParams.push(`inter_${interval * 1000}`); // 转换为毫秒
            }

            if (maxFrames && maxFrames > 0) {
                processParams.push(`num_${maxFrames}`);
            }

            // 添加布局参数
            if (columns > 0) {
                processParams.push(`tw_${columns}`);
            }

            if (lines > 0) {
                processParams.push(`th_${lines}`);
            }

            // 添加间隔参数
            if (padding >= 0) {
                processParams.push(`pad_${padding}`);
            }

            if (margin >= 0) {
                processParams.push(`margin_${margin}`);
            }

            // 添加缩放方式
            if (
                scaleType &&
                ['crop', 'stretch', 'fill', 'fit'].includes(scaleType)
            ) {
                processParams.push(`scaletype_${scaleType}`);
            }

            const process = processParams.join(',');

            // 生成雪碧图文件名
            const spriteKey = this.generateSpriteKey(key, format, startTime);

            // 使用 ali-oss 直接处理，而不是构建URL
            const result = await this.executeOssProcessWithClient(
                vendor,
                bucket,
                spriteKey,
                process,
            );

            console.log('Sprite generation initiated', {
                spriteKey,
                process,
                options,
                startTime: startTimeMs,
                format,
                dimensions: `${width}x${height}`,
                layout: `${columns}x${lines}`,
                interval: `${interval}s`,
                result: result ? 'success' : 'failed',
            });

            // 返回处理后的文件路径，而不是URL
            return spriteKey;
        } catch (error) {
            this.logger.error('Failed to generate sprite', {
                vendor,
                bucket,
                key,
                options,
                error: error.message,
            });
            throw new Error(`Sprite generation failed: ${error.message}`);
        }
    }

    /**
     * 生成标准雪碧图（10x10布局，每10秒一帧）
     */
    async generateStandardSprite(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options: Partial<SpriteOptions> = {},
    ): Promise<string> {
        const defaultOptions: SpriteOptions = {
            width: 160,
            height: 90,
            interval: 10,
            columns: 10,
            lines: 10,
            format: 'jpg',
            scaleType: 'fit',
            padding: 2,
            margin: 2,
        };

        return this.generateSprite(vendor, bucket, key, {
            ...defaultOptions,
            ...options,
        });
    }

    /**
     * 生成高密度雪碧图（更多帧数，更小间隔）
     */
    async generateHighDensitySprite(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options: Partial<SpriteOptions> = {},
    ): Promise<string> {
        const defaultOptions: SpriteOptions = {
            width: 120,
            height: 68,
            interval: 5,
            columns: 15,
            lines: 15,
            format: 'jpg',
            scaleType: 'fit',
            padding: 1,
            margin: 1,
        };

        return this.generateSprite(vendor, bucket, key, {
            ...defaultOptions,
            ...options,
        });
    }

    /**
     * 生成宽屏雪碧图（适合16:9视频）
     */
    async generateWidescreenSprite(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options: Partial<SpriteOptions> = {},
    ): Promise<string> {
        const defaultOptions: SpriteOptions = {
            width: 320,
            height: 180,
            interval: 15,
            columns: 8,
            lines: 6,
            format: 'jpg',
            scaleType: 'fit',
            padding: 3,
            margin: 3,
        };

        return this.generateSprite(vendor, bucket, key, {
            ...defaultOptions,
            ...options,
        });
    }

    /**
     * 生成自定义时间范围雪碧图
     */
    async generateCustomTimeRangeSprite(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        startTime: string,
        endTime: string,
        options: Partial<SpriteOptions> = {},
    ): Promise<string> {
        try {
            const startMs = this.convertTimeToMilliseconds(startTime);
            const endMs = this.convertTimeToMilliseconds(endTime);

            if (startMs >= endMs) {
                throw new Error('Start time must be less than end time');
            }

            const duration = endMs - startMs;
            const interval =
                options.interval ||
                Math.max(5, Math.floor(duration / 1000 / 100)); // 默认间隔，最多100帧

            const spriteOptions: SpriteOptions = {
                startTime,
                interval,
                maxFrames: Math.min(
                    100,
                    Math.floor(duration / 1000 / interval),
                ),
                ...options,
            };

            return this.generateSprite(vendor, bucket, key, spriteOptions);
        } catch (error) {
            this.logger.error('Failed to generate custom time range sprite', {
                vendor,
                bucket,
                key,
                startTime,
                endTime,
                error: error.message,
            });
            throw new Error(
                `Custom time range sprite generation failed: ${error.message}`,
            );
        }
    }

    /**
     * 视频单帧截取
     * 参考阿里云OSS文档：https://help.aliyun.com/zh/oss/video-snapshots
     */
    async takeSnapshot(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options: SnapshotOptions = {},
    ): Promise<string> {
        const {
            time = '00:00:01',
            width = 0,
            height = 0,
            format = 'jpg',
            quality = 90,
        } = options;

        try {
            // 验证参数
            this.validateSnapshotOptions(options);

            // 将时间格式转换为毫秒
            const timeInMs = this.convertTimeToMilliseconds(time);

            // 构建OSS处理参数，按照阿里云文档规范
            const processParams = [
                'video/snapshot',
                `t_${timeInMs}`, // 截图时间（毫秒）
                `f_${format}`, // 输出格式
                width ? `w_${width}` : '', // 宽度
                height ? `h_${height}` : '', // 高度
                'm_fast', // 快速模式，截取最近关键帧
            ];

            // 添加可选参数
            if (format === 'jpg' && quality !== 90) {
                processParams.push(`q_${quality}`); // JPG质量参数
            }
            // 过滤掉空的参数
            const filteredParams = processParams.filter(
                (param) => param && param.trim() !== '',
            );

            const process = filteredParams.join(',');
            console.log('process', process);

            // 生成截图文件名
            const snapshotKey = this.generateSnapshotKey(key, time, format);
            console.log('snapshotKey', snapshotKey);

            // 使用 ali-oss 直接处理，而不是构建URL
            const result = await this.executeOssProcessWithClient(
                vendor,
                bucket,
                key,
                process,
                snapshotKey,
            );

            console.log('Snapshot generated successfully', {
                snapshotKey,
                process,
                time: timeInMs,
                format,
                dimensions: `${width}x${height}`,
                result: result,
            });

            // 返回处理后的文件路径，而不是URL
            return result?.res?.statusCode === 200 ? snapshotKey : '';
        } catch (error) {
            this.logger.error('Failed to generate snapshot', {
                vendor,
                bucket,
                key,
                options,
                error: error.message,
            });
            throw new Error(`Snapshot generation failed: ${error.message}`);
        }
    }

    /**
     * 验证截图参数
     */
    private validateSnapshotOptions(options: SnapshotOptions): void {
        const { time, width, height, format, quality } = options;

        // 验证时间格式
        if (time && !this.isValidTimeFormat(time)) {
            throw new Error(
                `Invalid time format: ${time}. Expected format: HH:mm:ss or HH:mm:ss.SSS`,
            );
        }

        // 验证尺寸
        if (width && (width < 0 || width > 4096)) {
            throw new Error(
                `Invalid width: ${width}. Must be between 0 and 4096`,
            );
        }
        if (height && (height < 0 || height > 4096)) {
            throw new Error(
                `Invalid height: ${height}. Must be between 0 and 4096`,
            );
        }

        // 验证格式
        if (format && !['jpg', 'png'].includes(format)) {
            throw new Error(
                `Invalid format: ${format}. Supported formats: jpg, png`,
            );
        }

        // 验证质量（仅JPG格式）
        if (format === 'jpg' && quality && (quality < 1 || quality > 100)) {
            throw new Error(
                `Invalid quality: ${quality}. Must be between 1 and 100`,
            );
        }
    }

    /**
     * 验证时间格式
     */
    private isValidTimeFormat(time: string): boolean {
        // 支持格式：HH:mm:ss 或 HH:mm:ss.SSS
        const timeRegex = /^(\d{2}):(\d{2}):(\d{2})(\.\d{3})?$/;
        if (!timeRegex.test(time)) {
            return false;
        }

        const [, hours, minutes, seconds] = time.match(timeRegex);
        const h = parseInt(hours, 10);
        const m = parseInt(minutes, 10);
        const s = parseInt(seconds, 10);

        return h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59;
    }

    /**
     * 将时间格式转换为毫秒
     */
    private convertTimeToMilliseconds(time: string): number {
        const timeRegex = /^(\d{2}):(\d{2}):(\d{2})(\.\d{3})?$/;
        const match = time.match(timeRegex);

        if (!match) {
            throw new Error(`Invalid time format: ${time}`);
        }

        const [, hours, minutes, seconds, milliseconds] = match;
        const h = parseInt(hours, 10);
        const m = parseInt(minutes, 10);
        const s = parseInt(seconds, 10);
        const ms = milliseconds ? parseInt(milliseconds.slice(1), 10) : 0;

        return (h * 3600 + m * 60 + s) * 1000 + ms;
    }

    /**
     * 生成截图文件名
     */
    private generateSnapshotKey(
        originalKey: string,
        time: string,
        format: string,
    ): string {
        const pathParts = originalKey.split('/');
        const fileName = pathParts.pop() || '';
        const basePath = pathParts.join('/');

        // 移除原文件扩展名
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

        // 清理时间字符串，移除冒号和点号
        const cleanTime = time.replace(/[:.]/g, '');

        // 生成截图文件名
        const snapshotFileName = `${nameWithoutExt}_snapshot_${cleanTime}.${format}`;

        return basePath ? `${basePath}/${snapshotFileName}` : snapshotFileName;
    }

    /**
     * 获取视频头图（第一帧）
     */
    async getVideoThumbnail(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options: Partial<SnapshotOptions> = {},
    ): Promise<string> {
        const defaultOptions: SnapshotOptions = {
            time: '00:00:00',
            format: 'jpg',
            quality: 85,
        };

        return this.takeSnapshot(vendor, bucket, key, {
            ...defaultOptions,
            ...options,
        });
    }
    /**
     * 批量截图 - 按时间间隔截取多个帧
     */
    async takeMultipleSnapshots(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options: {
            startTime?: string;
            endTime?: string;
            interval?: number; // 间隔秒数
            count?: number; // 截图数量
            width?: number;
            height?: number;
            format?: string;
            quality?: number;
        } = {},
    ): Promise<string[]> {
        const {
            startTime = '00:00:00',
            endTime = '00:01:00', // 默认1分钟
            interval = 5, // 默认5秒间隔
            count = 12, // 默认12张
            width = 640,
            height = 360,
            format = 'jpg',
            quality = 85,
        } = options;

        try {
            const startMs = this.convertTimeToMilliseconds(startTime);
            const endMs = this.convertTimeToMilliseconds(endTime);

            if (startMs >= endMs) {
                throw new Error('Start time must be less than end time');
            }

            const duration = endMs - startMs;
            const actualInterval = Math.max(interval * 1000, duration / count);
            const actualCount = Math.min(
                count,
                Math.floor(duration / actualInterval),
            );

            const snapshotUrls: string[] = [];
            const snapshotOptions: SnapshotOptions = {
                width,
                height,
                format,
                quality,
            };

            for (let i = 0; i < actualCount; i++) {
                const timeMs = startMs + i * actualInterval;
                const timeStr = this.convertMillisecondsToTime(timeMs);

                const url = await this.takeSnapshot(vendor, bucket, key, {
                    ...snapshotOptions,
                    time: timeStr,
                });

                snapshotUrls.push(url);
            }

            this.logger.info('Multiple snapshots generated', {
                vendor,
                bucket,
                key,
                count: actualCount,
                interval: actualInterval / 1000,
                timeRange: `${startTime} - ${endTime}`,
            });

            return snapshotUrls;
        } catch (error) {
            this.logger.error('Failed to generate multiple snapshots', {
                vendor,
                bucket,
                key,
                options,
                error: error.message,
            });
            throw new Error(
                `Multiple snapshots generation failed: ${error.message}`,
            );
        }
    }

    /**
     * 将毫秒转换为时间格式
     */
    private convertMillisecondsToTime(ms: number): string {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const milliseconds = ms % 1000;

        const timeStr = [
            hours.toString().padStart(2, '0'),
            minutes.toString().padStart(2, '0'),
            seconds.toString().padStart(2, '0'),
        ].join(':');

        return milliseconds > 0
            ? `${timeStr}.${milliseconds.toString().padStart(3, '0')}`
            : timeStr;
    }

    /**
     * 从视频中提取音频（使用 IMM 服务）
     */
    async extractAudioFromVideo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options?: AudioExtractOptions,
    ): Promise<MediaConvertTaskResult> {
        try {
            this.logger.info('Extracting audio from video using IMM service', {
                vendor,
                bucket,
                key,
                options,
            });

            // 使用 IMM 服务提取音频
            const result = await this.aliyunImm.extractAudioFromVideo(
                vendor,
                bucket,
                key,
                options,
            );

            this.logger.info('Audio extract task created successfully', {
                taskId: result.taskId,
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to extract audio from video', {
                vendor,
                bucket,
                key,
                options,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * 查询转码任务状态（使用 IMM 服务）
     */
    async getTranscodeTaskStatus(
        vendor: FileBucketVendor,
        bucket: string,
        taskId: string,
    ): Promise<{
        status: string;
        progress?: number;
        result?: any;
        error?: string;
    }> {
        try {
            this.logger.info(
                'Querying transcode task status using IMM service',
                { taskId },
            );

            // 使用 IMM 服务获取任务状态
            const status = await this.aliyunImm.getTask(vendor, bucket, taskId);

            this.logger.info('Task status retrieved successfully using IMM', {
                taskId,
                status: status.status,
                progress: status.progress,
            });

            return status;
        } catch (error) {
            this.logger.error('Failed to get transcode task status using IMM', {
                taskId,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * 取消转码任务
     */
    async cancelTranscodeTask(
        vendor: FileBucketVendor,
        taskId: string,
    ): Promise<boolean> {
        try {
            this.logger.info('Cancelling transcode task', { taskId });

            // 实际实现需要调用 IMM 的取消任务接口
            // const response = await this.immClient.cancelTask(taskId);

            return true;
        } catch (error) {
            this.logger.error('Failed to cancel transcode task', {
                taskId,
                error: error.message,
            });
            return false;
        }
    }

    /**
     * 验证雪碧图参数
     */
    private validateSpriteOptions(options: SpriteOptions): void {
        const {
            width,
            height,
            interval,
            columns,
            lines,
            startTime,
            format,
            scaleType,
            padding,
            margin,
            maxFrames,
            percentWidth,
            percentHeight,
        } = options;

        // 验证尺寸
        if (width && (width < 0 || width > 4096)) {
            throw new Error(
                `Invalid width: ${width}. Must be between 0 and 4096`,
            );
        }
        if (height && (height < 0 || height > 4096)) {
            throw new Error(
                `Invalid height: ${height}. Must be between 0 and 4096`,
            );
        }

        // 验证间隔
        if (interval && (interval < 0 || interval > 3600)) {
            // 最大间隔1小时
            throw new Error(
                `Invalid interval: ${interval}. Must be between 0 and 3600`,
            );
        }

        // 验证布局
        if (columns && (columns < 0 || columns > 100)) {
            // 最大列数100
            throw new Error(
                `Invalid columns: ${columns}. Must be between 0 and 100`,
            );
        }
        if (lines && (lines < 0 || lines > 100)) {
            // 最大行数100
            throw new Error(
                `Invalid lines: ${lines}. Must be between 0 and 100`,
            );
        }

        // 验证缩放方式
        if (
            scaleType &&
            !['crop', 'stretch', 'fill', 'fit'].includes(scaleType)
        ) {
            throw new Error(
                `Invalid scaleType: ${scaleType}. Supported: crop, stretch, fill, fit`,
            );
        }

        // 验证百分比尺寸
        if (percentWidth && (percentWidth <= 0 || percentWidth > 200)) {
            throw new Error(
                `Invalid percentWidth: ${percentWidth}. Must be between 0 and 200`,
            );
        }
        if (percentHeight && (percentHeight <= 0 || percentHeight > 200)) {
            throw new Error(
                `Invalid percentHeight: ${percentHeight}. Must be between 0 and 200`,
            );
        }

        // 验证起始时间
        if (startTime && !this.isValidTimeFormat(startTime)) {
            throw new Error(
                `Invalid startTime: ${startTime}. Expected format: HH:mm:ss or HH:mm:ss.SSS`,
            );
        }

        // 验证格式
        if (format && !['jpg', 'png'].includes(format)) {
            throw new Error(
                `Invalid format: ${format}. Supported formats: jpg, png`,
            );
        }

        // 验证最大帧数
        if (maxFrames && (maxFrames <= 0 || maxFrames > 1000)) {
            // 最大帧数1000
            throw new Error(
                `Invalid maxFrames: ${maxFrames}. Must be between 0 and 1000`,
            );
        }
    }

    /**
     * 生成雪碧图文件名
     */
    private generateSpriteKey(
        originalKey: string,
        format: string,
        startTime: string,
    ): string {
        const pathParts = originalKey.split('/');
        const fileName = pathParts.pop() || '';
        const basePath = pathParts.join('/');

        // 移除原文件扩展名
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

        // 清理时间字符串，移除冒号和点号
        const cleanStartTime = startTime.replace(/[:.]/g, '');

        // 生成雪碧图文件名
        const spriteFileName = `${nameWithoutExt}_sprite_${cleanStartTime}.${format}`;

        return basePath ? `${basePath}/${spriteFileName}` : spriteFileName;
    }
}
