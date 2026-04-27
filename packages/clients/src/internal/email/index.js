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
exports.SendCloudClient = void 0;
/**
 * Email Clients
 *
 * 纯 Email API 客户端集合
 * - 不访问数据库
 * - 不包含业务逻辑
 */
var sendcloud_client_1 = require("./sendcloud.client");
Object.defineProperty(exports, "SendCloudClient", { enumerable: true, get: function () { return sendcloud_client_1.SendCloudClient; } });
// Re-export DTO types
__exportStar(require("./dto/email.dto"), exports);
//# sourceMappingURL=index.js.map