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
exports.OpenAIClient = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const rxjs_1 = require("rxjs");
const configuration_1 = require("../../../../common/src/config/configuration");
let OpenAIClient = class OpenAIClient {
    httpService;
    logger;
    baseUrl = '';
    apiKey = '';
    openaiConfig;
    constructor(httpService, logger) {
        this.httpService = httpService;
        this.logger = logger;
    }
    onModuleInit() {
        const keysConfig = (0, configuration_1.getKeysConfig)();
        this.openaiConfig = keysConfig?.openai;
        this.apiKey = this.openaiConfig?.apiKey || '';
        this.baseUrl = this.openaiConfig?.baseUrl || 'https://api.openai.com/v1';
        if (!this.apiKey) {
            this.logger.warn('OpenAI API Key not configured');
        }
        this.logger.info(`OpenAI Client initialized with baseUrl: ${this.baseUrl}`);
    }
    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
        };
    }
    async chatCompletion(request) {
        try {
            this.logger.info('[OpenAI] Calling chat completion', {
                model: request.model,
                messageCount: request.messages.length,
            });
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.baseUrl}/chat/completions`, request, {
                headers: this.getAuthHeaders(),
                timeout: 120000,
            }));
            this.logger.info('[OpenAI] Chat completion successful', {
                model: request.model,
                responseId: response.data.id,
            });
            return response.data;
        }
        catch (error) {
            this.handleError('chatCompletion', error, {
                model: request.model,
            });
        }
    }
    handleError(operation, error, context) {
        const errorMessage = this.extractErrorMessage(error);
        const statusCode = error.response?.status;
        this.logger.error(`OpenAI API Error [${operation}]: ${errorMessage}`, {
            statusCode,
            context,
            responseData: error.response?.data,
        });
        if (statusCode === 401) {
            throw new Error('OpenAI API authentication failed');
        }
        else if (statusCode === 429) {
            throw new Error('OpenAI API rate limit exceeded');
        }
        else if (statusCode === 500) {
            throw new Error(`OpenAI server error: ${errorMessage}`);
        }
        else if (error.code === 'ECONNREFUSED') {
            throw new Error(`Cannot connect to OpenAI server: ${this.baseUrl}`);
        }
        else if (error.code === 'ETIMEDOUT') {
            throw new Error(`OpenAI request timeout: ${operation}`);
        }
        else {
            throw new Error(`OpenAI API error: ${errorMessage}`);
        }
    }
    extractErrorMessage(error) {
        if (error.response?.data) {
            const data = error.response.data;
            return (data.error?.message || data.message || data.error || 'Unknown error');
        }
        return error.message || 'Unknown error';
    }
};
exports.OpenAIClient = OpenAIClient;
exports.OpenAIClient = OpenAIClient = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [axios_1.HttpService,
        winston_1.Logger])
], OpenAIClient);
//# sourceMappingURL=openai.client.js.map