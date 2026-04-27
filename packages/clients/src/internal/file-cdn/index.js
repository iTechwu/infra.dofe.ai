"use strict";
/**
 * @fileoverview File CDN 客户端导出
 *
 * 本模块提供 CDN URL 生成服务的统一封装。
 *
 * 支持的 CDN 供应商：
 * - 火山引擎图片 CDN
 * - CloudFlare 图片优化
 * - 通用文件下载 CDN
 * - 视频点播 CDN
 *
 * @module file-cdn
 *
 * @example
 * ```typescript
 * // 导入模块
 * import { FileCdnModule, FileCdnClient } from '@app/clients/internal/file-cdn';
 *
 * // 在 NestJS 模块中使用
 * @Module({
 *   imports: [FileCdnModule],
 * })
 * export class ImageModule {}
 *
 * // 在服务中注入使用
 * @Injectable()
 * class ImageService {
 *   constructor(private readonly cdnClient: FileCdnClient) {}
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
__exportStar(require("./file-cdn.module"), exports);
// 客户端导出
__exportStar(require("./file-cdn.client"), exports);
// 类型导出
__exportStar(require("./dto/file-cdn.dto"), exports);
//# sourceMappingURL=index.js.map