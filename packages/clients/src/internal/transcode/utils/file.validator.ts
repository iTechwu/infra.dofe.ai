import { Injectable } from '@nestjs/common';
import { fileUtil } from '@dofe/infra-utils';
import {
    TRANSCODE_CONSTANTS,
    SUPPORTED_VIDEO_FORMATS,
    SUPPORTED_AUDIO_FORMATS,
    SUPPORTED_IMAGE_FORMATS,
} from '@dofe/infra-common';
import { FileKeyPartial, FileValidationResult } from '../types/transcode.types';
import { PardxApp } from '@dofe/infra-common';
import { ZoneConfig } from '@dofe/infra-common';

@Injectable()
export class FileValidator {
    constructor(private readonly cnZoneConfig: ZoneConfig) {}

    /**
     * 验证文件是否可以进行转码
     */
    validateFileForTranscode(fileKey: FileKeyPartial): FileValidationResult {
        if (!this.isValidBucket(fileKey)) {
            return {
                isValid: false,
                reason: TRANSCODE_CONSTANTS.ERROR_MESSAGES.BUCKET_NOT_SUPPORTED,
            };
        }

        if (!this.isVideoFile(fileKey)) {
            return {
                isValid: false,
                reason: TRANSCODE_CONSTANTS.ERROR_MESSAGES.INVALID_FILE,
                supportedFormats: SUPPORTED_VIDEO_FORMATS,
            };
        }

        return { isValid: true };
    }

    /**
     * 验证文件是否可以进行FFmpeg处理
     */
    validateFileForFfmpeg(fileKey: FileKeyPartial): FileValidationResult {
        if (!this.isValidBucket(fileKey)) {
            return {
                isValid: false,
                reason: TRANSCODE_CONSTANTS.ERROR_MESSAGES.BUCKET_NOT_SUPPORTED,
            };
        }

        if (!this.isVideoFile(fileKey) && !this.isAudioFile(fileKey)) {
            return {
                isValid: false,
                reason: TRANSCODE_CONSTANTS.ERROR_MESSAGES.INVALID_FILE,
                supportedFormats: [
                    ...SUPPORTED_VIDEO_FORMATS,
                    ...SUPPORTED_AUDIO_FORMATS,
                ],
            };
        }

        return { isValid: true };
    }

    /**
     * 检查文件是否在有效的转码存储桶中
     */
    isValidBucket(fileKey: FileKeyPartial): boolean {
        return (
            fileKey?.bucket === this.cnZoneConfig.defaultPrivateBucket ||
            fileKey?.bucket === this.cnZoneConfig.defaultPublicBucket
        );
    }

    /**
     * 检查是否为视频文件
     */
    isVideoFile(fileKey: FileKeyPartial): boolean {
        return fileUtil.isVideoFile(fileKey?.ext);
    }

    /**
     * 检查是否为音频文件
     */
    isAudioFile(fileKey: FileKeyPartial): boolean {
        return fileUtil.isAudioFile(fileKey?.ext);
    }

    /**
     * 检查是否为图片文件
     */
    isImageFile(fileKey: FileKeyPartial): boolean {
        return fileUtil.isImageFile(fileKey?.ext);
    }

    /**
     * 获取文件类型
     */
    getFileType(
        fileKey: FileKeyPartial,
    ): 'video' | 'audio' | 'image' | 'unknown' {
        if (this.isVideoFile(fileKey)) return 'video';
        if (this.isAudioFile(fileKey)) return 'audio';
        if (this.isImageFile(fileKey)) return 'image';
        return 'unknown';
    }

    /**
     * 检查文件扩展名是否在支持列表中
     */
    isSupportedFormat(
        extension: string,
        supportedFormats: readonly string[],
    ): boolean {
        return supportedFormats.includes(extension?.toLowerCase());
    }

    /**
     * 获取不同类型文件的支持格式
     */
    getSupportedFormats(type: 'video' | 'audio' | 'image'): readonly string[] {
        switch (type) {
            case 'video':
                return SUPPORTED_VIDEO_FORMATS;
            case 'audio':
                return SUPPORTED_AUDIO_FORMATS;
            case 'image':
                return SUPPORTED_IMAGE_FORMATS;
            default:
                return [];
        }
    }
}
