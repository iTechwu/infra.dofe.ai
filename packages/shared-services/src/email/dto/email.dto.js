"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailAccountInputSchema = exports.EmailAccountSchema = exports.SignalMessageSchema = exports.EmailSubValuesSchema = exports.EmailConfigSchema = exports.EmailTemplateSchema = exports.EmailKeysSchema = void 0;
const zod_1 = require("zod");
// ============================================================================
// Email Configuration Schemas
// ============================================================================
exports.EmailKeysSchema = zod_1.z.object({
    accessKey: zod_1.z.string(),
    accessSecret: zod_1.z.string(),
    host: zod_1.z.string(),
    port: zod_1.z.number(),
    secure: zod_1.z.boolean(),
    user: zod_1.z.string(),
    pass: zod_1.z.string(),
});
exports.EmailTemplateSchema = zod_1.z.object({
    name: zod_1.z.string(),
    subject: zod_1.z.string(),
    from: zod_1.z.string(),
    templateInvokeName: zod_1.z.string(),
    codeExpire: zod_1.z.number().optional(),
    frequency: zod_1.z.number().optional(),
    sub: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).nullable().optional(),
});
exports.EmailConfigSchema = zod_1.z.object({
    vendor: zod_1.z.string(),
    apiUser: zod_1.z.string(),
    apiKey: zod_1.z.string(),
    domain: zod_1.z.string(),
    name: zod_1.z.string(),
    templates: zod_1.z.array(exports.EmailTemplateSchema),
});
// ============================================================================
// Email Message Schemas
// ============================================================================
exports.EmailSubValuesSchema = zod_1.z.object({
    name: zod_1.z.string(),
    code: zod_1.z.string(),
});
exports.SignalMessageSchema = zod_1.z.object({
    to: zod_1.z.string().email(),
    subject: zod_1.z.string().optional(),
    templateInvokeName: zod_1.z.string(),
    sub: zod_1.z.record(zod_1.z.string(), zod_1.z.array(zod_1.z.string())),
    options: zod_1.z.any().optional(),
    queueMailId: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
// ============================================================================
// Email Account Schemas
// ============================================================================
exports.EmailAccountSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    name: zod_1.z.string(),
});
exports.EmailAccountInputSchema = exports.EmailAccountSchema.partial();
//# sourceMappingURL=email.dto.js.map