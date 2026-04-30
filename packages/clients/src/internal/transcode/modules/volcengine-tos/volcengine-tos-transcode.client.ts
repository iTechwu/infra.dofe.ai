import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
    FileBucketVendor,
    VideoQuality,
    VideoInfo,
    AudioInfo,
    ImageInfo,
} from '@prisma/client';
import { getKeysConfig } from '@dofe/infra-common';
import { TranscodeConfig, AppConfig } from '@dofe/infra-common';
import { FileStorageService, PardxUploader } from '@dofe/infra-shared-services';
import { arrayUtil } from '@dofe/infra-utils';
import { fileUtil } from '@dofe/infra-utils';
import { Signer } from '@volcengine/openapi';
import {
    MediaConvertTaskResult,
    AudioExtractOptions,
} from '../aliyun-imm/aliyun-imm.client';
import { SpriteOptions, SnapshotOptions } from '../../types/transcode.types';
import {
    VolcengineTosConfig,
    VolcengineSubmitJobRequest,
    ResponseMetadata,
    VolcengineMediaConvertTaskResult,
    VolcengineInputPath,
    VolcengineOutputPath,
    VolcengineJobOutputProperties,
    VolcengineSubtitleInfo,
    VolcengineSubtitle,
    VolcengineVQNRInfo,
    VolcengineVQFRInfo,
    VolcengineInterlace,
    VolcengineBlackFrame,
    VolcengineBlackInfo,
    VolcengineVolumeInfo,
    VolcengineWatermark,
    VolcengineWatermarkInfo,
    VolcengineOCR,
    VolcengineOCRInfo,
    VolcengineRect,
    VolcengineCandidate,
    VolcengineTimeInfo,
    VolcengineJobOutput,
    VolcengineMultiInput,
    VolcengineWorkflowParams,
    VolcengineSubmitJobResult,
    VolcengineSubmitJobRequestOrigin,
    VolcengineRetrieveJobRequest,
    VolcengineRetrieveJobResponse,
    VolcengineRetrievedJobInfo,
    VolcengineCancelJobRequest,
} from './volcengine-tos-transcode.dto';
import { environmentUtil as enviromentUtil } from '@dofe/infra-utils';

