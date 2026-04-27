"use strict";
/**
 * @fileoverview File CDN 类型定义
 *
 * @module file-cdn/dto
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsSignatureV4ParamsSchema = exports.SignedUrlParamsSchema = exports.CdnUrlTypeSchema = exports.CdnRegionSchema = exports.CloudFlareTemplateSchema = exports.ImageTemplateIdSchema = exports.CdnUrlResponseSchema = exports.CdnConfigsSchema = exports.CdnConfigSchema = exports.QueryDataSchema = void 0;
const zod_1 = require("zod");
// CDN Query Data Schema
exports.QueryDataSchema = zod_1.z.object({
    auth: zod_1.z.string(),
});
// CDN Config Schema
exports.CdnConfigSchema = zod_1.z.object({
    url: zod_1.z.string(),
    downloaderUrl: zod_1.z.string(),
    vodUrl: zod_1.z.string(),
    thumbTemplate: zod_1.z.string(),
});
// CDN Configs Schema
exports.CdnConfigsSchema = zod_1.z.object({
    cn: exports.CdnConfigSchema,
    us: exports.CdnConfigSchema,
});
// CDN URL Response Schema
exports.CdnUrlResponseSchema = zod_1.z.object({
    code: zod_1.z.number(),
    message: zod_1.z.string(),
    url: zod_1.z.string(),
});
// Image Template ID Schema
exports.ImageTemplateIdSchema = zod_1.z.union([
    zod_1.z.literal('origin'),
    zod_1.z.literal('preview'),
    zod_1.z.literal('mini'),
    zod_1.z.string(),
]);
// CloudFlare Template Schema
exports.CloudFlareTemplateSchema = zod_1.z.union([
    zod_1.z.literal('360:360:360:360'),
    zod_1.z.literal('183:103:360:360'),
    zod_1.z.literal('origin'),
    zod_1.z.literal('mini'),
    zod_1.z.string(),
]);
// CDN Region Schema
exports.CdnRegionSchema = zod_1.z.enum(['cn', 'us']);
// CDN URL Type Schema
exports.CdnUrlTypeSchema = zod_1.z.enum(['image', 'video', 'download']);
// Signed URL Params Schema
exports.SignedUrlParamsSchema = zod_1.z.object({
    auth: zod_1.z.string().optional(),
    expireIn: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    signature: zod_1.z.string().optional(),
    signedHeaders: zod_1.z.string().optional(),
    signedId: zod_1.z.string().optional(),
    templateId: zod_1.z.string().optional(),
});
// AWS Signature V4 Params Schema
exports.AwsSignatureV4ParamsSchema = zod_1.z.object({
    algorithm: zod_1.z.string(),
    contentSha256: zod_1.z.string(),
    credential: zod_1.z.string(),
    expires: zod_1.z.number(),
    signature: zod_1.z.string(),
    signedHeaders: zod_1.z.string(),
    requestId: zod_1.z.string(),
});
//# sourceMappingURL=file-cdn.dto.js.map