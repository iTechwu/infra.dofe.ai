/**
 * OCR 服务 DTO 定义
 */
import { z } from 'zod';
export declare const OcrBlockSchema: any;
export declare const OcrPageSchema: any;
export declare const OcrResultSchema: any;
export declare const OcrRequestSchema: any;
export declare const OcrBatchRequestSchema: any;
export declare const OcrBatchResultSchema: any;
export type OcrBlock = z.infer<typeof OcrBlockSchema>;
export type OcrPage = z.infer<typeof OcrPageSchema>;
export type OcrResult = z.infer<typeof OcrResultSchema>;
export type OcrRequest = z.infer<typeof OcrRequestSchema>;
export type OcrBatchRequest = z.infer<typeof OcrBatchRequestSchema>;
export type OcrBatchResult = z.infer<typeof OcrBatchResultSchema>;
