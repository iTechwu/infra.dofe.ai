import { HttpService } from '@nestjs/axios';
import { Logger } from 'winston';
import { OcrResult } from './dto/ocr.dto';
export interface OcrClientConfig {
    baseUrl: string;
    timeout: number;
}
export declare class OcrClient {
    private readonly httpService;
    private readonly logger;
    private readonly config;
    constructor(httpService: HttpService, logger: Logger);
    /**
     * 提取文件文本内容
     * @param fileUrl 文件 URL
     * @param fileType 文件类型 (pdf, docx, doc, png, jpg, jpeg, etc.)
     * @param options 可选参数
     */
    extractText(fileUrl: string, fileType: string, options?: {
        extractPages?: boolean;
        language?: string;
    }): Promise<OcrResult>;
    /**
     * 批量提取文件文本
     * @param files 文件列表
     */
    extractTextBatch(files: Array<{
        fileUrl: string;
        fileType: string;
    }>): Promise<Array<OcrResult | {
        error: string;
        fileUrl: string;
    }>>;
    /**
     * 检查 OCR 服务健康状态
     */
    healthCheck(): Promise<boolean>;
}
