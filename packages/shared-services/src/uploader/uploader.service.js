"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploaderService = void 0;
const common_1 = require("@nestjs/common");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const errors_1 = require("@repo/contracts/errors");
const api_exception_1 = require("../../../common/src/filter/exception/api.exception");
const redis_1 = require("../../../redis/src");
const file_storage_1 = require("../file-storage");
const config_1 = require("@nestjs/config");
const crypto_util_1 = require("../../../utils/dist/crypto.util");
const enviroment_util_1 = __importDefault(require("../../../utils/dist/enviroment.util"));
const file_util_1 = __importDefault(require("../../../utils/dist/file.util"));
let UploaderService = class UploaderService {
    configService;
    redis;
    fileApi;
    logger;
    appConfig;
    constructor(configService, redis, fileApi, logger) {
        this.configService = configService;
        this.redis = redis;
        this.fileApi = fileApi;
        this.logger = logger;
        this.appConfig = configService.get('app');
    }
    /**
     * 校验验证信息并返回签名数据
     *
     * @param userId 用户ID
     * @param cmd 上传器公共令牌获取命令
     * @returns 返回签名数据
     * @throws 当签名验证失败时，抛出 ApiException 异常，错误信息为 'signatureError'
     * @throws 当参数无效时，抛出 ApiException 异常，错误信息为 'invalidParameters'
     */
    checkValidateAndReturnSignatureData(userId, cmd) {
        let signatureData = {};
        try {
            const jsonString = (0, crypto_util_1.rsaDecrypt)(cmd.signature);
            if (!jsonString || jsonString.trim() === '') {
                this.logger.error('[Signature Validation] Decryption failed: empty result', {
                    signature: cmd.signature?.substring(0, 50) + '...',
                    userId,
                });
                throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.SignatureError);
            }
            signatureData = JSON.parse(jsonString);
        }
        catch (e) {
            this.logger.error('[Signature Validation] Decryption or parsing failed:', {
                error: e.message || e,
                signature: cmd.signature?.substring(0, 50) + '...',
                userId,
            });
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.SignatureError);
        }
        const uploaderUserId = !signatureData?.userId
            ? undefined
            : signatureData.userId;
        if (userId != uploaderUserId) {
            this.logger.error('[Signature Validation] UserId mismatch:', {
                expectedUserId: userId,
                signatureUserId: uploaderUserId,
                signatureData,
            });
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.SignatureError);
        }
        //时间戳距离当前时间超过15秒，则无效
        const now = new Date().getTime();
        if (enviroment_util_1.default.isProduction() &&
            now - signatureData.timestamp > 15 * 1000) {
            this.logger.error('[Signature Validation] Timestamp expired:', {
                now,
                signatureTimestamp: signatureData.timestamp,
                diff: now - signatureData.timestamp,
            });
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.InvalidParameters, {
                field: 'signature',
                message: 'signatureIsExpired',
            });
        }
        return signatureData;
    }
    async getUploaderPresignedUrl(cmd, ip) {
        const bucket = await this.fileApi.getBucketString(cmd?.bucket, ip, false, cmd?.locale);
        const vendor = cmd?.vendor ?? this.appConfig.defaultVendor;
        const token = await this.fileApi.getPresignedUrl(vendor, bucket, {
            uploadId: cmd?.uploadId,
            key: cmd?.key,
            partNumber: cmd?.partNumber,
        });
        return {
            token,
            fileKey: cmd?.key,
        };
    }
    /**
     * 使用回调方式上传文件的token
     *
     * @param key 文件唯一标识
     * @returns 返回包含token、fileKey的对象
     */
    async uploadTokenWithCallback(vendor, bucket, key, ip, locale) {
        const callbackAuthKey = await this.redis.saveQiniuUploadAuthKey(key);
        vendor = vendor ?? this.appConfig.defaultVendor;
        bucket = await this.fileApi.getBucketString(bucket, ip, false, locale);
        const token = await this.fileApi.uploadTokenWithCallback(vendor, bucket, callbackAuthKey, {
            saveKey: key,
            forceSaveKey: true,
        });
        return {
            token,
            fileKey: key,
        };
    }
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
    async getPublicUploadToken(userId, cmd, ip) {
        const bucket = await this.fileApi.getBucketString(cmd?.bucket, ip, true, cmd?.locale);
        const vendor = cmd?.vendor ?? this.appConfig.defaultVendor;
        const fileApiConfig = await this.fileApi.getFileServiceConfig(vendor, bucket, ip);
        const ext = file_util_1.default.getFileExtension(cmd.filename);
        const fileKey = await this.fileApi.formatNewKeyString(`public`, ext, bucket);
        const token = await this.fileApi.uploadToken(vendor, bucket, {
            saveKey: fileKey,
            forceSaveKey: true,
        });
        const domain = fileApiConfig.domain;
        return {
            token,
            fileKey,
            domain,
            vendor,
            bucket,
        };
    }
    async uploadThumbToken(userId, cmd, ip) {
        const vendor = cmd?.vendor ?? this.appConfig.defaultVendor;
        const bucket = await this.fileApi.getBucketString(cmd?.bucket, ip, false, cmd?.locale, vendor);
        const fileApiConfig = await this.fileApi.getFileServiceConfig(vendor, bucket, ip);
        const ext = file_util_1.default.getFileExtension(cmd.filename);
        const key = await this.fileApi.formatNewKeyString(`thumbimg`, ext, bucket);
        const token = await this.fileApi.uploadToken(undefined, bucket, {
            saveKey: key,
            forceSaveKey: true,
        });
        const domain = fileApiConfig.domain;
        return {
            token,
            key,
            domain,
            bucket,
        };
    }
};
exports.UploaderService = UploaderService;
exports.UploaderService = UploaderService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        redis_1.RedisService,
        file_storage_1.FileStorageService,
        winston_1.Logger])
], UploaderService);
//# sourceMappingURL=uploader.service.js.map