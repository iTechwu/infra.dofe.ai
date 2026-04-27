"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrClient = void 0;
/**
 * OCR Internal Client
 *
 * 职责：仅负责与本地 OCR 服务通信
 * - 调用 127.0.0.1:8004/api/ocr 提取文本
 * - 不访问数据库
 * - 不包含业务逻辑
 */
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const rxjs_1 = require("rxjs");
let OcrClient = class OcrClient {
    httpService;
    logger;
    config;
    constructor(httpService, logger) {
        this.httpService = httpService;
        this.logger = logger;
        this.config = {
            baseUrl: process.env.OCR_SERVICE_URL || 'http://127.0.0.1:8004',
            timeout: parseInt(process.env.OCR_TIMEOUT || '60000', 10),
        };
        this.logger.info(`OcrClient initialized with base URL: ${this.config.baseUrl}`);
    }
    /**
     * 提取文件文本内容
     * @param fileUrl 文件 URL
     * @param fileType 文件类型 (pdf, docx, doc, png, jpg, jpeg, etc.)
     * @param options 可选参数
     */
    async extractText(fileUrl, fileType, options) {
        const request = {
            fileUrl,
            fileType,
            extractPages: options?.extractPages ?? false,
            language: options?.language ?? 'auto',
        };
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.config.baseUrl}/api/ocr`, request, {
                timeout: this.config.timeout,
                headers: {
                    'Content-Type': 'application/json',
                },
            }));
            this.logger.debug(`OCR extraction completed for ${fileUrl}, confidence: ${response.data.confidence}`);
            return response.data;
        }
        catch (error) {
            this.logger.error(`OCR extraction failed for ${fileUrl}: ${error.message}`);
            throw new Error(`OCR extraction failed: ${error.message}`);
        }
    }
    /**
     * 批量提取文件文本
     * @param files 文件列表
     */
    async extractTextBatch(files) {
        const results = [];
        for (const file of files) {
            try {
                const result = await this.extractText(file.fileUrl, file.fileType);
                results.push(result);
            }
            catch (error) {
                results.push({
                    error: error.message,
                    fileUrl: file.fileUrl,
                });
            }
        }
        return results;
    }
    /**
     * 检查 OCR 服务健康状态
     */
    async healthCheck() {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.config.baseUrl}/health`, {
                timeout: 5000,
            }));
            return response.status === 200;
        }
        catch {
            return false;
        }
    }
};
exports.OcrClient = OcrClient;
exports.OcrClient = OcrClient = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [axios_1.HttpService,
        winston_1.Logger])
], OcrClient);
//# sourceMappingURL=ocr.client.js.map