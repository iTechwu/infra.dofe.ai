"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileQiniuClient = void 0;
const qiniu = __importStar(require("qiniu"));
const rxjs_1 = require("rxjs");
const file_config_1 = __importDefault(require("./config/file.config"));
const urlencode_util_1 = __importDefault(require("../../../../utils/dist/urlencode.util"));
const errors_1 = require("@repo/contracts/errors");
const api_exception_1 = require("../../../../common/src/filter/exception/api.exception");
const folder_util_1 = __importDefault(require("../../../../utils/dist/folder.util"));
const enviroment_util_1 = __importDefault(require("../../../../utils/dist/enviroment.util"));
/**
 * Qiniu File Storage Client
 *
 * 职责：仅负责与七牛云存储 API 通信
 * - 不访问数据库
 * - 不包含业务逻辑
 */
class FileQiniuClient {
    mac;
    qiniuConfig;
    bucketManager;
    operManager;
    cdnManager;
    logger;
    config;
    storageConfig;
    appConfig;
    redis;
    httpService;
    /**
     * 构造函数，用于创建AppFile类的实例
     *
     */
    constructor(config, storageConfig, appConfig, redis, httpService, logger) {
        this.config = config;
        this.storageConfig = storageConfig;
        this.appConfig = appConfig;
        this.redis = redis;
        this.httpService = httpService;
        // 创建凭证对象
        this.mac = new qiniu.auth.digest.Mac(this.storageConfig.accessKey, this.storageConfig.secretKey);
        // qiniu.zone.Zone_z1
        this.qiniuConfig = new qiniu.conf.Config();
        this.qiniuConfig.zone = this.getQiniuZone();
        // 初始化 BucketManager
        this.bucketManager = new qiniu.rs.BucketManager(this.mac, this.qiniuConfig);
        this.operManager = new qiniu.fop.OperationManager(this.mac, this.qiniuConfig);
        this.cdnManager = new qiniu.cdn.CdnManager(this.mac);
    }
    /**
     * 上传凭证生成函数
     *
     * @param scope 空间名，可选参数，默认为配置中的 bucket
     * @param options PutPolicyOptions 对象，可选参数，用于设置上传凭证的回调等选项，默认为配置中的 webhook 和 callbackBody 等信息
     * @returns 返回生成的上传凭证字符串
     */
    async uploadTokenWithCallback(callbackAuthKey, scope, options, neeSpiltPart) {
        const defaultOptions = {
            callbackUrl: enviroment_util_1.default.generateEnvironmentUrls().api +
                '/' +
                this.config.webhook +
                callbackAuthKey,
            callbackBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)","mimeType":"$(mimeType)","type":${type},"endUser":"${endUser}","status":${status},"md5":"${md5}","parts":${parts},"imageInfo":$(imageInfo),"exif":$(exif),"avinfo":$(avinfo),"ext":"$(ext)","thumbImg":"$(thumbImg)"}',
            // '{"key":"$(key)","hash":"$(etag)","bucket":"$(bucket)","fsize":$(fsize)}',
            callbackBodyType: 'application/json',
        };
        const finalScope = this.getBucketString(scope);
        const finalOptions = Object.assign({}, defaultOptions, options);
        const putPolicy = new qiniu.rs.PutPolicy({
            scope: finalScope,
            ...finalOptions,
        });
        const uploadToken = putPolicy.uploadToken(this.mac);
        // if (neeSpiltPart) {
        //     await this.initiateMultipartUpload(fileKey, uploadToken)
        // }
        return uploadToken;
    }
    async uploadToken(scope, options) {
        const finalScope = this.getBucketString(scope);
        const putPolicy = new qiniu.rs.PutPolicy({
            scope: finalScope,
        });
        const uploadToken = await putPolicy.uploadToken(this.mac);
        return uploadToken;
    }
    async setFileContentDisposition(fileKey, bucket) { }
    /**
     * 文件数据上传器
     *
     * @param fileData 文件数据流
     * @param key 文件在七牛云上的存储键名
     * @param bucket 文件存储的七牛云存储空间名称，默认为类内配置的存储空间
     * @returns 返回上传成功的文件键名
     * @throws 当上传失败时，抛出 ApiException 异常
     */
    async fileDataUploader(base64Data, key, qbucket) {
        const finalBucket = this.getBucketString(qbucket);
        const buffer = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const formUploader = new qiniu.form_up.FormUploader(this.qiniuConfig);
        const putExtra = new qiniu.form_up.PutExtra();
        const uploadToken = await this.uploadToken(finalBucket);
        const { data, resp } = await formUploader.put(uploadToken, key, buffer, putExtra);
        if (resp.statusCode === 200) {
            return;
        }
        throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.QiniuUploaderError);
    }
    async getPrivateDownloadUrl(fileKey, expire, internal, bucket) {
        // 如果未传入deadline，则默认为当前时间1小时后过期
        expire = expire || 15;
        // 如果提供了 bucket，需要获取对应 bucket 的配置
        const finalBucket = bucket || this.config.bucket;
        const finalConfig = bucket && bucket !== this.config.bucket
            ? await this.getBucketConfig(bucket)
            : this.config;
        const privateBucketDomain = finalConfig.domain;
        // 可以通过配置config对象来自定义一些请求选项，例如zone等
        // const bucketManager = new qiniu.rs.BucketManager(this.mac, this.qiniuConfig);
        const expireAt = Date.now() + expire * 1000;
        const privateDownloadUrl = await this.bucketManager.privateDownloadUrl(privateBucketDomain, fileKey, expireAt);
        return privateDownloadUrl;
    }
    /**
     * 获取指定 bucket 的配置（辅助方法）
     * 注意：七牛云服务通常一个实例对应一个 bucket，此方法用于兼容接口
     */
    async getBucketConfig(bucket) {
        // 七牛云通常一个实例对应一个 bucket，如果 bucket 不同，返回当前配置
        // 实际使用时应该根据 bucket 创建对应的服务实例
        this.logger.warn('Qiniu service: bucket parameter ignored, using default config', {
            requestedBucket: bucket,
            defaultBucket: this.config.bucket,
        });
        return this.config;
    }
    /**
     * 上传文件到七牛云
     *
     * @param filePath 文件的本地路径
     * @param key 文件在七牛云上的存储键名
     * @param bucket 文件存储的七牛云存储空间名称，默认为类内配置的存储空间
     * @returns 返回上传成功的文件键名
     * @throws 当上传失败时，抛出 ApiException 异常
     */
    async uploadFile(filePath, key, bucket) {
        const finalBucket = this.getBucketString(bucket);
        const formUploader = new qiniu.form_up.FormUploader(this.qiniuConfig);
        const putExtra = new qiniu.form_up.PutExtra();
        const uploadToken = await this.uploadToken(bucket);
        new Promise((resolve, reject) => {
            formUploader.putFile(uploadToken, key, filePath, putExtra, (err, body, info) => {
                if (err) {
                    this.logger.error('uploadFile error', err);
                    return reject((0, api_exception_1.apiError)(errors_1.CommonErrorCode.QiniuUploaderError));
                }
                if (info.statusCode === 200) {
                    resolve(body.key);
                }
                else {
                    this.logger.error('uploadFile failed', info);
                    reject((0, api_exception_1.apiError)(errors_1.CommonErrorCode.QiniuUploaderError));
                }
            });
        });
    }
    async getFileInfo(fileKey, bucket) {
        const finalBucket = this.getBucketString(bucket);
        return await this.bucketManager.stat(finalBucket, fileKey);
    }
    async changeFileMime(fileKey, newMime, bucket) {
        const finalBucket = this.getBucketString(bucket);
        return await this.bucketManager.changeMime(finalBucket, fileKey, newMime);
    }
    async changeFileHeaders(fileKey, headers, bucket) {
        const finalBucket = this.getBucketString(bucket);
        return await this.bucketManager.changeHeaders(finalBucket, fileKey, headers);
    }
    // newType = 0 表示普通存储，
    // 1 表示低频存储
    // 2 表示归档存储
    // 3 表示深度归档存储
    // 4 表示归档直读存储
    async changeType(fileKey, newType, bucket) {
        const finalBucket = this.getBucketString(bucket);
        return await this.bucketManager.changeType(finalBucket, fileKey, newType);
    }
    async moveFile(fileKey, bucket, destBucket, destKey, options) {
        const oldBucket = this.getBucketString(bucket);
        const newBucket = this.getBucketString(bucket);
        return await this.bucketManager.move(oldBucket, fileKey, newBucket, destKey || fileKey, options);
    }
    async copyFile(fileKey, bucket, destBucket, destKey, options) {
        const oldBucket = this.getBucketString(bucket);
        const newBucket = this.getBucketString(bucket);
        return await this.bucketManager.copy(oldBucket, fileKey, newBucket, destKey || fileKey, options);
    }
    async deleteFile(fileKey, bucket) {
        const finalBucket = this.getBucketString(bucket);
        const { data, resp } = await this.bucketManager.delete(finalBucket, fileKey);
        if (!resp || resp.statusCode !== 200) {
            this.logger.warn('deleteFile fail', fileKey, bucket, data);
            return false;
        }
        this.logger.warn('deleteFile success', resp);
        return true;
    }
    /**
     * 列出指定前缀的文件列表
     *
     * @param prefix 文件名前缀，默认为空字符串
     * @param limit 最多返回的文件数量，默认为1000
     * @param delimiter 用于限制目录层次的分隔符，默认为空字符串
     * @param bucket 存储桶名称，默认为当前实例的存储桶
     * @param options 其他可选参数
     * @returns 返回一个Promise，解析后得到包含文件名的字符串数组
     * @throws 当请求失败时，抛出ApiException异常
     */
    async listFilesPrefix(prefix, limit, delimiter, bucket, options) {
        const finalBucket = this.getBucketString(bucket);
        options = options || {};
        prefix = folder_util_1.default.ensurePrefixEndsWithSlash(prefix);
        options = {
            ...options,
            prefix,
            delimiter,
            limit: limit || 1000,
        };
        const { data, resp } = await this.bucketManager.listPrefix(finalBucket, options);
        if (!resp || resp.statusCode !== 200) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.BatchDeleteFolderFail);
        }
        const files = data.items.map((item) => item.key);
        return files;
    }
    /**
     * 从指定URL获取资源并存储到七牛云存储的指定Bucket中
     *
     * @param resUrl 资源URL
     * @param fileKey 文件在Bucket中的键名
     * @param bucket 存储Bucket的名称，默认为当前实例配置的Bucket
     * @returns 返回一个Promise，解析为FetchObjectResult类型的七牛云HTTP响应包装对象
     */
    async fetchToBucket(resUrl, fileKey, bucket) {
        const finalBucket = this.getBucketString(bucket);
        const { data, resp } = await this.bucketManager.fetch(resUrl, finalBucket, fileKey);
        if (!resp || resp.statusCode !== 200) {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.BatchDeleteFolderFail);
        }
        this.logger.info('fetchToBucket Qiniu success', data);
        return data;
    }
    // 更新镜像空间中存储的文件内容
    /**
     * 更新镜像副本
     * @see https://developer.qiniu.com/kodo/api/1293/prefetch
     *
     * @param bucket 空间名称
     * @param key 文件名称
     */
    async prefetch(fileKey, bucket) {
        const finalBucket = this.getBucketString(bucket);
        return await this.bucketManager.prefetch(finalBucket, fileKey);
    }
    /**
     * 批量文件管理请求，支持stat，chgm，chtype，delete，copy，move
     * @param operations
     *
     * --- 批量获取文件信息:qiniu.rs.statOp
     * const statOperations = [
     *      qiniu.rs.statOp(srcBucket, 'qiniu1.mp4'),
     * ];
     * --- 批量修改文件类型:qiniu.rs.changeMimeOp
     * const chgmOperations = [
     *      qiniu.rs.changeMimeOp(srcBucket, 'qiniu1.mp4', 'video/x-mp4'),
     * ];
     * --- 批量删除文件:qiniu.rs.deleteOp
     * const deleteOperations = [
     *      qiniu.rs.deleteOp(srcBucket, 'qiniu1.mp4'),
     * ];
     * --- 批量复制文件:qiniu.rs.copyOp
     * const copyOperations = [
     *      qiniu.rs.copyOp(srcBucket, srcKey, destBucket, 'qiniu1.mp4'),
     * ];
     * --- 批量移动或重命名文件:qiniu.rs.moveOp
     * const moveOperations = [
     *      qiniu.rs.moveOp(srcBucket, 'qiniu1.mp4', destBucket, 'qiniu1_move.mp4'),
     * ];
     * --- 批量更新文件的有效期: qiniu.rs.deleteAfterDaysOp
     * const deleteAfterDaysOperations = [
     *      qiniu.rs.deleteAfterDaysOp(srcBucket, 'qiniu1.mp4', 10),
     * ];
     * --- 批量更新文件存储类型: qiniu.rs.changeTypeOp
     * newType：0 表示普通存储；1 表示低频存储；2 表示归档存储；3 表示深度归档存储；4 表示归档直读存储
     * const changeTypeOperations = [
     *      qiniu.rs.changeTypeOp(srcBucket, 'qiniu1.mp4', 1),
     * ];
     */
    async batch(operations) {
        return await this.bucketManager.batch(operations);
    }
    async batchDeleteFiles(fileKeys, bucket) {
        const finalBucket = this.getBucketString(bucket);
        return await this.batch([
            ...fileKeys.map((key) => {
                return qiniu.rs.deleteOp(finalBucket, key);
            }),
        ]);
    }
    /**
     * @returns 返回操作管理对象
     * 发送持久化数据处理请求
     * @param bucket 空间名称
     * @param key 文件名称
     * @param fops 处理指令集合
     * @param pipeline 处理队列名称
     * @param options
     * @param callback
     * @use pfop(bucket: string, key: string, fops: string[], pipeline: string, options: PfopOptions | null, callback: callback): void;
     *
     * 查询持久化数据处理进度
     * @param persistentId pfop操作返回的持久化处理ID
     * @param callback
     *
     * prefop(persistentId: string, callback: callback): void;
     */
    getOperManager() {
        return this.operManager;
    }
    getCdnManager() {
        return this.cdnManager;
    }
    getConfig() {
        return this.config;
    }
    async getPresignedUrl(bucket, uploadId, key, partNumber) {
        return '';
    }
    async getMultipartUploadId(fileKey, bucket) {
        const finalBucket = this.getBucketString(bucket);
        const host = file_config_1.default.qiniu.uploadUrl;
        const encodedObjectName = fileKey
            ? urlencode_util_1.default.urlsafeBase64Encode(fileKey)
            : '~';
        const uploadToken = this.uploadToken(bucket, {
            scope: finalBucket,
        });
        const headers = {
            Authorization: 'UpToken ' + uploadToken,
            'Content-Type': 'application/json',
        };
        const requestUrl = host +
            '/buckets/' +
            finalBucket +
            '/objects/' +
            encodedObjectName +
            '/uploads';
        const ret = await (0, rxjs_1.firstValueFrom)(this.httpService.post(requestUrl, {}, { headers }));
        // if (ret.statusCode !== 200) {
        //     throw new ApiException('onitiateMultipartUploadError')
        // }
        return ret.data.uploadId;
    }
    getBucketString(bucket) {
        const defaultBucket = this.config.bucket;
        const finalBucket = bucket ?? defaultBucket;
        return finalBucket;
    }
    getQiniuZone() {
        const qiniuZones = {
            z0: qiniu.zone.Zone_z0,
            cn_east_2: qiniu.zone.Zone_cn_east_2,
            z1: qiniu.zone.Zone_z1,
            z2: qiniu.zone.Zone_z2,
            na0: qiniu.zone.Zone_na0,
            as0: qiniu.zone.Zone_as0,
        };
        return qiniuZones[this.config.region];
    }
    async listBuckets() { }
    async fileDownloader(source) { }
    async fileUploader(buffer, destination) { }
    async completeMultipartUpload(uploadId, key, parts, bucket) { }
    callbackValidate(requestURI, reqBody, callbackAuth) {
        return qiniu.util.isQiniuCallback(this.mac, requestURI, reqBody, callbackAuth);
    }
    async makeZipWithKeys(files, zipName, bucket) {
        const finalBucket = this.getBucketString(bucket);
        const names = [];
        const content = files
            .map(async (file) => {
            // 拼接原始url
            // 链接加密并进行Base64编码，别名去除前缀目录。
            const { name, key, ext } = file.fileKey;
            names.push(name);
            const url = await this.getPrivateDownloadUrl(key, undefined, undefined, finalBucket);
            const safeUrl = `/url/${urlencode_util_1.default.urlsafeBase64Encode(url)}` +
                `/alias/${urlencode_util_1.default.urlsafeBase64Encode(name)}`;
            return safeUrl;
        })
            .join('\n');
        const formUploader = new qiniu.form_up.FormUploader(this.qiniuConfig);
        const putExtra = new qiniu.form_up.PutExtra();
        const key = `${Date.now()}-${~~(Math.random() * 1000)}.txt`;
        const uploaderToken = await this.uploadToken();
        const { data, resp } = await formUploader.put(uploaderToken, key, content, putExtra);
        if (resp.statusCode == 200) {
            const { key } = data;
            // 执行压缩 ，设置压缩资源的在OSS上的保存路径
            const zipKey = urlencode_util_1.default.urlsafeBase64Encode(`${finalBucket}:temp_package/${Date.now()}/${zipName}.zip`);
            const fops = `mkzip/4/encoding/${urlencode_util_1.default.urlsafeBase64Encode('gbk')}|saveas/${zipKey}`;
            // const operManager = new qiniu.fop.OperationManager(
            //     this.mac,
            //     this.qiniuConfig,
            // )
            const pipeline = ''; // 使用公共队列
            // 下行。不知用处
            const options = { force: false };
            const persistentId = await this.pfopFops(key, fops, pipeline, options, finalBucket);
            // 这里只返回任务id，转由客户端发请求查询
            return persistentId;
        }
        else {
            throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.QiniuZipDownloadError);
        }
    }
    /**
     * 执行pfop的fops操作
     *
     * @param key 文件对象在存储桶中的键（文件名）
     * @param fops 操作的fops数组
     * @param pipeline 使用的管道名称
     * @param options 额外的请求选项
     * @param bucket 指定的存储桶名称，默认为当前实例的存储桶
     * @returns 返回Promise，解析为字符串类型的任务ID
     * @throws 如果执行过程中出现错误，则抛出异常
     */
    async pfopFops(key, fops, pipeline, options, bucket) {
        const finalBucket = this.getBucketString(bucket);
        return new Promise((res) => {
            this.operManager.pfop(finalBucket, key, [fops], pipeline, options, (err, data, resp) => {
                if (err) {
                    throw err;
                }
                if (resp.statusCode == 200) {
                    // 这里只返回任务id，转由客户端发请求查询
                    res(data.persistentId);
                }
                else {
                    console.log(resp.statusCode);
                    console.log(data);
                }
            });
        });
    }
    /**
     * 查询Fop任务完成状态
     * @param {string} persistentId
     * @returns
     */
    async queryFopStatus(persistentId) {
        return new Promise((res) => {
            this.operManager.prefop(persistentId, (err, data, resp) => {
                if (err) {
                    console.log(err);
                    throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.QiniuQueryFopStatusError);
                }
                if (resp.statusCode == 200) {
                    const item = data.items[0];
                    // const { code, key } = item
                    // res({ code, key })
                    res(item);
                }
                else {
                    console.log(resp.statusCode);
                    console.log(data);
                }
            });
        });
    }
}
exports.FileQiniuClient = FileQiniuClient;
//# sourceMappingURL=file-qiniu.client.js.map