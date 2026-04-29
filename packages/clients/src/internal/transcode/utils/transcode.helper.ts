import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { VideoResolutionDto } from '@/libs/config/dto/config.dto';
import { TRANSCODE_CONSTANTS } from '@/config/constant/config.constants';
import { VideoInfo, AudioInfo, ImageInfo } from '@prisma/client';
import {
    FileKeyPartial,
    TranscodeParamsBuilder,
    TranscodeParams,
} from '../types/transcode.types';

@Injectable()
export class TranscodeHelper {
    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}

    /**
     * 计算帧率
     */
    calculateFrameRate(rFrameRate: string): number {
        if (!rFrameRate || rFrameRate === '0/0') {
            return 25; // 默认帧率
        }

        const [numerator, denominator] = rFrameRate.split('/').map(Number);
        if (denominator === 0) return 25;

        return Math.round(numerator / denominator);
    }

    /**
     * 计算雪碧图数量
     */
    calculateSpriteCount(duration?: number): number {
        if (!duration || duration < TRANSCODE_CONSTANTS.VIDEO.MIN_DURATION) {
            return 0;
        }
        return Math.ceil(duration / TRANSCODE_CONSTANTS.VIDEO.SPRITE_INTERVAL);
    }

    /**
     * 提取视频信息
     */
    extractVideoInfo(data: any): Partial<VideoInfo> {
        const durationSec =
            data?.format?.duration || data?.streams?.[0]?.duration;
        const duration = durationSec ? Number(durationSec) : undefined;
        const streamDuration = data?.streams?.[0]?.duration
            ? Number(data.streams[0].duration)
            : undefined;

        const videoStream = data?.streams?.find(
            (stream: any) => stream.codec_type === 'video',
        );

        const frameRate = videoStream?.r_frame_rate;
        const width = videoStream?.width
            ? parseInt(videoStream.width)
            : undefined;
        const height = videoStream?.height
            ? parseInt(videoStream.height)
            : undefined;
        const sar = videoStream?.sample_aspect_ratio;
        const dar = videoStream?.display_aspect_ratio;

        return {
            duration,
            streamDuration,
            width,
            height,
            sar,
            dar,
            rFrameRate: frameRate,
            spriteCount: this.calculateSpriteCount(duration),
        };
    }

    /**
     * 提取音频信息
     */
    extractAudioInfo(data: any): Partial<AudioInfo> {
        const audioStream = data?.streams?.find(
            (stream: any) => stream.codec_type === 'audio',
        );

        return {
            duration: data?.format?.duration
                ? Number(data.format.duration)
                : undefined,
            sampleRate: audioStream?.sample_rate,
            channels: audioStream?.channels,
        };
    }

    /**
     * 日志记录助手
     */
    logTaskProgress(
        operation: string,
        fileKey: FileKeyPartial,
        additionalData?: Record<string, any>,
    ): void {
        this.logger.info(`Transcode ${operation}`, {
            fileKey: fileKey.key,
            bucket: fileKey.bucket,
            operation,
            ...additionalData,
        });
    }

    /**
     * 错误日志记录
     */
    logError(operation: string, error: any, fileKey?: FileKeyPartial): void {
        this.logger.error(`Transcode ${operation} failed`, {
            error: error.message || error,
            stack: error.stack,
            fileKey: fileKey?.key,
            bucket: fileKey?.bucket,
            operation,
        });
    }

    // 私有方法：构建不同类型的转码参数
    private buildSnapshotParams(baseParams: any): TranscodeParams {
        return {
            priority: 1,
            params: {
                ...baseParams,
                time: '00:00:01',
                format: 'image2',
                vframes: 1,
            },
        };
    }

    private buildSpriteParams(
        baseParams: any,
        videoInfo: Partial<VideoInfo>,
    ): TranscodeParams {
        const interval = TRANSCODE_CONSTANTS.VIDEO.SPRITE_INTERVAL;
        return {
            priority: 3,
            params: {
                ...baseParams,
                interval,
                tile: this.calculateOptimalTileSize(videoInfo.spriteCount || 0),
            },
        };
    }

    private buildCompressParams(
        baseParams: any,
        size: VideoResolutionDto,
        videoInfo: Partial<VideoInfo>,
    ): TranscodeParams {
        const resolution = this.getResolutionDimensions(size);
        const frameRate = this.calculateFrameRate(videoInfo.rFrameRate || '');

        return {
            priority: this.getCompressionPriority(size),
            params: {
                ...baseParams,
                width: resolution.width,
                height: resolution.height,
                frameRate: Math.min(frameRate, 30), // 限制最大帧率
                bitrate: this.calculateOptimalBitrate(size, videoInfo),
            },
        };
    }

    private buildAudioMp3Params(baseParams: any): TranscodeParams {
        return {
            priority: 2,
            params: {
                ...baseParams,
                codec: 'mp3',
                bitrate: '128k',
                sampleRate: 44100,
            },
        };
    }

    private buildHdr2SdrParams(
        baseParams: any,
        videoInfo: Partial<VideoInfo>,
    ): TranscodeParams {
        return {
            priority: 4,
            params: {
                ...baseParams,
                colorspace: 'bt709',
                color_primaries: 'bt709',
                color_trc: 'bt709',
                width: videoInfo.width,
                height: videoInfo.height,
            },
        };
    }

    private buildDefaultParams(baseParams: any): TranscodeParams {
        return {
            priority: TRANSCODE_CONSTANTS.VIDEO.DEFAULT_PRIORITY,
            params: baseParams,
        };
    }

    private calculateOptimalTileSize(spriteCount: number): string {
        if (spriteCount <= 100) return '10x10';
        if (spriteCount <= 225) return '15x15';
        return '20x20';
    }

    private getResolutionDimensions(size: VideoResolutionDto): {
        width: number;
        height: number;
    } {
        const resolutions = {
            [VideoResolutionDto.UHD]: { width: 3840, height: 2160 },
            [VideoResolutionDto.HD]: { width: 1920, height: 1080 },
            [VideoResolutionDto.SD]: { width: 1280, height: 720 },
            [VideoResolutionDto.SSD]: { width: 640, height: 360 },
        };

        return resolutions[size] || resolutions[VideoResolutionDto.HD];
    }

    private getCompressionPriority(size: VideoResolutionDto): number {
        const priorities = {
            [VideoResolutionDto.UHD]: 8,
            [VideoResolutionDto.HD]: 6,
            [VideoResolutionDto.SD]: 4,
            [VideoResolutionDto.SSD]: 2,
        };

        return priorities[size] || 5;
    }

    private calculateOptimalBitrate(
        size: VideoResolutionDto,
        videoInfo: Partial<VideoInfo>,
    ): string {
        const baseBitrates = {
            [VideoResolutionDto.UHD]: '15000k',
            [VideoResolutionDto.HD]: '5000k',
            [VideoResolutionDto.SD]: '2500k',
            [VideoResolutionDto.SSD]: '1000k',
        };

        return baseBitrates[size] || '2500k';
    }
}
