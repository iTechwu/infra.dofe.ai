/**
 * @fileoverview OpenSpeech 语音识别服务模块
 *
 * 本模块提供语音识别服务的 NestJS 模块配置，整合了：
 * - OpenspeechClient: 语音识别服务门面
 * - OpenspeechProviderFactory: 云服务商工厂
 *
 * @module openspeech/module
 */
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
export declare class OpenspeechModule {
}
