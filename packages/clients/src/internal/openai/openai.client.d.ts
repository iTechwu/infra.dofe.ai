import { OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Logger } from 'winston';
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface ChatCompletionRequest {
    model: string;
    messages: ChatMessage[];
    max_tokens?: number;
    temperature?: number;
}
export interface ChatCompletionResponse {
    id: string;
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
    }>;
}
export declare class OpenAIClient implements OnModuleInit {
    private readonly httpService;
    private readonly logger;
    private baseUrl;
    private apiKey;
    private openaiConfig;
    constructor(httpService: HttpService, logger: Logger);
    onModuleInit(): void;
    private getAuthHeaders;
    chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    private handleError;
    private extractErrorMessage;
}
