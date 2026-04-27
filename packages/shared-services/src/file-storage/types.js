"use strict";
/**
 * @fileoverview 文件存储服务类型定义
 *
 * 本文件定义了文件存储服务层的核心类型和接口。
 *
 * @module file-storage/types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStorageClientKey = buildStorageClientKey;
/**
 * 构建存储客户端缓存键
 *
 * @param vendor - 存储供应商
 * @param bucket - 存储桶名称
 * @returns 缓存键
 */
function buildStorageClientKey(vendor, bucket) {
    return `${vendor}:${bucket}`;
}
//# sourceMappingURL=types.js.map