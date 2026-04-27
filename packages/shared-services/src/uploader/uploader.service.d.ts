import { Logger } from 'winston';
import { RedisService } from "../../../redis/src";
import { FileStorageService } from "../file-storage";
import { ConfigService } from '@nestjs/config';
import { FileBucketVendor } from '@prisma/client';
/**
 * 签名数据接口
 * 从加密签名中解析出的数据结构
 */
export interface SignatureData {
    timestamp?: number;
    filename?: string;
    fileId?: string;
    platform?: string;
    userId?: string;
    sha256?: string;
}
/**
 * 上传令牌请求接口
 * 用于获取上传凭证的请求参数
 */
export interface TokenRequest {
    signature?: string;
    filename?: string;
    vendor?: FileBucketVendor;
    bucket?: string;
    locale?: string;
    key?: string;
    uploadId?: string;
    partNumber?: number;
}
export declare class UploaderService {
    private readonly configService;
    private readonly redis;
    private readonly fileApi;
    private readonly logger;
    private appConfig;
    constructor(configService: ConfigService, redis: RedisService, fileApi: FileStorageService, logger: Logger);
    /**
     * 校验验证信息并返回签名数据
     *
     * @param userId 用户ID
     * @param cmd 上传器公共令牌获取命令
     * @returns 返回签名数据
     * @throws 当签名验证失败时，抛出 ApiException 异常，错误信息为 'signatureError'
     * @throws 当参数无效时，抛出 ApiException 异常，错误信息为 'invalidParameters'
     */
    checkValidateAndReturnSignatureData(userId: string, cmd: TokenRequest): SignatureData;
    getUploaderPresignedUrl(cmd: TokenRequest, ip?: string): Promise<{
        token: string;
        fileKey: string;
    }>;
    /**
     * 使用回调方式上传文件的token
     *
     * @param key 文件唯一标识
     * @returns 返回包含token、fileKey的对象
     */
    uploadTokenWithCallback(vendor: FileBucketVendor, bucket: string, key: string, ip?: string, locale?: string): Promise<{
        token: string;
        fileKey: string;
    }>;
    /**
     * 无回调地上传token
     *
     * @param userId 用户ID
     * @param filename 文件名
     * @param bucket 存储桶名称，默认为环境变量this.appConfig.defaultBucket指定的值
     * @returns 返回一个Promise，resolve后的对象包含以下字段：
     *  - token: 上传token
     *  - fileKey: 文件key
     */
    getPublicUploadToken(userId: string, cmd: TokenRequest, ip?: string): Promise<{
        token: string;
        fileKey: string;
        domain: string;
        vendor: FileBucketVendor;
        bucket: string;
    }>;
    uploadThumbToken(userId: string, cmd: TokenRequest, ip?: string): Promise<{
        token: string;
        key: string;
        domain: string;
        bucket: string;
    }>;
}
