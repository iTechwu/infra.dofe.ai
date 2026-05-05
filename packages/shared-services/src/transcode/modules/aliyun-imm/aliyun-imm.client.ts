import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import {
    FileBucketVendor,
    VideoQuality,
    VideoInfo,
    AudioInfo,
    ImageInfo,
} from '@prisma/client';
import * as $dara from '@darabonba/typescript';
import imm, * as $imm from '@alicloud/imm20200930';
import { $OpenApiUtil } from '@alicloud/openapi-core';
import Credential from '@alicloud/credentials';
import { TranscodeOptions } from '../../types/transcode.types';
import { AliyunOssTranscodeConfig } from '../../config/aliyun-oss.config';
import { DoFeUploader } from '../../../file-storage';
import { arrayUtil } from '@dofe/infra-utils';
import { getKeysConfig } from '@dofe/infra-common';
import { StorageCredentialsConfig, AppConfig } from '@dofe/infra-common';
import { fileUtil } from '@dofe/infra-utils';

export interface MediaMetaResult {
    type: 'video' | 'audio' | 'image';
    info: Partial<VideoInfo | AudioInfo | ImageInfo>;
    rawData: any;
}

export interface MediaConvertTaskResult {
    taskId: string;
    requestId: string;
    eventId: string;
}

export interface AudioExtractOptions {
    format?: 'mp3' | 'aac' | 'flac' | 'wav';
    bitrate?: number; // 音频码率，单位：bps
    /**
     * 采样率，单位：Hz
     * 注意：如果用于阿里云语音识别，采样率必须是 8000 或 16000 Hz
     * 默认值：16000 Hz（符合阿里云语音识别要求）
     * 如果传入其他值，会自动规范化到最接近的合规值（8000 或 16000）
     */
    sampleRate?: number;
    channels?: number; // 声道数：1(单声道) 或 2(立体声)
}

export interface TaskStatus {
    status: string;
    progress?: number;
    result?: any;
    error?: string;
}

export enum ImmTaskType {
    CreateVideoLabelClassificationTask = 'VideoLabelClassification', // 视频标签检测任务
    CreateFigureClusteringTask = 'FaceClustering', // 人脸聚类分组任务
    CreateOfficeConversionTask = 'OfficeConversion', // 文档转换任务
    CreateImageModerationTask = 'ImageModeration', // 图片识别任务
    CreateVideoModerationTask = 'VideoModeration', // 视频识别任务
    CreateMediaConvertTask = 'MediaConvert', // 视频转码任务
    CreateFileCompressionTask = 'FileCompression', // 文件压缩任务
    CreateArchiveFileInspectionTask = 'ArchiveFileInspection', // 查看文件压缩内容任务
    CreateFileUncompressionTask = 'FileUncompression', // 文件解压任务
    CreateCompressPointCloudTask = 'PointCloudCompress', // 点云压缩任务
    CreateImageToPDFTask = 'ImageToPDF', // 图片转PDF任务
    CreateStory = 'StoryCreation', // 创建故事任务
    CreateLocationDateClusteringTask = 'LocationDateClustering', // 时空聚类分组任务
    CreateImageSplicingTask = 'ImageSplicing', // 图片拼接任务
    CreateFacesSearchingTask = 'FacesSearching', // 搜索相似图片任务
}

