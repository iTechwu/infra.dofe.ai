"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchOpsResultSchema = exports.OperationResponseSchema = exports.OperationResponseDataSchema = exports.FetchObjectResultSchema = exports.GetObjectsResultSchema = exports.ListedObjectEntrySchema = exports.PresignedPutUrlObjectSchema = exports.GetObjectOptionsSchema = exports.PutObjectOptionsSchema = exports.DoFeUploaderConfigSchema = exports.FileLocalSchema = exports.FileApiKeySchema = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
// File API Key Schema
exports.FileApiKeySchema = zod_1.z.object({
    accessKey: zod_1.z.string(),
    secretKey: zod_1.z.string(),
});
// File Local Schema
exports.FileLocalSchema = zod_1.z.object({
    lang: zod_1.z.string(),
});
// Config Schema
exports.DoFeUploaderConfigSchema = zod_1.z.object({
    vendor: zod_1.z.nativeEnum(client_1.FileBucketVendor),
    bucket: zod_1.z.string(),
    region: zod_1.z.string(),
    zone: zod_1.z.string().optional(),
    endpoint: zod_1.z.string().optional(),
    internalEndpoint: zod_1.z.string().optional(),
    tosEndpoint: zod_1.z.string().optional(),
    tosInternalEndpoint: zod_1.z.string().optional(),
    domain: zod_1.z.string().optional(),
    cdnKeyName: zod_1.z.string().optional(),
    cdnPrivateKey: zod_1.z.string().optional(),
    webhook: zod_1.z.string().optional(),
    locale: zod_1.z.enum(['en', 'zh-CN', 'cn']).optional(),
    isPublic: zod_1.z.boolean().optional(),
    isDefault: zod_1.z.boolean().optional(),
});
// PutObject Options Schema
exports.PutObjectOptionsSchema = zod_1.z.object({
    acl: zod_1.z.enum(['public-read', 'public-read-write', 'private']).optional(),
    contentType: zod_1.z.string().optional(),
});
// GetObject Options Schema
exports.GetObjectOptionsSchema = zod_1.z.object({
    expiresIn: zod_1.z.number().optional(),
});
// Presigned Put URL Object Schema
exports.PresignedPutUrlObjectSchema = zod_1.z.object({
    url: zod_1.z.string(),
    headers: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
});
// Listed Object Entry Schema
exports.ListedObjectEntrySchema = zod_1.z.object({
    key: zod_1.z.string(),
    putTime: zod_1.z.number(),
    hash: zod_1.z.string(),
    fsize: zod_1.z.number().optional(),
    mimeType: zod_1.z.string(),
    type: zod_1.z.number().optional(),
    endUser: zod_1.z.string().optional(),
    status: zod_1.z.number().optional(),
    md5: zod_1.z.string().optional(),
    parts: zod_1.z.array(zod_1.z.number()).optional(),
});
// GetObjects Result Schema
exports.GetObjectsResultSchema = zod_1.z.object({
    marker: zod_1.z.string().optional(),
    commonPrefixes: zod_1.z.array(zod_1.z.string()).optional(),
    items: zod_1.z.array(exports.ListedObjectEntrySchema),
});
// Fetch Object Result Schema
exports.FetchObjectResultSchema = zod_1.z.object({
    hash: zod_1.z.string(),
    key: zod_1.z.string(),
    fsize: zod_1.z.number().optional(),
    mimeType: zod_1.z.string(),
});
// Operation Response Data Schema
exports.OperationResponseDataSchema = zod_1.z.object({
    error: zod_1.z.string().optional(),
    fsize: zod_1.z.number().optional(),
    hash: zod_1.z.string().optional(),
    mimeType: zod_1.z.string().optional(),
    type: zod_1.z.number().optional(),
    putTime: zod_1.z.number().optional(),
    endUser: zod_1.z.string().optional(),
    restoreStatus: zod_1.z.number().optional(),
    status: zod_1.z.number().optional(),
    md5: zod_1.z.string().optional(),
    expiration: zod_1.z.number().optional(),
    transitionToIA: zod_1.z.number().optional(),
    transitionToARCHIVE: zod_1.z.number().optional(),
    transitionToDeepArchive: zod_1.z.number().optional(),
    transitionToArchiveIR: zod_1.z.number().optional(),
});
// Operation Response Schema
exports.OperationResponseSchema = zod_1.z.object({
    code: zod_1.z.number(),
    data: exports.OperationResponseDataSchema.optional(),
});
// BatchOps Result Schema
exports.BatchOpsResultSchema = zod_1.z.array(exports.OperationResponseSchema);
//# sourceMappingURL=file.dto.js.map