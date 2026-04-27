"use strict";
/**
 * @fileoverview 流式语音识别服务导出
 *
 * 本模块提供流式语音识别的业务服务。
 *
 * 核心功能：
 * - 创建和管理流式识别会话
 * - 实时音频数据传输
 * - 实时识别结果处理
 * - 与会议记录的集成
 *
 * @module streaming-asr
 *
 * @example
 * ```typescript
 * // 导入模块
 * import {
 *   StreamingAsrServiceModule,
 *   StreamingAsrService,
 * } from '@app/shared-services/streaming-asr';
 *
 * // 在 NestJS 模块中使用
 * @Module({
 *   imports: [StreamingAsrServiceModule],
 * })
 * export class MyModule {}
 *
 * // 在服务中注入使用
 * @Injectable()
 * class MyService {
 *   constructor(private readonly streamingAsr: StreamingAsrService) {}
 *
 *   async startSession() {
 *     const session = await this.streamingAsr.createSession({
 *       userId: 'user-uuid',
 *     });
 *     return session;
 *   }
 * }
 * ```
 */
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// 模块导出
__exportStar(require("./streaming-asr.module"), exports);
// 服务导出
__exportStar(require("./streaming-asr.service"), exports);
// 类型导出
__exportStar(require("./types"), exports);
//# sourceMappingURL=index.js.map