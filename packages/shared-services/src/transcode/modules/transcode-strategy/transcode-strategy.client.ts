import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import {
    FileBucketVendor,
    VideoQuality,
    VideoInfo,
    AudioInfo,
    ImageInfo,
} from '@prisma/client';
import { AliyunOssTranscodeClient } from '../aliyun-oss/aliyun-oss-transcode.client';
import {
    AliyunImmClient,
    MediaConvertTaskResult,
    AudioExtractOptions,
} from '../aliyun-imm/aliyun-imm.client';
import { VolcengineTosTranscodeClient } from '../volcengine-tos/volcengine-tos-transcode.client';
import {
    TranscodeOptions,
    SpriteOptions,
    SnapshotOptions,
    TranscodeResult,
    BatchProcessResult,
} from '../../types/transcode.types';

// 转码策略接口 - 与types文件保持一致
export interface TranscodeStrategy {
    getVideoInfo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        type?: 'oss' | 'imm',
    ): Promise<Partial<VideoInfo> & any>;
    getAudioInfo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        type?: 'oss' | 'imm',
    ): Promise<Partial<AudioInfo> & any>;
    getImageInfo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        type?: 'oss' | 'imm',
    ): Promise<Partial<ImageInfo> & any>;
    transcodeVideo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        quality?: VideoQuality[],
        index?: number,
    ): Promise<MediaConvertTaskResult>;
    extractAudioFromVideo?(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options?: AudioExtractOptions,
    ): Promise<MediaConvertTaskResult>;
    generateSprite?(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options?: SpriteOptions,
    ): Promise<string | null>;
    takeSnapshot(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options?: SnapshotOptions,
    ): Promise<string>;
    getVideoThumbnail(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
    ): Promise<string>;
    getTranscodeTaskStatus?(
        vendor: FileBucketVendor,
        bucket: string,
        taskId: string,
    ): Promise<{
        status: string;
        progress?: number;
        result?: any;
        error?: string;
    }>;
    cancelTranscodeTask?(
        vendor: FileBucketVendor,
        taskId: string,
    ): Promise<boolean>;
}

// 策略配置接口
export interface StrategyConfig {
    vendor: FileBucketVendor;
    priority: number;
    fallback?: boolean;
    ossEnabled?: boolean;
    immEnabled?: boolean;
}

@Injectable()
export class TranscodeStrategyClient {
    private readonly strategyConfigs: Map<FileBucketVendor, StrategyConfig> =
        new Map();

