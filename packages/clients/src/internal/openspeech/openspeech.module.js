"use strict";
/**
 * @fileoverview OpenSpeech 语音识别服务模块
 *
 * 本模块提供语音识别服务的 NestJS 模块配置，整合了：
 * - OpenspeechClient: 语音识别服务门面
 * - OpenspeechProviderFactory: 云服务商工厂
 *
 * @module openspeech/module
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenspeechModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const file_storage_1 = require("../../../../shared-services/src/file-storage");
const openspeech_client_1 = require("./openspeech.client");
const openspeech_factory_1 = require("./openspeech.factory");
/**
 * OpenSpeech 语音识别服务模块
 *
 * @description 提供语音识别服务的依赖注入配置。
 *
 * 导出服务：
 * - `OpenspeechClient`: 语音识别服务统一入口
 * - `OpenspeechProviderFactory`: 云服务商工厂（可选，用于高级场景）
 *
 * 依赖模块：
 * - `ConfigModule`: 配置服务
 * - `HttpModule`: HTTP 客户端（用于火山引擎 API）
 * - `FileStorageServiceModule`: 文件存储服务
 *
 * @example
 * ```typescript
 * // 在其他模块中导入
 * @Module({
 *   imports: [OpenspeechModule],
 * })
 * export class VideoModule {}
 *
 * // 在服务中使用
 * @Injectable()
 * class VideoService {
 *   constructor(private readonly openspeech: OpenspeechClient) {}
 *
 *   async transcribe(fileKey: FileKey) {
 *     return await this.openspeech.submitTranscribeTask(fileKey);
 *   }
 * }
 * ```
 */
let OpenspeechModule = class OpenspeechModule {
};
exports.OpenspeechModule = OpenspeechModule;
exports.OpenspeechModule = OpenspeechModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, axios_1.HttpModule, file_storage_1.FileStorageServiceModule],
        providers: [openspeech_factory_1.OpenspeechProviderFactory, openspeech_client_1.OpenspeechClient],
        exports: [openspeech_client_1.OpenspeechClient, openspeech_factory_1.OpenspeechProviderFactory],
    })
], OpenspeechModule);
//# sourceMappingURL=openspeech.module.js.map