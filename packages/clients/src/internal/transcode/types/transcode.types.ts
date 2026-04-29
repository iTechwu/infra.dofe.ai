import { FileBucketVendor, VideoInfo } from '@prisma/client';

// 文件键部分类型
export type FileKeyPartial = {
    id?: number;
    vendor?: FileBucketVendor;
    bucket?: string;
    key?: string;
    ext?: string;
};

// 文件验证结果接口
export interface FileValidationResult {
    isValid: boolean;
    reason?: string;
    supportedFormats?: readonly string[];
}

// 转码策略接口
export interface TranscodeStrategy {
    getVideoInfo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
    ): Promise<any>;
    getAudioInfo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
    ): Promise<any>;
    getImageInfo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
    ): Promise<any>;
    transcodeVideo(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options?: any,
    ): Promise<{ taskId: string; targetUrl: string }>;
    generateSprite(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options?: any,
    ): Promise<string>;
    takeSnapshot(
        vendor: FileBucketVendor,
        bucket: string,
        key: string,
        options?: any,
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

// 转码选项接口
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

// 雪碧图选项接口
export interface SpriteOptions {
    width?: number;
    height?: number;
    interval?: number;
    columns?: number;
    lines?: number;
}

// 快照选项接口
export interface SnapshotOptions {
    time?: string;
    width?: number;
    height?: number;
    format?: string;
    quality?: number;
}

// 音频提取选项接口
export interface AudioExtractOptions {
    format?: 'mp3' | 'aac' | 'flac' | 'wav';
    bitrate?: number; // 音频码率，单位：bps
    sampleRate?: number; // 采样率，如：44100, 48000
    channels?: number; // 声道数：1(单声道) 或 2(立体声)
}

// 转码结果接口
export interface TranscodeResult {
    success: boolean;
    data?: any;
    error?: string;
    duration?: number;
}

// 批量处理结果接口
export interface BatchProcessResult {
    videoInfo: Partial<VideoInfo>;
    thumbnail: string;
    sprite: string | null;
    success: boolean;
    errors?: string[];
}

// 转码配置接口
export interface TranscodeConfig {
    url: string;
    user?: string;
    password?: string;
    webhook?: string;
    timeout?: number;
    retryCount?: number;
}

// 转码参数构建器接口
export interface TranscodeParamsBuilder {
    buildVideoParams(options: TranscodeOptions): string;
    buildAudioParams(options: TranscodeOptions): string;
    buildImageParams(options: TranscodeOptions): string;
}

// 转码参数对象类型
export interface TranscodeParams {
    priority: number;
    params: any;
}
