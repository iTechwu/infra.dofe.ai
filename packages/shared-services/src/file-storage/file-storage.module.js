"use strict";
/**
 * @fileoverview 文件存储服务模块
 *
 * 本模块提供文件存储服务的 NestJS 模块配置，整合了：
 * - FileStorageService: 文件存储服务门面
 * - FileStorageClientFactory: 客户端工厂
 * - BucketResolver: 存储桶解析器
 *
 * @module file-storage/module
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileStorageServiceModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const ip_geo_1 = require("../ip-geo");
const redis_1 = require("../../../redis/src");
const file_storage_service_1 = require("./file-storage.service");
const file_storage_factory_1 = require("./file-storage.factory");
const bucket_resolver_1 = require("./bucket-resolver");
/**
 * 文件存储服务模块
 *
 * @description 提供文件存储服务的依赖注入配置。
 *
 * 导出服务：
 * - `FileStorageService`: 文件存储服务统一入口
 * - `FileStorageClientFactory`: 客户端工厂（可选，用于高级场景）
 * - `BucketResolver`: 存储桶解析器（可选，用于高级场景）
 *
 * 依赖模块：
 * - `ConfigModule`: 配置服务
 * - `HttpModule`: HTTP 客户端
 * - `RedisModule`: Redis 缓存
 * - `IpGeoModule`: IP 地理位置服务（用于区域感知，纯 infra 层）
 *
 * @example
 * ```typescript
 * // 在其他模块中导入
 * @Module({
 *   imports: [FileStorageServiceModule],
 * })
 * export class VideoModule {}
 *
 * // 在服务中使用
 * @Injectable()
 * class VideoService {
 *   constructor(private readonly fileStorage: FileStorageService) {}
 *
 *   async upload(file: Buffer, key: string) {
 *     const client = await this.fileStorage.getFileClient('oss', 'my-bucket');
 *     await client.fileUploader(file, { key, bucket: 'my-bucket' });
 *   }
 * }
 * ```
 */
let FileStorageServiceModule = class FileStorageServiceModule {
};
exports.FileStorageServiceModule = FileStorageServiceModule;
exports.FileStorageServiceModule = FileStorageServiceModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, redis_1.RedisModule, ip_geo_1.IpGeoModule, axios_1.HttpModule],
        providers: [bucket_resolver_1.BucketResolver, file_storage_factory_1.FileStorageClientFactory, file_storage_service_1.FileStorageService],
        exports: [file_storage_service_1.FileStorageService, file_storage_factory_1.FileStorageClientFactory, bucket_resolver_1.BucketResolver],
    })
], FileStorageServiceModule);
//# sourceMappingURL=file-storage.module.js.map