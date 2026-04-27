"use strict";
/**
 * @fileoverview 文件存储服务导出
 *
 * 本模块提供多云存储供应商文件存储能力的统一封装。
 *
 * 支持的存储供应商：
 * - AWS S3 兼容存储
 * - 阿里云 OSS
 * - 火山引擎 TOS
 * - UCloud US3
 * - Google Cloud Storage
 * - 七牛云存储
 *
 * @module file-storage
 *
 * @example
 * ```typescript
 * // 导入模块
 * import {
 *   FileStorageServiceModule,
 *   FileStorageService,
 * } from '@app/shared-services/file-storage';
 *
 * // 在 NestJS 模块中使用
 * @Module({
 *   imports: [FileStorageServiceModule],
 * })
 * export class MyModule {}
 *
 * // 在服务中注入使用
 * @Injectable()
 * class MyService {
 *   constructor(private readonly fileStorage: FileStorageService) {}
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
__exportStar(require("./file-storage.module"), exports);
// 服务导出
__exportStar(require("./file-storage.service"), exports);
// 工厂导出
__exportStar(require("./file-storage.factory"), exports);
// 存储桶解析器导出
__exportStar(require("./bucket-resolver"), exports);
// 类型导出
__exportStar(require("./types"), exports);
//# sourceMappingURL=index.js.map