"use strict";
/**
 * @fileoverview SMS Service Type Definitions
 * @module @app/shared-services/sms/types
 *
 * 定义 SMS 服务的所有类型接口，包括：
 * - 短信客户端接口
 * - 配置类型
 * - 发送选项和结果
 * - 模板管理类型
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyCodeResult = exports.DEFAULT_CODE_EXPIRE = exports.DEFAULT_SEND_FREQUENCY = exports.DEVICE_SEND_LOGGER_KEY = exports.SMS_VENDOR_NAMES = void 0;
/**
 * SMS 供应商显示名称映射
 */
exports.SMS_VENDOR_NAMES = {
    aliyun: '阿里云',
    tencent: '腾讯云',
    http: 'HTTP接口',
    zxjcsms: '中讯金昌',
    volcengine: '火山引擎',
};
// ============================================================================
// 设备发送日志类型
// ============================================================================
/**
 * 设备发送日志 Redis Key 前缀
 */
exports.DEVICE_SEND_LOGGER_KEY = 'mobileCodeDevice';
/**
 * 默认发送频率限制（秒）
 */
exports.DEFAULT_SEND_FREQUENCY = 30;
/**
 * 默认验证码过期时间（秒）
 */
exports.DEFAULT_CODE_EXPIRE = 300;
// ============================================================================
// Re-exports
// ============================================================================
var sms_1 = require("../../../clients/src/internal/sms");
Object.defineProperty(exports, "VerifyCodeResult", { enumerable: true, get: function () { return sms_1.VerifyCodeResult; } });
//# sourceMappingURL=types.js.map