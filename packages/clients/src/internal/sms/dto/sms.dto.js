"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyCodeResult = exports.AppSmsConfigSchema = exports.SmsProviderConfigSchema = exports.SmsVolcengineTemplateSchema = exports.SmsHttpTemplateSchema = exports.SmsZxjcTemplateSchema = exports.SmsDefaultTemplateSchema = void 0;
const zod_1 = require("zod");
const SmsVendorSchema = zod_1.z.enum([
    'tencent',
    'aliyun',
    'zxjcsms',
    'http',
    'volcengine',
]);
exports.SmsDefaultTemplateSchema = zod_1.z.object({
    name: zod_1.z.string(),
    sign: zod_1.z.string(),
    templateCode: zod_1.z.string().optional(),
    frequency: zod_1.z.number(),
    codeExpire: zod_1.z.number(),
});
exports.SmsZxjcTemplateSchema = zod_1.z.object({
    apName: zod_1.z.string(),
    apPassword: zod_1.z.string(),
    content: zod_1.z.string(),
    srcId: zod_1.z.string().optional(),
    serviceId: zod_1.z.string().optional(),
    sendTime: zod_1.z.string().optional(),
});
exports.SmsHttpTemplateSchema = zod_1.z.object({
    name: zod_1.z.string(),
    sign: zod_1.z.string(),
    content: zod_1.z.string(),
    frequency: zod_1.z.number(),
    codeExpire: zod_1.z.number(),
    extend: zod_1.z.string().optional(),
});
exports.SmsVolcengineTemplateSchema = zod_1.z.object({
    name: zod_1.z.string(),
    sign: zod_1.z.string(),
    smsAccount: zod_1.z.string(),
    templateId: zod_1.z.string(),
    tag: zod_1.z.string().optional(),
    userExtCode: zod_1.z.string().optional(),
    scene: zod_1.z.string().optional(),
    codeType: zod_1.z.number().optional(),
    expireTime: zod_1.z.number().optional(),
    tryCount: zod_1.z.number().optional(),
    frequency: zod_1.z.number(),
    codeExpire: zod_1.z.number(),
});
exports.SmsProviderConfigSchema = zod_1.z.object({
    vendor: SmsVendorSchema,
    accessKey: zod_1.z.string(),
    accessSecret: zod_1.z.string(),
    region: zod_1.z.string().optional(),
    appId: zod_1.z.string().optional(),
    endpoint: zod_1.z.string().optional(),
    url: zod_1.z.string().optional(),
    appKey: zod_1.z.string().optional(),
    appCode: zod_1.z.string().optional(),
    templates: zod_1.z.array(zod_1.z.union([
        exports.SmsDefaultTemplateSchema,
        exports.SmsHttpTemplateSchema,
        exports.SmsVolcengineTemplateSchema,
    ])),
});
exports.AppSmsConfigSchema = zod_1.z.object({
    default: SmsVendorSchema,
    providers: zod_1.z.array(exports.SmsProviderConfigSchema),
});
var VerifyCodeResult;
(function (VerifyCodeResult) {
    VerifyCodeResult["SUCCESS"] = "0";
    VerifyCodeResult["INVALID_CODE"] = "1";
    VerifyCodeResult["EXPIRED"] = "2";
    VerifyCodeResult["USED"] = "3";
    VerifyCodeResult["NOT_FOUND"] = "4";
    VerifyCodeResult["EXCEEDED"] = "5";
})(VerifyCodeResult || (exports.VerifyCodeResult = VerifyCodeResult = {}));
//# sourceMappingURL=sms.dto.js.map