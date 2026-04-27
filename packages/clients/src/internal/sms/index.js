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
exports.SmsVolcengineClient = exports.SmsZxjcClient = exports.SmsHttpClient = exports.SmsTencentClient = exports.SmsAliyunClient = void 0;
/**
 * SMS Clients
 *
 * 纯 SMS API 客户端集合
 * - 不访问数据库
 * - 不包含业务逻辑
 */
var sms_aliyun_client_1 = require("./sms-aliyun.client");
Object.defineProperty(exports, "SmsAliyunClient", { enumerable: true, get: function () { return sms_aliyun_client_1.SmsAliyunClient; } });
var sms_tencent_client_1 = require("./sms-tencent.client");
Object.defineProperty(exports, "SmsTencentClient", { enumerable: true, get: function () { return sms_tencent_client_1.SmsTencentClient; } });
var sms_http_client_1 = require("./sms-http.client");
Object.defineProperty(exports, "SmsHttpClient", { enumerable: true, get: function () { return sms_http_client_1.SmsHttpClient; } });
var sms_zxjc_client_1 = require("./sms-zxjc.client");
Object.defineProperty(exports, "SmsZxjcClient", { enumerable: true, get: function () { return sms_zxjc_client_1.SmsZxjcClient; } });
var sms_volcengine_client_1 = require("./sms-volcengine.client");
Object.defineProperty(exports, "SmsVolcengineClient", { enumerable: true, get: function () { return sms_volcengine_client_1.SmsVolcengineClient; } });
// Re-export DTO types
__exportStar(require("./dto/sms.dto"), exports);
//# sourceMappingURL=index.js.map