    constructor(
        private readonly aliyunOssTranscode: AliyunOssTranscodeClient,
        private readonly aliyunImm: AliyunImmClient,
        private readonly volcengineTosTranscode: VolcengineTosTranscodeClient,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {
        // 初始化策略配置
        this.initializeStrategyConfigs();
    }

    /**
     * 初始化策略配置
     */
    private initializeStrategyConfigs(): void {
        this.strategyConfigs.set('oss', {
            vendor: 'oss',
            priority: 1,
            fallback: true,
            ossEnabled: true,
            immEnabled: true,
        });

        this.strategyConfigs.set('us3', {
            vendor: 'us3',
            priority: 2,
            fallback: true,
            ossEnabled: false,
            immEnabled: true,
        });

        this.strategyConfigs.set('qiniu', {
            vendor: 'qiniu',
            priority: 3,
            fallback: true,
            ossEnabled: false,
            immEnabled: true,
        });

        this.strategyConfigs.set('s3', {
            vendor: 's3',
            priority: 4,
            fallback: true,
            ossEnabled: false,
            immEnabled: true,
        });

        this.strategyConfigs.set('gcs', {
            vendor: 'gcs',
            priority: 5,
            fallback: true,
            ossEnabled: false,
            immEnabled: true,
        });

        this.strategyConfigs.set('tos', {
            vendor: 'tos',
            priority: 6,
            fallback: true,
            ossEnabled: false,
            immEnabled: true,
        });
    }

    /**
     * 根据 vendor 选择转码策略
     */
    private getStrategy(vendor: FileBucketVendor): TranscodeStrategy {
        const config = this.strategyConfigs.get(vendor);
        if (!config) {
            throw new Error(`Unsupported vendor: ${vendor}`);
        }

        // 对于OSS，使用OSS转码服务（内部使用IMM）
        if (vendor === 'oss') {
            return this.aliyunOssTranscode;
        }

        // 对于TOS，使用火山引擎转码服务
        if (vendor === 'tos') {
            return this.volcengineTosTranscode;
        }

        // 对于其他vendor，使用IMM服务（通过适配器）
        return this.createImmStrategyAdapter();
    }

    /**
     * 创建IMM策略适配器
     */
    private createImmStrategyAdapter(): TranscodeStrategy {
        const immClient = this.aliyunImm;
        return {
            async getVideoInfo(
                vendor: FileBucketVendor,
                bucket: string,
                key: string,
                type?: 'oss' | 'imm',
            ): Promise<Partial<VideoInfo> & any> {
                // IMM服务只支持imm类型
                if (type === 'oss') {
                    throw new Error(
                        'IMM service does not support OSS processing',
                    );
                }
                const result = await immClient.detectMediaMeta(
                    vendor,
                    bucket,
                    key,
                    'video',
                );
                return result.info as Partial<VideoInfo> & any;
            },

            async getAudioInfo(
                vendor: FileBucketVendor,
                bucket: string,
                key: string,
                type?: 'oss' | 'imm',
            ): Promise<Partial<AudioInfo> & any> {
                if (type === 'oss') {
                    throw new Error(
                        'IMM service does not support OSS processing',
                    );
                }
                const result = await immClient.detectMediaMeta(
                    vendor,
                    bucket,
                    key,
                    'audio',
                );
                return result.info as Partial<AudioInfo> & any;
            },

            async getImageInfo(
                vendor: FileBucketVendor,
                bucket: string,
                key: string,
                type?: 'oss' | 'imm',
            ): Promise<Partial<ImageInfo> & any> {
                if (type === 'oss') {
                    throw new Error(
                        'IMM service does not support OSS processing',
                    );
                }
                const result = await immClient.detectMediaMeta(
                    vendor,
                    bucket,
                    key,
                    'image',
                );
                return result.info as Partial<ImageInfo> & any;
            },

            async transcodeVideo(
                vendor: FileBucketVendor,
                bucket: string,
                key: string,
                quality?: VideoQuality[],
                index: number = 0,
            ): Promise<MediaConvertTaskResult> {
                return immClient.createMediaConvertTask(
                    vendor,
                    bucket,
                    key,
                    quality,
                    index,
                );
            },

            async generateSprite(
                vendor: FileBucketVendor,
                bucket: string,
                key: string,
                options?: any,
            ): Promise<string | null> {
                // IMM服务暂不支持雪碧图生成，返回 null
                return null;
            },

            async takeSnapshot(
                vendor: FileBucketVendor,
                bucket: string,
                key: string,
                options?: any,
            ): Promise<string> {
                // IMM服务暂不支持快照截取
                throw new Error(
                    'Snapshot capture not supported by IMM service',
                );
            },

            async getVideoThumbnail(
                vendor: FileBucketVendor,
                bucket: string,
                key: string,
            ): Promise<string> {
                // IMM服务暂不支持缩略图生成
                throw new Error(
                    'Thumbnail generation not supported by IMM service',
                );
            },

            async extractAudioFromVideo(
                vendor: FileBucketVendor,
                bucket: string,
                key: string,
                options?: AudioExtractOptions,
            ): Promise<MediaConvertTaskResult> {
                return immClient.extractAudioFromVideo(
                    vendor,
                    bucket,
                    key,
                    options,
                );
            },

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
                return immClient.getTask(vendor, bucket, taskId);
            },

            async cancelTranscodeTask(
                vendor: FileBucketVendor,
                taskId: string,
            ): Promise<boolean> {
                // IMM服务暂不支持任务取消
                return false;
            },
        };
    }

    /**
     * 智能选择处理方式（统一使用 IMM）
     */
    private async selectProcessingMethod(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        type?: 'oss' | 'imm',
    ): Promise<'oss' | 'imm'> {
        // 如果明确指定了类型，直接返回（但建议使用 imm）
        if (type) {
            // 如果指定了 oss，给出警告但仍然返回
            if (type === 'oss') {
                this.logger.warn(
                    'OSS processing is deprecated, all processing now uses IMM',
                    {
                        vendor,
                        bucket,
                        key,
                    },
                );
            }
            return type;
        }

        // 默认统一使用 IMM 处理
        return 'imm';
    }