@Injectable()
export class VolcengineTosTranscodeClient {
    private readonly baseUrl: string;
    private readonly appConfig: AppConfig;
    private readonly templateId: string;
    private readonly action: string;
    private readonly version: string;
    private readonly accessKey: string;
    private readonly secretKey: string;
    private readonly region: string;
    private readonly webhookApiBaseUrl: string;
    private readonly callbackUri: string;
    private readonly canCallback: boolean = false;
    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        private readonly configService: ConfigService,
        private readonly fileApi: FileStorageService,
        private readonly httpService: HttpService,
    ) {
        const transcodeConfig = getKeysConfig()?.transcode as TranscodeConfig;
        if (!transcodeConfig || !transcodeConfig.tos) {
            throw new Error('Transcode config not found');
        }
        this.baseUrl =
            (transcodeConfig.tos.baseUrl as string) ||
            'https://open.volcengineapi.com';
        this.templateId = transcodeConfig.tos.templateId as string;
        this.action = (transcodeConfig.tos.action as string) || 'SubmitJob';
        this.version = (transcodeConfig.tos.version as string) || '2021-06-11';
        this.accessKey = transcodeConfig.tos.accessKey as string;
        this.secretKey = transcodeConfig.tos.secretKey as string;
        this.region = transcodeConfig.tos.region || 'cn-beijing';

        this.appConfig = this.configService.getOrThrow<AppConfig>('app');

        this.webhookApiBaseUrl = enviromentUtil.generateEnvironmentUrls().api;

        this.callbackUri = `${this.webhookApiBaseUrl}/${transcodeConfig.tos.callbackUri}`;
    }

    /**
     * 从视频中提取音频（使用火山引擎 VOD API）
     * 使用模板：video_audio_mp3_128K
     */
    async extractAudioFromVideo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options: AudioExtractOptions = {},
    ): Promise<MediaConvertTaskResult> {
        throw new Error('Audio extracti on not supported for TOS');
    }

    /**
     * 获取视频信息（暂不支持，需要实现）
     */
    async getVideoInfo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        type?: 'oss' | 'imm',
    ): Promise<Partial<VideoInfo> & any> {
        const videoInfo = await this.fileApi.getVideoInfo(vendor, bucket, key);
        console.log('techwu getVideoInfo', vendor, bucket, key, videoInfo);
        return videoInfo;
    }

    /**
     * 获取音频信息（暂不支持，需要实现）
     */
    async getAudioInfo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        type?: 'oss' | 'imm',
    ): Promise<Partial<AudioInfo> & any> {
        return this.fileApi.getAudioInfo(vendor, bucket, key);
        // throw new Error('Audio info extraction not yet implemented for TOS');
    }

    /**
     * 获取图片信息（暂不支持，需要实现）
     */
    async getImageInfo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        type?: 'oss' | 'imm',
    ): Promise<Partial<ImageInfo> & any> {
        return this.fileApi.getImageInfo(vendor, bucket, key);
    }

    /**
     * 视频单帧截取（暂不支持）
     */
    async takeSnapshot(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options?: SnapshotOptions,
    ): Promise<string> {
        console.log('techwu takeSnapshot', key);
        const {
            time = '00:00:01',
            width = 0,
            height = 0,
            format = 'jpg',
        } = options;
        // 将 time (如 '00:00:01') 转为毫秒格式
        let timeMs: number = 0;
        if (typeof time === 'string') {
            const parts = time.split(':').map(Number);
            if (parts.length === 3) {
                const [hh, mm, ss] = parts;
                timeMs = (hh * 60 * 60 + mm * 60 + ss) * 1000;
            } else if (parts.length === 2) {
                const [mm, ss] = parts;
                timeMs = (mm * 60 + ss) * 1000;
            } else if (parts.length === 1) {
                timeMs = parts[0] * 1000;
            }
        } else if (typeof time === 'number') {
            timeMs = time;
        }
        return await this.fileApi.getSnapshot(vendor, bucket, key, {
            time: timeMs,
            width,
            height,
            format,
        });
    }

    /**
     * 获取视频头图（暂不支持）
     */
    async getVideoThumbnail(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
    ): Promise<string> {
        return await this.fileApi.getSnapshot(vendor, bucket, key);
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
        return this.getTask(vendor, bucket, taskId);
    }

    /**
     * 取消转码任务
     */
    async cancelTranscodeTask(
        vendor: FileBucketVendor,
        taskId: string,
    ): Promise<boolean> {
        // 需要 bucket 参数，但这里没有提供，尝试从配置中获取默认 bucket
        const bucketConfigs =
            this.configService.getOrThrow<PardxUploader.Config[]>('buckets');
        const defaultBucketConfig = bucketConfigs.find(
            (config) => config.vendor === 'tos',
        );

        if (!defaultBucketConfig) {
            throw new Error('No TOS bucket configured');
        }

        return this.cancelTask(vendor, defaultBucketConfig.bucket, taskId);
    }

    /**
     * 提交媒体处理任务
     * 参考：https://www.volcengine.com/docs/6448/76377?lang=zh
     *
     * @param request 提交任务请求参数
     * @returns 任务 ID
     */
    async submitJob(
        request: VolcengineSubmitJobRequest,
    ): Promise<VolcengineSubmitJobResult> {
        try {
            if (!this.accessKey || !this.secretKey) {
                throw new Error(
                    'Volcengine access key or secret key not configured',
                );
            }

            this.logger.info('Submitting media processing job', {
                templateId: request.TemplateId,
                inputPath: request.InputPath,
            });

            // 构建请求参数
            const requestParams: VolcengineSubmitJobRequestOrigin = {
                Action: this.action,
                Version: this.version,
                TemplateId: request.TemplateId,
            };

            // 设置输入路径（InputPath 和 MultiInputs 二选一）
            if (request.MultiInputs) {
                if (request.MultiInputs.length > 20) {
                    throw new Error('MultiInputs cannot exceed 20 items');
                }
                requestParams.MultiInputs = JSON.stringify(request.MultiInputs);
            } else if (request.InputPath) {
                requestParams.InputPath = JSON.stringify(request.InputPath);
            } else {
                throw new Error(
                    'Either InputPath or MultiInputs must be provided',
                );
            }

            // 添加输出路径（如果提供）
            if (request.OutputPath) {
                requestParams.OutputPath = JSON.stringify(request.OutputPath);
            }

            // 添加动态参数（如果提供）
            if (request.Params) {
                requestParams.Params = JSON.stringify(request.Params);
            }

            // 添加回调参数
            if (request.CallbackArgs) {
                if (request.CallbackArgs.length > 512) {
                    throw new Error('CallbackArgs cannot exceed 512 bytes');
                }
                requestParams.CallbackArgs = request.CallbackArgs;
            }

            // 添加回调地址
            if (this.canCallback) {
                if (request.CallbackUri) {
                    requestParams.CallbackUri = request.CallbackUri;
                    if (request.CallbackContentType) {
                        requestParams.CallbackContentType =
                            request.CallbackContentType;
                    }
                } else {
                    // 如果没有提供回调地址，使用默认的回调地址
                    requestParams.CallbackUri = this.callbackUri;
                    requestParams.CallbackContentType = 'application/json';
                }
            } else {
                if (request.CallbackUri || request.CallbackContentType) {
                    // 如果提供了回调地址或回调参数，但 canCallback 为 false，则抛出错误
                    // 这是因为 TOS 不支持回调，如果需要回调，请联系火山云客服开通回调白名单功能
                    throw new Error(
                        'Callback is not supported for TOS, please set canCallback to true',
                    );
                }
            }

            // 添加闲时任务选项
            if (request.EnableLowPriority !== undefined) {
                requestParams.EnableLowPriority =
                    request.EnableLowPriority.toString();
            }

            // 添加单任务触发参数（如果提供）
            if (request.Job) {
                requestParams.Job = JSON.stringify(request.Job);
            }

            // 使用 Signer 签名请求
            const openApiRequestData = {
                region: this.region,
                method: 'POST' as const,
                params: requestParams,
                headers: {},
                body: '',
            };

            const signer = new Signer(openApiRequestData, 'imp');
            signer.addAuthorization({
                accessKeyId: this.accessKey,
                secretKey: this.secretKey,
            });
            console.log('techwu openApiRequestData', requestParams);
            // 发送请求
            const response = await firstValueFrom(
                this.httpService.request({
                    url: this.baseUrl,
                    headers: openApiRequestData.headers,
                    params: openApiRequestData.params,
                    method: openApiRequestData.method,
                }),
            );

            if (!response?.data?.Result) {
                throw new Error(
                    'Invalid response from Volcengine IMP API: missing Result',
                );
            }

            const result: VolcengineSubmitJobResult = {
                taskId: response.data.Result,
                requestId: response.data.ResponseMetadata?.RequestId || '',
                eventId: response.data.Result,
            };

            this.logger.info('Media processing job submitted successfully', {
                taskId: result.taskId,
                templateId: request.TemplateId,
            });

            return result;
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to submit media processing job', {
                templateId: request.TemplateId,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    /**
     * 查询转码任务状态
     * 参考：https://www.volcengine.com/docs/6448/76379?lang=zh
     */
    async getTask(
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
            if (vendor !== 'tos') {
                throw new Error(`Unsupported vendor for TOS: ${vendor}`);
            }

            if (!this.accessKey || !this.secretKey) {
                throw new Error(
                    'Volcengine access key or secret key not configured',
                );
            }

            this.logger.info('Retrieving media processing job', {
                taskId,
            });

            // 构建请求参数
            const requestParams: Record<string, any> = {
                Action: 'RetrieveJob',
                Version: '2021-06-11',
                JobIds: JSON.stringify([taskId]), // JobIds 需要是 JSON 数组字符串
            };

            // 使用 Signer 签名请求
            const openApiRequestData = {
                region: this.region,
                method: 'POST' as const,
                params: requestParams,
                headers: {},
                body: '',
            };

            const signer = new Signer(openApiRequestData, 'imp');
            signer.addAuthorization({
                accessKeyId: this.accessKey,
                secretKey: this.secretKey,
            });

            // 发送请求
            const response = await firstValueFrom(
                this.httpService.request({
                    url: this.baseUrl,
                    headers: openApiRequestData.headers,
                    params: openApiRequestData.params,
                    method: openApiRequestData.method,
                }),
            );

            if (!response?.data?.Result) {
                throw new Error(
                    'Invalid response from Volcengine IMP API: missing Result',
                );
            }

            // 从 Result 中获取对应 taskId 的任务信息
            const jobInfo: VolcengineRetrievedJobInfo =
                response.data.Result[taskId];
            if (!jobInfo) {
                throw new Error(`Job not found: ${taskId}`);
            }

            // 解析任务状态
            const status = jobInfo.Status || 'unknown';
            const result = jobInfo;
            const error = jobInfo.JobContent?.Error || undefined;

            // 尝试从 JobContent 中提取进度信息
            let progress: number | undefined;
            if (jobInfo.JobContent) {
                // 根据实际返回结构提取进度
                progress =
                    jobInfo.JobContent.Progress || jobInfo.JobContent.progress;
            }

            this.logger.info('Media processing job retrieved successfully', {
                taskId,
                status,
                progress,
            });

            return {
                status,
                progress,
                result,
                error,
            };
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to get task status', {
                taskId,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    /**
     * 取消转码任务
     * 参考：https://www.volcengine.com/docs/6448/76377?lang=zh (CancelJob)
     */
    async cancelTask(
        vendor: FileBucketVendor,
        bucket: string,
        taskId: string,
    ): Promise<boolean> {
        try {
            if (vendor !== 'tos') {
                throw new Error(`Unsupported vendor for TOS: ${vendor}`);
            }

            if (!this.accessKey || !this.secretKey) {
                throw new Error(
                    'Volcengine access key or secret key not configured',
                );
            }

            this.logger.info('Cancelling media processing job', {
                taskId,
            });

            // 构建请求参数
            const requestParams: Record<string, any> = {
                Action: 'CancelJob',
                Version: '2021-06-11',
                JobId: taskId,
            };

            // 使用 Signer 签名请求
            const openApiRequestData = {
                region: this.region,
                method: 'POST' as const,
                params: requestParams,
                headers: {},
                body: '',
            };

            const signer = new Signer(openApiRequestData, 'imp');
            signer.addAuthorization({
                accessKeyId: this.accessKey,
                secretKey: this.secretKey,
            });

            // 发送请求
            const response = await firstValueFrom(
                this.httpService.request({
                    url: this.baseUrl,
                    headers: openApiRequestData.headers,
                    params: openApiRequestData.params,
                    method: openApiRequestData.method,
                }),
            );

            this.logger.info('Media processing job cancelled successfully', {
                taskId,
                requestId: response.data.ResponseMetadata?.RequestId,
            });

            return true;
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to cancel task', {
                taskId,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    /**
     * 视频转码（使用火山引擎 VOD API）
     * 参考：https://www.volcengine.com/docs/4/127559
     */
    async transcodeVideo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        qualities: VideoQuality[] = [
            VideoQuality.VIDEO_4K,
            VideoQuality.VIDEO_1080P,
            VideoQuality.VIDEO_720P,
            VideoQuality.VIDEO_360P,
        ],
        index: number = 0,
    ): Promise<MediaConvertTaskResult> {
        try {
            if (vendor !== 'tos') {
                throw new Error(
                    `Unsupported vendor for TOS transcode: ${vendor}`,
                );
            }

            this.logger.info(
                'Creating video transcode task using Volcengine VOD',
                {
                    vendor,
                    bucket,
                    key,
                    qualities,
                },
            );

            const request: VolcengineSubmitJobRequest = {
                Action: this.action,
                Version: this.version,
                TemplateId: this.templateId,
                InputPath: {
                    Type: 'TOS',
                    TosBucket: bucket,
                    FileId: key,
                },
                CallbackArgs: JSON.stringify({
                    vendor,
                    bucket,
                    key,
                    index,
                    timestamp: new Date().toISOString(),
                }),
                // CallbackUri: `${this.webhookApiBaseUrl}/api/webhook/transcode/volcengine`,
                // CallbackContentType: 'application/json',
            };
            if (this.canCallback) {
                request.CallbackUri = this.callbackUri;
                request.CallbackContentType = 'application/json';
            }
            const result = await this.submitJob(request);
            console.log('techwu submitJob result', result);
            return result;
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to create video transcode task', {
                vendor,
                bucket,
                key,
                qualities,
                error: errorMessage,
            });
            throw error;
        }
    }
}