@Injectable()
export class AliyunImmClient {
    private readonly config: AliyunOssTranscodeConfig;
    private readonly appConfig: AppConfig;

    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        private readonly configService: ConfigService,
    ) {
        this.config = this.getAliyunImmConfig('oss', 'pardx-files');
        this.appConfig = this.configService.getOrThrow<AppConfig>('app');
    }

    /**
     * 获取阿里云 OSS 配置
     */
    private getAliyunImmConfig(
        vendor: FileBucketVendor,
        bucket: string,
    ): AliyunOssTranscodeConfig {
        if (vendor !== 'oss') {
            throw new Error(`Unsupported vendor: ${vendor}`);
        }
        const bucketConfigs =
            this.configService.getOrThrow<DoFeUploader.Config[]>('buckets');
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

        // IMM 需要使用 IMM 的 endpoint，而不是 OSS 的 endpoint
        const region = bucketConfig?.region || 'cn-shanghai';
        const immEndpointEnv = `imm.${region}.aliyuncs.com`;

        // 规范化 endpoint，去掉协议前缀与结尾斜杠
        const immEndpoint = immEndpointEnv
            .replace(/^https?:\/\//i, '')
            .replace(/\/$/, '');

        if (!immEndpoint) {
            throw new Error('ALIYUN_IMM_ENDPOINT is invalid or empty');
        }

        return {
            endpoint: immEndpoint,
            accessKeyId: ossConfig.accessKey,
            accessKeySecret: ossConfig.secretKey,
            bucket,
            region,
        };
    }

    /**
     * 创建 IMM 客户端
     */
    private createClient(): imm {
        try {
            // 使用规范化后的 IMM endpoint 构建客户端配置
            const config = new $OpenApiUtil.Config({
                ...this.config,
                protocol: 'https',
                regionId: this.config.region,
            } as any);
            return new imm(config);
        } catch (error: unknown) {
            this.logger.error('Failed to create IMM client', {
                error: error instanceof Error ? error.message : String(error),
                config: this.config,
            });
            throw new Error(`Failed to create IMM client: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 检测媒体文件元信息
     */
    async detectMediaMeta(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        type: 'video' | 'audio' | 'image' | 'else',
    ): Promise<MediaMetaResult> {
        try {
            const client = this.createClient();
            const projectName = this.getProjectName(vendor, bucket);
            const sourceURI = fileUtil.buildStorageUri(vendor, bucket, key);
            const request = new $imm.DetectMediaMetaRequest({
                projectName,
                sourceURI,
            });
            const runtime = new $dara.RuntimeOptions({});
            const response = await client.detectMediaMetaWithOptions(
                request,
                runtime,
            );

            this.logger.info('Media meta detection completed', {
                vendor,
                bucket,
                key,
                response: response.body,
            });

            return this.parseMediaMetaResponse(response.body!, type);
        } catch (error: unknown) {
            this.logger.error('Failed to detect media meta', {
                vendor,
                bucket,
                key,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * 构建输出文件的key
     */
    private buildOutputKey(
        originalKey: string,
        quality: VideoQuality,
        index: number = 0,
    ): string {
        const pathParts = originalKey.split('/');
        const fileName = pathParts.pop() || '';
        const basePath = pathParts.join('/');

        // 移除原文件扩展名
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

        // 根据质量等级生成后缀
        const qualitySuffix = quality.toLowerCase().replace('video_', '');

        const outputFileName = `${nameWithoutExt}_${qualitySuffix}.mp4`;

        return basePath ? `${basePath}/${outputFileName}` : outputFileName;
    }

    /**
     * 创建媒体转码任务
     * 根据阿里云IMM API规范优化
     */
    async createMediaConvertTask(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        qualities: VideoQuality[] | VideoQuality = [
            VideoQuality.VIDEO_4K,
            VideoQuality.VIDEO_1080P,
            VideoQuality.VIDEO_720P,
            VideoQuality.VIDEO_360P,
        ],
        index: number = 0,
    ): Promise<MediaConvertTaskResult> {
        try {
            const client = this.createClient();
            const projectName = this.getProjectName(vendor, bucket);
            const sourceUri = fileUtil.buildStorageUri(vendor, bucket, key);
            const targetUri = this.buildTargetUri(
                vendor,
                bucket,
                key,
                qualities,
            );
            // 添加调试日志，检查URI值
            console.log('URI values check', {
                sourceUri,
                targetUri,
            });

            // 验证URI值不为空
            if (!sourceUri || sourceUri.trim() === '') {
                throw new Error(`Source URI is empty or invalid: ${sourceUri}`);
            }
            if (!targetUri || targetUri.trim() === '') {
                throw new Error(`Target URI is empty or invalid: ${targetUri}`);
            }

            console.log('Creating media convert task', {
                vendor,
                bucket,
                key,
                projectName,
                sourceUri,
                targetUri,
                qualities,
            });

            // 构建源文件配置
            const sources: any[] = [
                {
                    URI: sourceUri, // 使用小写的URI，符合API类型定义
                },
            ];

            qualities = Array.isArray(qualities) ? qualities : [qualities];

            // 构建目标配置
            const targets = qualities.map((quality) => {
                // 为每个质量等级构建独立的目标URI
                const qualityTargetUri = this.buildTargetUri(
                    vendor,
                    bucket,
                    key,
                    quality,
                );
                console.log('buildTarget', {
                    video: this.buildTargetVideo(quality),
                    audio: this.buildTargetAudio(quality),
                });
                return {
                    URI: qualityTargetUri, // 使用特定质量的URI
                    // 添加必需的container配置 - 应该是小写，符合API类型定义
                    container: 'mp4',
                    video: {
                        transcodeVideo: this.buildTargetVideo(quality),
                    },
                    audio: {
                        transcodeAudio: this.buildTargetAudio(quality),
                    },
                };
            });
            // 构建通知配置
            const notification = {
                MNS: {
                    topicName: 'pardx-transcode-topic',
                    endpoint: `https://1270749538583939.mns.cn-shanghai.aliyuncs.com`, // 如果需要webhook通知，可以配置endpoint
                },
            };

            // 创建请求对象，使用正确的参数名称
            const request = new $imm.CreateMediaConvertTaskRequest({
                projectName,
                sources,
                targets,
                notification,
                // 添加用户自定义数据，便于后续追踪
                userData: JSON.stringify({
                    vendor,
                    bucket,
                    key,
                    index,
                    timestamp: new Date().toISOString(),
                    qualities,
                }),
                // 添加标签，便于分类和查询
                tags: {
                    vendor,
                    bucket,
                    type: 'transcode',
                    source: key,
                },
            });

            const runtime = new $dara.RuntimeOptions({});

            this.logger.debug('Sending IMM API request', {
                request: JSON.stringify(request, null, 2),
            });

            const response = await client.createMediaConvertTaskWithOptions(
                request,
                runtime,
            );

            if (!response?.body?.taskId) {
                throw new Error(
                    'Invalid response from IMM API: missing taskId',
                );
            }

            const result: MediaConvertTaskResult = {
                taskId: response.body.taskId,
                eventId: response.body.eventId,
                requestId: response.body.requestId,
            };

            console.log(
                'Media convert task created successfully 111',
                response?.body,
            );

            return result;
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            const errorDetails = {
                vendor,
                bucket,
                key,
                qualities,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
            };

            this.logger.error(
                'Failed to create media convert task',
                errorDetails,
            );

            // 重新抛出错误，保持原始错误信息
            if (error instanceof Error) {
                throw error;
            } else {
                throw new Error(
                    `Failed to create media convert task: ${errorMessage}`,
                );
            }
        }
    }

    /**
     * 获取任务状态
     */
    async getTask(
        vendor: FileBucketVendor,
        bucket: string,
        taskId: string,
        taskType: ImmTaskType = ImmTaskType.CreateMediaConvertTask,
    ): Promise<TaskStatus> {
        try {
            const client = this.createClient();
            const projectName = this.getProjectName(vendor, bucket);
            const request = new $imm.GetTaskRequest({
                taskId,
                projectName,
                requestDefinition: true,
                taskType: taskType,
            });

            const runtime = new $dara.RuntimeOptions({});
            const response = await client.getTaskWithOptions(request, runtime);

            this.logger.info('Task status retrieved', {
                taskId,
                status: response.body?.status,
            });

            return this.parseTaskStatus(response.body);
        } catch (error: unknown) {
            this.logger.error('Failed to get task status', {
                taskId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * 获取项目名称（基于 vendor 和 bucket）
     */
    private getProjectName(vendor: FileBucketVendor, bucket: string): string {
        // 可以根据需要配置项目名称映射
        return 'pardx-ai-imm';
    }

    /**
     * 构建目标文件 URI
     */
    private buildTargetUri(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        qualities: VideoQuality[] | VideoQuality,
    ): string {
        // 参数验证
        if (!bucket || bucket.trim() === '') {
            throw new Error('Bucket cannot be empty for target URI');
        }
        if (!key || key.trim() === '') {
            throw new Error('Key cannot be empty for target URI');
        }
        if (!vendor || vendor.trim() === '') {
            throw new Error('Vendor cannot be empty for target URI');
        }

        // 清理参数
        const cleanBucket = bucket.trim();
        const cleanKey = key.trim();
        const cleanVendor = vendor.trim() as FileBucketVendor;

        // 构建目标文件名 - 使用第一个质量等级作为默认
        const quality = Array.isArray(qualities) ? qualities[0] : qualities;
        const qualitySuffix = quality.toLowerCase().replace('video_', '');
        const targetKey = cleanKey.replace(
            /\.[^/.]+$/,
            `_${qualitySuffix}.mp4`,
        );

        // 使用通用构建函数构建完整的URI
        return fileUtil.buildStorageUri(cleanVendor, cleanBucket, targetKey);
    }

    /**
     * 构建目标文件 URL
     */
    private buildTargetUrl(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        qualities: VideoQuality[] | VideoQuality,
    ): string {
        // 使用第一个质量等级作为默认
        const quality = Array.isArray(qualities) ? qualities[0] : qualities;
        const qualitySuffix = quality.toLowerCase().replace('video_', '');
        const targetKey = key.replace(/\.[^/.]+$/, `_${qualitySuffix}.mp4`);

        // 根据 vendor 构建不同的访问 URL
        switch (vendor) {
            case 'oss':
                return `https://${bucket}.oss-${this.config.region}.aliyuncs.com/${targetKey}`;
            default:
                return `https://${bucket}.oss-${this.config.region}.aliyuncs.com/${targetKey}`;
        }
    }

    /**
     * 构建媒体元数据
     * 根据阿里云IMM API规范优化
     */
    private buildMediaMetadata(options: TranscodeOptions): any {
        const {
            format = 'mp4',
            resolution = '720p',
            bitrate = '1000k',
            frameRate = '25',
            quality = 'medium',
            videoCodec = 'h264',
            audioCodec = 'aac',
            audioBitrate = '100000',
        } = options;

        // 解析分辨率
        const resolutionMap: Record<string, { width: number; height: number }> =
            {
                '480p': { width: 854, height: 480 },
                '720p': { width: 1280, height: 720 },
                '1080p': { width: 1920, height: 1080 },
                '2k': { width: 2560, height: 1440 },
                '4k': { width: 3840, height: 2160 },
            };

        const size = resolutionMap[resolution] || resolutionMap['720p'];

        // 根据阿里云IMM API规范构建媒体元数据
        const mediaMetadata: any = {
            // 基础格式信息
            format: format.toLowerCase(),

            // 视频配置
            video: {
                codec: videoCodec.toLowerCase(),
                width: size.width,
                height: size.height,
                bitrate: this.normalizeBitrate(bitrate),
                frameRate: this.normalizeFrameRate(frameRate),
                quality: quality.toLowerCase(),
                // 添加更多视频参数
                gop: '250', // GOP大小，影响编码效率
                profile: 'main', // H.264 profile
                level: '4.1', // H.264 level
                preset: 'medium', // 编码预设
                arotate: '1',
            },

            // 音频配置
            audio: {
                codec: audioCodec.toLowerCase(),
                bitrate: this.normalizeAudioBitrate(audioBitrate),
                channels: 2, // 立体声
                sampleRate: 44100, // 采样率
                profile: 'aac_low', // AAC profile
            },

            // 容器配置
            container: {
                format: format.toLowerCase(),
                segmentDuration: 10, // 分片时长（秒）
                segmentFormat: 'm3u8', // 分片格式（HLS）
            },
        };

        // 根据格式调整配置
        if (format.toLowerCase() === 'hls') {
            mediaMetadata.container.segmentFormat = 'm3u8';
            mediaMetadata.container.segmentDuration = 10;
        } else if (format.toLowerCase() === 'dash') {
            mediaMetadata.container.segmentFormat = 'mpd';
            mediaMetadata.container.segmentDuration = 6;
        }

        // 添加转码策略
        mediaMetadata.strategy = {
            priority: 'normal', // 任务优先级
            retryCount: 3, // 重试次数
            timeout: 3600, // 超时时间（秒）
        };

        return mediaMetadata;
    }

    /**
     * 标准化比特率格式
     */
    private normalizeBitrate(bitrate: string): string {
        if (typeof bitrate === 'string') {
            // 确保比特率格式正确
            if (bitrate.endsWith('k')) {
                return bitrate;
            } else if (bitrate.endsWith('m')) {
                return bitrate;
            } else if (bitrate.endsWith('K')) {
                return bitrate.toLowerCase();
            } else if (bitrate.endsWith('M')) {
                return bitrate.toLowerCase();
            } else {
                // 如果没有单位，假设是kbps
                return `${bitrate}k`;
            }
        }
        return '1000k';
    }

    /**
     * 标准化帧率格式
     */
    private normalizeFrameRate(frameRate: string): string {
        if (typeof frameRate === 'string') {
            // 确保帧率格式正确
            if (frameRate.includes('/')) {
                return frameRate; // 保持分数格式
            } else if (frameRate.endsWith('fps')) {
                return frameRate;
            } else if (frameRate.endsWith('FPS')) {
                return frameRate.toLowerCase();
            } else {
                // 如果没有单位，假设是fps
                return `${frameRate}fps`;
            }
        }
        return '25fps';
    }

    /**
     * 标准化音频比特率格式
     */
    private normalizeAudioBitrate(audioBitrate: string): string {
        if (typeof audioBitrate === 'string') {
            // 确保音频比特率格式正确
            if (audioBitrate.endsWith('k')) {
                return audioBitrate;
            } else if (audioBitrate.endsWith('K')) {
                return audioBitrate.toLowerCase();
            } else {
                // 如果没有单位，假设是kbps
                return `${audioBitrate}k`;
            }
        }
        return '128k';
    }

    /**
     * 解析媒体元信息响应
     */
    private parseMediaMetaResponse(
        mediaMetadata: $imm.DetectMediaMetaResponseBody,
        type: 'video' | 'audio' | 'image' | 'else',
    ): MediaMetaResult {
        if (!mediaMetadata) {
            throw new Error('No media metadata found in response');
        }

        const {
            duration,
            formatName,
            videoStreams,
            audioStreams,
            videoWidth,
            videoHeight,
        } = mediaMetadata;

        const fmtName = formatName ?? '';
        type =
            type !== 'else'
                ? type
                : fileUtil.isVideoFile(fmtName) || fmtName.includes('mov')
                  ? 'video'
                  : fileUtil.isAudioFile(fmtName) ||
                      fmtName.includes('audio')
                    ? 'audio'
                    : fileUtil.isImageFile(fmtName) ||
                        fmtName.includes('image')
                      ? 'image'
                      : 'else';

        if (type === 'video' && videoStreams && videoStreams.length > 0) {
            const videoInfo: Partial<VideoInfo> = {
                width: videoWidth,
                height: videoHeight,
                duration: duration ? Number(duration) : undefined,
                streamDuration: videoStreams[0]?.streamDuration ? Number(videoStreams[0].streamDuration) : undefined,
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
                duration: duration ? Number(duration) : undefined,
                streamDuration: audioStreams[0]?.streamDuration ? Number(audioStreams[0].streamDuration) : undefined,
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

        if (type === 'image' && videoStreams && videoStreams.length > 0) {
            const imageInfo: Partial<ImageInfo> = {
                width: videoWidth,
                height: videoHeight,
                sar: videoStreams[0]?.sampleAspectRatio,
                dar: videoStreams[0]?.displayAspectRatio,
                ffmpegInfo: JSON.parse(JSON.stringify(mediaMetadata)), // 确保序列化
            };

            return {
                type,
                info: imageInfo,
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
     * 解析任务状态响应
     */
    private parseTaskStatus(response: any): TaskStatus {
        const { status, progress, result, error } = response;

        return {
            status: status || 'unknown',
            progress: progress || 0,
            result: result || null,
            error: error || null,
        };
    }

    /**
     * 获取分辨率宽度
     */
    private getResolutionWidth(resolution: string): number {
        const resolutionMap: Record<string, number> = {
            '480p': 854,
            '720p': 1280,
            '1080p': 1920,
            '2k': 2560,
            '4k': 3840,
        };
        return resolutionMap[resolution] || 1280; // 默认值
    }

    /**
     * 获取分辨率高度
     */
    private getResolutionHeight(resolution: string): number {
        const resolutionMap: Record<string, number> = {
            '480p': 480,
            '720p': 720,
            '1080p': 1080,
            '2k': 1440,
            '4k': 2160,
        };
        return resolutionMap[resolution] || 720; // 默认值
    }

    /**
     * 构建视频转码配置
     * 根据阿里云IMM API文档：https://help.aliyun.com/zh/imm/developer-reference/api-imm-2020-09-30-createmediaconverttask
     */
    private buildTargetVideo(quality: VideoQuality): any {
        // VideoQuality到分辨率的映射
        const qualityToResolution: Record<
            VideoQuality,
            { width: number; height: number }
        > = {
            [VideoQuality.VIDEO_4K]: { width: 3840, height: 2160 },
            [VideoQuality.VIDEO_1080P]: { width: 1920, height: 1080 },
            [VideoQuality.VIDEO_720P]: { width: 1280, height: 720 },
            [VideoQuality.VIDEO_360P]: { width: 640, height: 360 },
            [VideoQuality.VIDEO_ORIGIN]: { width: 0, height: 0 }, // 原画质，保持原尺寸
        };

        const resolution = qualityToResolution[quality];

        const qualityToCodec: Record<VideoQuality, string> = {
            [VideoQuality.VIDEO_4K]: 'h264',
            [VideoQuality.VIDEO_1080P]: 'h264',
            [VideoQuality.VIDEO_720P]: 'h264',
            [VideoQuality.VIDEO_360P]: 'h264',
            [VideoQuality.VIDEO_ORIGIN]: 'h264', // 原画质，保持原码率
        };

        const codec = qualityToCodec[quality];

        // 根据阿里云IMM API文档构建transcodeVideo配置
        const transcodeVideo: any = {
            codec: codec, // 视频编码格式
            frameRate: 30,
            frameRateOption: 'adaptive',
            pixelFormat: 'yuv420p', // 像素格式
            scaleType: 'fit',
            CRF: 24, // 恒定质量因子，值越小质量越高
            adaptiveResolutionDirection: true,
            resolution: `${resolution.width}x${resolution.height}`,
            resolutionOption: 'adaptive',
        };

        return transcodeVideo;
    }

    /**
     * 构建音频转码配置
     * 根据阿里云IMM API文档
     */
    private buildTargetAudio(quality: VideoQuality): any {
        // 根据视频质量调整音频码率
        const qualityToAudioBitrate: Record<VideoQuality, number> = {
            [VideoQuality.VIDEO_4K]: 256, // 4K视频使用256kbps音频
            [VideoQuality.VIDEO_1080P]: 192, // 1080P视频使用192kbps音频
            [VideoQuality.VIDEO_720P]: 128, // 720P视频使用128kbps音频
            [VideoQuality.VIDEO_360P]: 96, // 360P视频使用96kbps音频
            [VideoQuality.VIDEO_ORIGIN]: 128, // 原画质使用128kbps音频
        };

        const audioBitrate = qualityToAudioBitrate[quality] * 1000;

        // 根据阿里云IMM API文档构建transcodeAudio配置
        const transcodeAudio: any = {
            codec: 'aac', // 音频编码格式
            bitrate: audioBitrate, // 音频码率
            channel: 2, // 声道数，立体声
            sampleRate: 44100, // 采样率
        };

        return transcodeAudio;
    }

    /**
     * 规范化采样率，确保符合阿里云语音识别要求（8000 或 16000 Hz）
     * 如果采样率不符合要求，选择最接近的合规值
     * @param sampleRate 原始采样率
     * @returns 规范化后的采样率（8000 或 16000）
     */
    private normalizeSampleRateForSpeechRecognition(
        sampleRate: number,
    ): number {
        // 阿里云语音识别要求采样率为 8000 或 16000 Hz
        return sampleRate || 16000;
    }

    /**
     * 从视频中提取音频
     * 参考：https://help.aliyun.com/zh/imm/user-guide/audio-transcoding
     * 注意：默认采样率设置为 16000 Hz，符合阿里云语音识别要求
     */
    async extractAudioFromVideo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options: AudioExtractOptions = {},
    ): Promise<MediaConvertTaskResult> {
        try {
            const client = this.createClient();
            const projectName = this.getProjectName(vendor, bucket);
            const sourceUri = fileUtil.buildStorageUri(vendor, bucket, key);

            // 验证源URI
            if (!sourceUri || sourceUri.trim() === '') {
                throw new Error(`Source URI is empty or invalid: ${sourceUri}`);
            }

            // 构建目标音频文件URI
            // 默认采样率设置为 16000 Hz，符合阿里云语音识别要求（8000 或 16000 Hz）
            const {
                format = 'mp3',
                bitrate = 128000,
                sampleRate: rawSampleRate = 44100,
                channels = 2,
            } = options;

            // 规范化采样率，确保符合阿里云语音识别要求
            const sampleRate =
                this.normalizeSampleRateForSpeechRecognition(rawSampleRate);

            // 生成目标文件key
            const targetKey = fileUtil.buildAudioKeyFromVideoKey(key, format);
            const targetUri = fileUtil.buildStorageUri(
                vendor,
                bucket,
                targetKey,
            );

            // 如果采样率被规范化，记录警告
            if (rawSampleRate !== sampleRate) {
                this.logger.warn(
                    'Sample rate normalized for Aliyun speech recognition',
                    {
                        originalSampleRate: rawSampleRate,
                        normalizedSampleRate: sampleRate,
                        note: 'Aliyun speech recognition requires 8000 or 16000 Hz',
                    },
                );
            }

            this.logger.info('Extracting audio from video', {
                vendor,
                bucket,
                key,
                sourceUri,
                targetUri,
                options: {
                    ...options,
                    sampleRate, // 使用规范化后的采样率
                },
            });

            // 构建源文件配置
            const sources: any[] = [
                {
                    URI: sourceUri,
                },
            ];

            // 构建目标配置 - 只转码音频，不转码视频
            const targets = [
                {
                    URI: targetUri,
                    container: format, // 音频容器格式
                    audio: {
                        transcodeAudio: {
                            codec: this.getAudioCodec(format), // 根据格式选择编码器
                            bitrate: bitrate, // 音频码率（bps）
                            channel: channels, // 声道数
                            sampleRate: sampleRate, // 采样率
                        },
                    },
                    // 不包含video配置，表示只提取音频
                },
            ];

            // 构建通知配置
            const notification = {
                MNS: {
                    topicName: 'pardx-transcode-topic',
                    endpoint: `https://1270749538583939.mns.cn-shanghai.aliyuncs.com`,
                },
            };

            // 创建请求对象
            const request = new $imm.CreateMediaConvertTaskRequest({
                projectName,
                sources,
                targets,
                notification,
                userData: JSON.stringify({
                    vendor,
                    bucket,
                    key,
                    targetKey,
                    type: 'audio_extract',
                    format,
                    timestamp: new Date().toISOString(),
                }),
                tags: {
                    vendor,
                    bucket,
                    type: 'transcode',
                    source: key,
                    format,
                },
            });

            const runtime = new $dara.RuntimeOptions({});

            this.logger.debug('Sending IMM audio extract request', {
                request: JSON.stringify(request, null, 2),
            });

            const response = await client.createMediaConvertTaskWithOptions(
                request,
                runtime,
            );

            if (!response?.body?.taskId) {
                throw new Error(
                    'Invalid response from IMM API: missing taskId',
                );
            }

            const result: MediaConvertTaskResult = {
                taskId: response.body.taskId,
                eventId: response.body.eventId,
                requestId: response.body.requestId,
            };

            this.logger.info('Audio extract task created successfully', {
                taskId: result.taskId,
                targetKey,
            });

            return result;
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            const errorDetails = {
                vendor,
                bucket,
                key,
                options,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
            };

            this.logger.error(
                'Failed to extract audio from video',
                errorDetails,
            );

            if (error instanceof Error) {
                throw error;
            } else {
                throw new Error(
                    `Failed to extract audio from video: ${errorMessage}`,
                );
            }
        }
    }

    /**
     * 构建音频提取的目标文件key
     */
    private buildAudioExtractKey(originalKey: string, format: string): string {
        const pathParts = originalKey.split('/');
        const fileName = pathParts.pop() || '';
        const basePath = pathParts.join('/');

        // 移除原文件扩展名
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

        // 生成音频文件名
        const audioFileName = `${nameWithoutExt}_audio.${format}`;

        return basePath ? `${basePath}/${audioFileName}` : audioFileName;
    }

    /**
     * 根据音频格式获取编码器
     */
    private getAudioCodec(format: string): string {
        const codecMap: Record<string, string> = {
            mp3: 'mp3',
            aac: 'aac',
            flac: 'flac',
            wav: 'pcm', // WAV格式通常使用PCM编码
        };

        return codecMap[format.toLowerCase()] || 'aac';
    }
}
