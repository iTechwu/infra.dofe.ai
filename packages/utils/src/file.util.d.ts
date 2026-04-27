import { FileBucketVendor, FileSource } from '@prisma/client';
import { DoFeApp } from "../../common/src/config/dto/config.dto";
declare const _default: {
    /**
     * 从文件名推断文件类型
     */
    getFileTypeFromName(filename: string): string;
    /**
     * 根据文件扩展名获取MIME类型
     *
     * @param ext 文件扩展名
     * @returns MIME类型字符串
     */
    getMimeType(ext: string): string;
    /**
     * 判断给定的文件名是否为图片文件
     *
     * @param filename 文件名
     * @returns 若文件名是图片文件，则返回true；否则返回false
     */
    isImageFile(ext: string): boolean;
    isVideoFile(ext: string): boolean;
    isAudioFile(ext: string): boolean;
    isPdfFile(ext: string): boolean;
    isEbookFile(ext: string): boolean;
    isDocumentFile(ext: string): boolean;
    buildPythonS3Uri(vendor: FileBucketVendor, bucket: string, key: string, region?: string): string;
    /**
     * 根据存储厂商、bucket、key 构建统一的源文件 URI（s3://、oss://、tos:// 等）
     * 作为底层构建函数，供转码等模块复用。
     */
    buildStorageUri(vendor: FileBucketVendor, bucket: string, key: string): string;
    /**
     * 根据视频原始 key 构建音频文件 key。
     * 规则与 Aliyun IMM / Volcengine TOS 中的 buildAudioExtractKey 保持一致：
     *  original.mp4 -> original_audio.mp3
     */
    buildAudioKeyFromVideoKey(originalKey: string, format?: string): string;
    getPrivateBucketFromKey(key: string): DoFeApp.FileBase;
    getVideoWidthAndHeight(videoInfo: any): {
        actualWidth: number;
        actualHeight: number;
    };
    addFileNameSuffix(fileName: string, suffix: string): string;
    renameFileWithNumber(fileName: string, num: number, hasTime?: boolean, unique?: boolean): string;
    renameFolderWithNumber(folderName: string, num: number, hasTime?: boolean, formatDay?: boolean): string;
    /**
     * 获取文件扩展名
     *
     * @param fileName 文件名
     * @returns 返回文件扩展名（小写），如果文件名没有扩展名或者以点结束，则返回 null
     */
    getFileExtension(fileName: string): string | null;
    /**
     * 获取文件的基本名称（不包含扩展名）
     *
     * @param fileName 文件名
     * @returns 返回不包含扩展名的文件基本名称
     */
    getFileBaseName(name: string, ext?: string): string;
    completeKeyString(fileKey: Partial<FileSource> | DoFeApp.FileBase): string;
    getS3Uri(bucket: string, key: string, region?: string): string;
    transforS3UriToKey(s3Uri: string): {
        bucket: string;
        key: string;
    };
    getKeyFromCdnString(cdnUrl: string): string;
};
export default _default;
