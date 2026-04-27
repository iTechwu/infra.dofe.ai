import { Logger } from 'winston';
import { BatchOpsResult, DoFeUploader } from './dto/file.dto';
import * as qiniu from 'qiniu';
import { HttpService } from '@nestjs/axios';
import { DoFeApp } from "../../../../common/src/config/dto/config.dto";
import { StorageCredentialsConfig, AppConfig } from "../../../../common/src/config/validation";
import { FileStorageInterface } from './file-storage.interface';
import { RedisService } from "../../../../redis/src";
/**
 * Qiniu File Storage Client
 *
 * 职责：仅负责与七牛云存储 API 通信
 * - 不访问数据库
 * - 不包含业务逻辑
 */
export declare class FileQiniuClient implements FileStorageInterface {
    private mac;
    private qiniuConfig;
    private bucketManager;
    private operManager;
    private cdnManager;
    private logger;
    config: DoFeUploader.Config;
    storageConfig: StorageCredentialsConfig;
    appConfig: AppConfig;
    redis: RedisService;
    protected httpService: HttpService;
    /**
     * 构造函数，用于创建AppFile类的实例
     *
     */
    constructor(config: DoFeUploader.Config, storageConfig: StorageCredentialsConfig, appConfig: AppConfig, redis: RedisService, httpService: HttpService, logger: Logger);
    /**
     * 上传凭证生成函数
     *
     * @param scope 空间名，可选参数，默认为配置中的 bucket
     * @param options PutPolicyOptions 对象，可选参数，用于设置上传凭证的回调等选项，默认为配置中的 webhook 和 callbackBody 等信息
     * @returns 返回生成的上传凭证字符串
     */
    uploadTokenWithCallback(callbackAuthKey?: string, scope?: string, options?: qiniu.rs.PutPolicyOptions, neeSpiltPart?: boolean): Promise<string>;
    uploadToken(scope?: string, options?: qiniu.rs.PutPolicyOptions): Promise<string>;
    setFileContentDisposition(fileKey: string, bucket?: string): Promise<void>;
    /**
     * 文件数据上传器
     *
     * @param fileData 文件数据流
     * @param key 文件在七牛云上的存储键名
     * @param bucket 文件存储的七牛云存储空间名称，默认为类内配置的存储空间
     * @returns 返回上传成功的文件键名
     * @throws 当上传失败时，抛出 ApiException 异常
     */
    fileDataUploader(base64Data: string, key: string, qbucket?: string): Promise<void>;
    getPrivateDownloadUrl(fileKey: string, expire?: number, internal?: boolean, bucket?: string): Promise<string>;
    /**
     * 获取指定 bucket 的配置（辅助方法）
     * 注意：七牛云服务通常一个实例对应一个 bucket，此方法用于兼容接口
     */
    private getBucketConfig;
    /**
     * 上传文件到七牛云
     *
     * @param filePath 文件的本地路径
     * @param key 文件在七牛云上的存储键名
     * @param bucket 文件存储的七牛云存储空间名称，默认为类内配置的存储空间
     * @returns 返回上传成功的文件键名
     * @throws 当上传失败时，抛出 ApiException 异常
     */
    uploadFile(filePath: string, key: string, bucket?: string): Promise<void>;
    getFileInfo(fileKey: string, bucket?: string): Promise<any>;
    changeFileMime(fileKey: string, newMime: string, bucket?: string): Promise<qiniu.httpc.ResponseWrapper<void>>;
    changeFileHeaders(fileKey: string, headers: {
        [key: string]: any;
    }, bucket?: string): Promise<qiniu.httpc.ResponseWrapper<void>>;
    changeType(fileKey: string, newType: number, bucket?: string): Promise<qiniu.httpc.ResponseWrapper<void>>;
    moveFile(fileKey: string, bucket?: string, destBucket?: string, destKey?: string, options?: {
        force?: boolean;
    } | null): Promise<qiniu.httpc.ResponseWrapper<void>>;
    copyFile(fileKey: string, bucket?: string, destBucket?: string, destKey?: string, options?: {
        force?: boolean;
    } | null): Promise<qiniu.httpc.ResponseWrapper<void>>;
    deleteFile(fileKey: string, bucket?: string): Promise<boolean>;
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
    listFilesPrefix(prefix?: string, limit?: number, delimiter?: string, bucket?: string, options?: any): Promise<string[]>;
    /**
     * 从指定URL获取资源并存储到七牛云存储的指定Bucket中
     *
     * @param resUrl 资源URL
     * @param fileKey 文件在Bucket中的键名
     * @param bucket 存储Bucket的名称，默认为当前实例配置的Bucket
     * @returns 返回一个Promise，解析为FetchObjectResult类型的七牛云HTTP响应包装对象
     */
    fetchToBucket(resUrl: string, fileKey: string, bucket?: string): Promise<any>;
    /**
     * 更新镜像副本
     * @see https://developer.qiniu.com/kodo/api/1293/prefetch
     *
     * @param bucket 空间名称
     * @param key 文件名称
     */
    prefetch(fileKey: string, bucket?: string): Promise<qiniu.httpc.ResponseWrapper<void>>;
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
    batch(operations: any): Promise<qiniu.httpc.ResponseWrapper<BatchOpsResult>>;
    batchDeleteFiles(fileKeys: string[], bucket?: string): Promise<qiniu.httpc.ResponseWrapper<BatchOpsResult>>;
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
    getOperManager(): qiniu.fop.OperationManager;
    getCdnManager(): qiniu.cdn.CdnManager;
    getConfig(): DoFeUploader.Config;
    getPresignedUrl(bucket?: string, uploadId?: string, key?: string, partNumber?: number): Promise<string>;
    getMultipartUploadId(fileKey: string, bucket?: string): Promise<string>;
    getBucketString(bucket?: string): any;
    getQiniuZone(): any;
    listBuckets(): Promise<void>;
    fileDownloader(source: DoFeApp.FileBase): Promise<void>;
    fileUploader(buffer: Buffer, destination: DoFeApp.FileBase): Promise<void>;
    completeMultipartUpload(uploadId: string, key: string, parts: {
        ETag: string;
        PartNumber: number;
    }[], bucket?: string): Promise<void>;
    callbackValidate(requestURI: string, reqBody: string | null, callbackAuth: string): boolean;
    makeZipWithKeys(files: Partial<FileSystem & any>[], zipName: string, bucket?: string): Promise<string>;
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
    pfopFops(key: any, fops: any, pipeline: any, options: any, bucket?: string): Promise<string>;
    /**
     * 查询Fop任务完成状态
     * @param {string} persistentId
     * @returns
     */
    queryFopStatus(persistentId: string): Promise<any>;
}
