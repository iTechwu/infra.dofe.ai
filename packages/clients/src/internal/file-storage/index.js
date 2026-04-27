"use strict";
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
exports.FileUs3Client = exports.FileTosClient = exports.FileGcsClient = exports.FileQiniuClient = exports.FileS3Client = void 0;
/**
 * File Storage Clients
 *
 * 纯文件存储 API 客户端集合
 * - 不访问数据库
 * - 不包含业务逻辑
 */
var file_s3_client_1 = require("./file-s3.client");
Object.defineProperty(exports, "FileS3Client", { enumerable: true, get: function () { return file_s3_client_1.FileS3Client; } });
var file_qiniu_client_1 = require("./file-qiniu.client");
Object.defineProperty(exports, "FileQiniuClient", { enumerable: true, get: function () { return file_qiniu_client_1.FileQiniuClient; } });
var file_gcs_client_1 = require("./file-gcs.client");
Object.defineProperty(exports, "FileGcsClient", { enumerable: true, get: function () { return file_gcs_client_1.FileGcsClient; } });
var file_tos_client_1 = require("./file-tos.client");
Object.defineProperty(exports, "FileTosClient", { enumerable: true, get: function () { return file_tos_client_1.FileTosClient; } });
var file_us3_client_1 = require("./file-us3.client");
Object.defineProperty(exports, "FileUs3Client", { enumerable: true, get: function () { return file_us3_client_1.FileUs3Client; } });
// Re-export DTO types
__exportStar(require("./dto/file.dto"), exports);
//# sourceMappingURL=index.js.map