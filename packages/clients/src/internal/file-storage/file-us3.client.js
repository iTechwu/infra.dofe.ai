"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUs3Client = void 0;
const file_s3_client_1 = require("./file-s3.client");
const crypto_1 = require("crypto");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
/**
 * UCloud US3 Storage Client
 *
 * 职责：仅负责与 UCloud US3 API 通信
 * - 不访问数据库
 * - 不包含业务逻辑
 */
class FileUs3Client extends file_s3_client_1.FileS3Client {
    urlRedisKey = 'privateDownloadUrl';
    constructor(config, storageConfig, appConfig, redis, httpService, logger) {
        super(config, storageConfig, appConfig, redis, httpService, logger);
    }
    setClient() {
        const credentials = {
            // 访问密钥ID
            accessKeyId: this.storageConfig.accessKey,
            // 访问密钥
            secretAccessKey: this.storageConfig.secretKey,
        };
        const clientConfig = {
            // 设置凭证
            credentials: credentials,
            // 设置端点
            // endpoint: this.config.endpoint,
            // 设置区域
            region: this.config.region,
        };
        this.externalClient = new client_s3_1.S3Client({
            ...clientConfig,
            endpoint: this.config.endpoint,
            // endpoint: this.config.domain,
        });
        // if (enviromentUtil.isProduction()) {
        //     // 创建内部客户端对象
        //     this.internalClient = new S3Client({
        //         ...clientConfig,
        //         endpoint: this.config.internalEndpoint,
        //     })
        // } else {
        this.internalClient = this.externalClient;
        // }
    }
    /**
     * 获取私有文件的下载链接
     *
     * @param fileKey 文件键名
     * @param expire 链接过期时间，单位为秒，默认为3600秒
     * @param internal 是否使用内部客户端，默认为false
     * @returns 返回一个Promise，解析后得到私有文件的下载链接
     */
    async getPrivateDownloadUrl(fileKey, expire = 30, internal = false, bucket) {
        if (this.config.isPublic) {
            return `${this.config.domain}/${fileKey}`;
        }
        const url = await this.getPrivateDownloadUrlWithoutCdnEncrypt(fileKey, expire, internal, bucket);
        // if (this.config?.cdnKeyName && this.config?.cdnPrivateKey) {
        //     const expires = Math.floor(Date.now() / 1000) + 30
        //     const urlToSign = `${url}&Expires=${expires}&KeyName=${this.config.cdnKeyName}`
        //     const signature = createHmac(
        //         'sha1',
        //         Buffer.from(this.config.cdnPrivateKey, 'base64'),
        //     )
        //         .update(urlToSign)
        //         .digest('base64')
        // }
        return url;
    }
    async getPrivateDownloadUrlWithoutCdnEncrypt(fileKey, expiresIn = 30, internal = false, bucket) {
        const finalBucket = bucket || this.getBucketString();
        const cacheKey = `${finalBucket}:${fileKey}`;
        // const redisUrl = await this.redis.getData(this.urlRedisKey, cacheKey)
        // if (redisUrl) {
        //     return redisUrl
        // }
        if (internal) {
            const getObjectCommand = new client_s3_1.GetObjectCommand({
                Bucket: finalBucket,
                Key: fileKey,
            });
            const client = internal ? this.internalClient : this.externalClient;
            const signedUrl = await (0, s3_request_presigner_1.getSignedUrl)(client, getObjectCommand, {
                expiresIn: expiresIn,
            }); // expiresIn 是预签名 URL 的有效期，单位是秒
            this.logger.info('Presigned URL:', {
                signedUrl,
                bucket: finalBucket,
            });
            await this.redis.saveData(this.urlRedisKey, cacheKey, signedUrl);
            return this.replaceUrlToOwnDoamin(signedUrl);
        }
        else {
            const signedUrl = this.getSignedUrl(fileKey, expiresIn, finalBucket); // expiresIn 是预签名 URL 的有效期，单位是秒
            this.logger.info('Presigned URL:', {
                signedUrl,
                bucket: finalBucket,
            });
            // await this.redis.saveData(
            //     this.urlRedisKey,
            //     cacheKey,
            //     signedUrl,
            //     expiresIn,
            // )
            return signedUrl;
        }
    }
    getSignedUrl(fileKey, expiresIn = 3600, bucket) {
        const httpMethod = 'GET';
        const publicKey = this.storageConfig.accessKey;
        const privateKey = this.storageConfig.secretKey;
        const finalBucket = bucket || this.config.bucket;
        const baseUrl = `${this.config.domain}/${fileKey}`;
        const expires = Math.floor(Date.now() / 1000) + expiresIn;
        const stringToSign = `${httpMethod}\n\n\n${expires}\n/${finalBucket}/${fileKey}`;
        const signature = (0, crypto_1.createHmac)('sha1', privateKey)
            .update(stringToSign)
            .digest('base64');
        const signedUrl = `${baseUrl}?UCloudPublicKey=${publicKey}&Signature=${encodeURIComponent(signature)}&Expires=${expires}`;
        return signedUrl;
    }
}
exports.FileUs3Client = FileUs3Client;
//# sourceMappingURL=file-us3.client.js.map