    /**
     * 获取视频信息
     */
    async getVideoInfo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        type?: 'oss' | 'imm',
    ): Promise<Partial<VideoInfo> & any> {
        try {
            const processingType = await this.selectProcessingMethod(
                vendor,
                bucket,
                key,
                type,
            );
            const strategy = this.getStrategy(vendor);

            this.logger.info('Getting video info', {
                vendor,
                bucket,
                key,
                processingType,
                strategy: strategy.constructor.name,
            });

            return await strategy.getVideoInfo(
                vendor,
                bucket,
                key,
                processingType,
            );
        } catch (error: unknown) {
            this.logger.error('Failed to get video info', {
                vendor,
                bucket,
                key,
                type,
                error: (error instanceof Error ? error.message : String(error)),
            });
            throw error;
        }
    }

    /**
     * 获取音频信息
     */
    async getAudioInfo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        type?: 'oss' | 'imm',
    ): Promise<Partial<AudioInfo> & any> {
        try {
            const processingType = await this.selectProcessingMethod(
                vendor,
                bucket,
                key,
                type,
            );
            const strategy = this.getStrategy(vendor);

            this.logger.info('Getting audio info', {
                vendor,
                bucket,
                key,
                processingType,
                strategy: strategy.constructor.name,
            });

            return await strategy.getAudioInfo(
                vendor,
                bucket,
                key,
                processingType,
            );
        } catch (error: unknown) {
            this.logger.error('Failed to get audio info', {
                vendor,
                bucket,
                key,
                type,
                error: (error instanceof Error ? error.message : String(error)),
            });
            throw error;
        }
    }

    /**
     * 获取图片信息
     */
    async getImageInfo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        type?: 'oss' | 'imm',
    ): Promise<Partial<ImageInfo> & any> {
        try {
            const processingType = await this.selectProcessingMethod(
                vendor,
                bucket,
                key,
                type,
            );
            const strategy = this.getStrategy(vendor);

            this.logger.info('Getting image info', {
                vendor,
                bucket,
                key,
                processingType,
                strategy: strategy.constructor.name,
            });

            return await strategy.getImageInfo(
                vendor,
                bucket,
                key,
                processingType,
            );
        } catch (error: unknown) {
            this.logger.error('Failed to get image info', {
                vendor,
                bucket,
                key,
                type,
                error: (error instanceof Error ? error.message : String(error)),
            });
            throw error;
        }
    }

    /**
     * 视频转码
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
            const strategy = this.getStrategy(vendor);

            this.logger.info('Starting video transcode', {
                vendor,
                bucket,
                key,
                quality: quality[index],
                index,
                strategy: strategy.constructor.name,
            });

            return await strategy.transcodeVideo(
                vendor,
                bucket,
                key,
                quality,
                index,
            );
        } catch (error: unknown) {
            this.logger.error('Failed to transcode video', {
                vendor,
                bucket,
                key,
                quality: quality[index],
                index,
                error: (error instanceof Error ? error.message : String(error)),
            });
            throw error;
        }
    }

    /**
     * 从视频中提取音频
     */
    async extractAudioFromVideo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options?: AudioExtractOptions,
    ): Promise<MediaConvertTaskResult> {
        try {
            const strategy = this.getStrategy(vendor);

            if (!('extractAudioFromVideo' in strategy)) {
                throw new Error(
                    'Audio extraction not supported for this vendor',
                );
            }

            this.logger.info('Extracting audio from video', {
                vendor,
                bucket,
                key,
                options,
                strategy: strategy.constructor.name,
            });

            return await strategy.extractAudioFromVideo!(
                vendor,
                bucket,
                key,
                options,
            );
        } catch (error: unknown) {
            this.logger.error('Failed to extract audio from video', {
                vendor,
                bucket,
                key,
                options,
                error: (error instanceof Error ? error.message : String(error)),
            });
            throw error;
        }
    }

    /**
     * 生成视频雪碧图
     * 如果策略不支持雪碧图生成（如 TOS），则跳过处理并返回 null
     */
    async generateSprite(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options?: SpriteOptions,
    ): Promise<string | null> {
        try {
            // TOS 不支持雪碧图生成，直接跳过
            if (vendor === 'tos') {
                this.logger.info('Sprite generation skipped for TOS vendor', {
                    vendor,
                    bucket,
                    key,
                });
                return null;
            }

            const strategy = this.getStrategy(vendor);

            // 检查策略是否实现了 generateSprite 方法
            if (
                !('generateSprite' in strategy) ||
                typeof strategy.generateSprite !== 'function'
            ) {
                this.logger.info(
                    'Sprite generation not supported for this vendor',
                    {
                        vendor,
                        bucket,
                        key,
                        strategy: strategy.constructor.name,
                    },
                );
                return null;
            }

            this.logger.info('Generating video sprite', {
                vendor,
                bucket,
                key,
                options,
                strategy: strategy.constructor.name,
            });

            return await strategy.generateSprite(vendor, bucket, key, options);
        } catch (error: unknown) {
            this.logger.error('Failed to generate video sprite', {
                vendor,
                bucket,
                key,
                options,
                error: (error instanceof Error ? error.message : String(error)),
            });
            throw error;
        }
    }

    /**
     * 视频单帧截取
     */
    async takeSnapshot(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options?: SnapshotOptions,
    ): Promise<string> {
        try {
            const strategy = this.getStrategy(vendor);

            this.logger.info('Taking video snapshot', {
                vendor,
                bucket,
                key,
                options,
                strategy: strategy.constructor.name,
            });

            return await strategy.takeSnapshot(vendor, bucket, key, options);
        } catch (error: unknown) {
            this.logger.error('Failed to take video snapshot', {
                vendor,
                bucket,
                key,
                options,
                error: (error instanceof Error ? error.message : String(error)),
            });
            throw error;
        }
    }

    /**
     * 获取视频头图
     */
    async getVideoThumbnail(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
    ): Promise<string> {
        try {
            const strategy = this.getStrategy(vendor);

            this.logger.info('Getting video thumbnail', {
                vendor,
                bucket,
                key,
                strategy: strategy.constructor.name,
            });

            return await strategy.getVideoThumbnail(vendor, bucket, key);
        } catch (error: unknown) {
            this.logger.error('Failed to get video thumbnail', {
                vendor,
                bucket,
                key,
                error: (error instanceof Error ? error.message : String(error)),
            });
            throw error;
        }
    }

    /**
     * 查询转码任务状态
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
            const strategy = this.getStrategy(vendor);

            if ('getTranscodeTaskStatus' in strategy && strategy.getTranscodeTaskStatus) {
                return await strategy.getTranscodeTaskStatus(
                    vendor,
                    bucket,
                    taskId,
                );
            }

            this.logger.warn('Status query not supported for this vendor', {
                vendor,
                bucket,
                taskId,
                strategy: strategy.constructor.name,
            });

            // 默认返回未知状态
            return {
                status: 'unknown',
                progress: 0,
                result: null,
                error: 'Status query not supported for this vendor',
            };
        } catch (error: unknown) {
            this.logger.error('Failed to get transcode task status', {
                vendor,
                taskId,
                error: (error instanceof Error ? error.message : String(error)),
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
            const strategy = this.getStrategy(vendor);

            if ('cancelTranscodeTask' in strategy && strategy.cancelTranscodeTask) {
                return await strategy.cancelTranscodeTask(vendor, taskId);
            }

            this.logger.warn(
                'Task cancellation not supported for this vendor',
                {
                    vendor,
                    taskId,
                    strategy: strategy.constructor.name,
                },
            );

            // 默认返回失败
            return false;
        } catch (error: unknown) {
            this.logger.error('Failed to cancel transcode task', {
                vendor,
                taskId,
                error: (error instanceof Error ? error.message : String(error)),
            });
            throw error;
        }
    }

    /**
     * 批量处理媒体文件
     */
    async batchProcessMedia(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options?: {
            generateThumbnail?: boolean;
            generateSprite?: boolean;
            spriteOptions?: SpriteOptions;
            thumbnailOptions?: SnapshotOptions;
        },
    ): Promise<BatchProcessResult> {
        try {
            this.logger.info('Starting batch media processing', {
                vendor,
                bucket,
                key,
                options,
            });

            const result: BatchProcessResult = {
                videoInfo: {},
                thumbnail: '',
                sprite: null,
                success: false,
                errors: [],
            };

            // 获取视频信息
            try {
                result.videoInfo = await this.getVideoInfo(vendor, bucket, key);
            } catch (error: unknown) {
                result.errors?.push(
                    `Failed to get video info: ${(error instanceof Error ? error.message : String(error))}`,
                );
            }

            // 生成缩略图
            if (options?.generateThumbnail) {
                try {
                    result.thumbnail = await this.getVideoThumbnail(
                        vendor,
                        bucket,
                        key,
                    );
                } catch (error: unknown) {
                    result.errors?.push(
                        `Failed to generate thumbnail: ${(error instanceof Error ? error.message : String(error))}`,
                    );
                }
            }

            // 生成雪碧图
            if (options?.generateSprite) {
                try {
                    result.sprite = await this.generateSprite(
                        vendor,
                        bucket,
                        key,
                        options.spriteOptions,
                    );
                } catch (error: unknown) {
                    result.errors?.push(
                        `Failed to generate sprite: ${(error instanceof Error ? error.message : String(error))}`,
                    );
                }
            }

            // 判断是否成功
            result.success = (result.errors?.length ?? 0) === 0;

            this.logger.info('Batch media processing completed', {
                vendor,
                bucket,
                key,
                success: result.success,
                errorCount: result.errors?.length || 0,
            });

            return result;
        } catch (error: unknown) {
            this.logger.error('Failed to batch process media', {
                vendor,
                bucket,
                key,
                options,
                error: (error instanceof Error ? error.message : String(error)),
            });
            throw error;
        }
    }

    /**
     * 获取策略配置信息
     */
    getStrategyConfig(vendor: FileBucketVendor): StrategyConfig | undefined {
        return this.strategyConfigs.get(vendor);
    }

    /**
     * 更新策略配置
     */
    updateStrategyConfig(
        vendor: FileBucketVendor,
        config: Partial<StrategyConfig>,
    ): void {
        const existingConfig = this.strategyConfigs.get(vendor);
        if (existingConfig) {
            this.strategyConfigs.set(vendor, { ...existingConfig, ...config });
            this.logger.info('Strategy config updated', { vendor, config });
        }
    }
}
