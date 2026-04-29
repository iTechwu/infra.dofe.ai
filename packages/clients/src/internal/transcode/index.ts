/**
 * Transcode Client
 *
 * 纯转码 Client 模块:
 * - TranscodeStrategyModule/TranscodeStrategyClient - 策略路由
 * - AliyunImmModule/AliyunImmClient - 阿里云 IMM
 * - AliyunOssTranscodeModule/AliyunOssTranscodeClient - 阿里云 OSS
 * - VolcengineTosTranscodeModule/VolcengineTosTranscodeClient - 火山引擎 TOS
 *
 * 注意: 业务逻辑层使用 @app/services/transcode
 */

// 转码策略模块 (纯 Client)
export * from './modules/transcode-strategy/transcode-strategy.module';
export { TranscodeStrategyClient } from './modules/transcode-strategy/transcode-strategy.client';

// 阿里云 OSS 转码模块 (纯 Client)
export * from './modules/aliyun-oss/aliyun-oss-transcode.module';
export {
    AliyunOssTranscodeClient,
    TranscodeOptions,
    SpriteOptions,
    SnapshotOptions,
} from './modules/aliyun-oss/aliyun-oss-transcode.client';

// 阿里云 IMM 模块 (纯 Client)
export * from './modules/aliyun-imm/aliyun-imm.module';
export {
    AliyunImmClient,
    MediaMetaResult,
    MediaConvertTaskResult,
    TaskStatus,
    AudioExtractOptions,
} from './modules/aliyun-imm/aliyun-imm.client';

// 火山引擎 TOS 转码模块 (纯 Client)
export * from './modules/volcengine-tos/volcengine-tos-transcode.module';
export { VolcengineTosTranscodeClient } from './modules/volcengine-tos/volcengine-tos-transcode.client';
export * from './modules/volcengine-tos/volcengine-tos-transcode.dto';

// 工具类和类型
export * from './types/transcode.types';
export * from './utils/file.validator';
export * from './utils/transcode.helper';
export * from './config/transcode.config';
export * from './config/aliyun-oss.config';

// 配置接口
export {
    CloudTranscodeConfig,
    defaultCloudTranscodeConfig,
} from './config/transcode.config';
