"use strict";
/**
 * OCR 服务 DTO 定义
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrBatchResultSchema = exports.OcrBatchRequestSchema = exports.OcrRequestSchema = exports.OcrResultSchema = exports.OcrPageSchema = exports.OcrBlockSchema = void 0;
const zod_1 = require("zod");
// OCR Block Schema
exports.OcrBlockSchema = zod_1.z.object({
    text: zod_1.z.string(),
    confidence: zod_1.z.number(),
    boundingBox: zod_1.z.array(zod_1.z.number()).optional(),
});
// OCR Page Schema
exports.OcrPageSchema = zod_1.z.object({
    pageNumber: zod_1.z.number(),
    text: zod_1.z.string(),
    blocks: zod_1.z.array(exports.OcrBlockSchema).optional(),
});
// OCR Result Schema
exports.OcrResultSchema = zod_1.z.object({
    text: zod_1.z.string(),
    confidence: zod_1.z.number(),
    pages: zod_1.z.array(exports.OcrPageSchema).optional(),
    fileType: zod_1.z.string().optional(),
    processingTime: zod_1.z.number().optional(),
});
// OCR Request Schema
exports.OcrRequestSchema = zod_1.z.object({
    fileUrl: zod_1.z.string(),
    fileType: zod_1.z.string(),
    extractPages: zod_1.z.boolean().optional(),
    language: zod_1.z.string().optional(),
});
// OCR Batch Request Schema
exports.OcrBatchRequestSchema = zod_1.z.object({
    files: zod_1.z.array(exports.OcrRequestSchema),
});
// OCR Batch Result Schema
exports.OcrBatchResultSchema = zod_1.z.object({
    results: zod_1.z.array(zod_1.z.union([
        exports.OcrResultSchema,
        zod_1.z.object({ error: zod_1.z.string(), fileUrl: zod_1.z.string() }),
    ])),
    successCount: zod_1.z.number(),
    failCount: zod_1.z.number(),
});
//# sourceMappingURL=ocr.dto.js.map