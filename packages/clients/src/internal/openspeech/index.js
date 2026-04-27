"use strict";
/**
 * @fileoverview OpenSpeech 语音识别服务导出
 *
 * 本模块提供多云服务商语音识别能力的统一封装。
 *
 * 支持的云服务商：
 * - 阿里云 NLS 录音文件识别
 * - 火山引擎大模型录音文件识别
 *
 * @module openspeech
 *
 * @example
 * ```typescript
 * // 导入模块
 * import { OpenspeechModule, OpenspeechClient } from '@app/clients/internal/openspeech';
 *
 * // 在 NestJS 模块中使用
 * @Module({
 *   imports: [OpenspeechModule],
 * })
 * export class MyModule {}
 *
 * // 在服务中注入使用
 * @Injectable()
 * class MyService {
 *   constructor(private readonly openspeech: OpenspeechClient) {}
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
__exportStar(require("./openspeech.module"), exports);
// 客户端导出
__exportStar(require("./openspeech.client"), exports);
// 工厂导出
__exportStar(require("./openspeech.factory"), exports);
// 类型导出
__exportStar(require("./types"), exports);
// 提供商导出（用于高级场景）
__exportStar(require("./providers"), exports);
//# sourceMappingURL=index.js.map