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
exports.SendCloudService = exports.EmailService = exports.EmailServiceModule = void 0;
var email_module_1 = require("./email.module");
Object.defineProperty(exports, "EmailServiceModule", { enumerable: true, get: function () { return email_module_1.EmailServiceModule; } });
var email_service_1 = require("./email.service");
Object.defineProperty(exports, "EmailService", { enumerable: true, get: function () { return email_service_1.EmailService; } });
// 向后兼容别名
var email_service_2 = require("./email.service");
Object.defineProperty(exports, "SendCloudService", { enumerable: true, get: function () { return email_service_2.EmailService; } });
__exportStar(require("./dto/email.dto"), exports);
//# sourceMappingURL=index.js.map