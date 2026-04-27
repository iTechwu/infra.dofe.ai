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
exports.SmsClientFactory = exports.SmsService = exports.SmsServiceModule = void 0;
// Module
var sms_module_1 = require("./sms.module");
Object.defineProperty(exports, "SmsServiceModule", { enumerable: true, get: function () { return sms_module_1.SmsServiceModule; } });
// Service
var sms_service_1 = require("./sms.service");
Object.defineProperty(exports, "SmsService", { enumerable: true, get: function () { return sms_service_1.SmsService; } });
// Factory
var sms_factory_1 = require("./sms.factory");
Object.defineProperty(exports, "SmsClientFactory", { enumerable: true, get: function () { return sms_factory_1.SmsClientFactory; } });
// Types (从 types.ts 导出，包含来自 @app/clients/internal/sms 的 re-exports)
__exportStar(require("./types"), exports);
//# sourceMappingURL=index.js.map