/**
 * @fileoverview 流式语音识别服务模块
 *
 * 本模块提供流式语音识别服务的 NestJS 模块配置。
 *
 * @module streaming-asr/module
 */
/**
 * 流式语音识别服务模块
 *
 * @description 提供流式语音识别服务的依赖注入配置。
 *
 * 导出服务：
 * - `StreamingAsrService`: 流式语音识别服务
 *
 * 依赖模块：
 * - `ConfigModule`: 配置服务
 * - `MeetingServiceModule`: 会议服务（用于保存转写结果）
 *
 * @example
 * ```typescript
 * // 在其他模块中导入
 * @Module({
 *   imports: [StreamingAsrServiceModule],
 * })
 * export class StreamingAsrApiModule {}
 *
 * // 在服务中使用
 * @Injectable()
 * class StreamingAsrController {
 *   constructor(private readonly streamingAsr: StreamingAsrService) {}
 * }
 * ```
 */
export declare class StreamingAsrServiceModule {
}
