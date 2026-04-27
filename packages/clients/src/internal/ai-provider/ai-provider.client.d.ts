import { HttpService } from '@nestjs/axios';
import { Logger } from 'winston';
import type { ProviderVendor, ProviderApiType } from "@repo/contracts";
export interface VerifyKeyOptions {
    vendor: ProviderVendor;
    secret: string;
    baseUrl?: string;
    apiType?: ProviderApiType;
}
export interface ProviderModel {
    id: string;
    owned_by?: string;
}
export interface VerifyKeyResult {
    valid: boolean;
    latency?: number;
    error?: string;
    models?: ProviderModel[];
}
export declare class AIProviderClient {
    private readonly httpService;
    private readonly logger;
    constructor(httpService: HttpService, logger: Logger);
    /**
     * Verify an API key and get available models
     */
    verifyKey(options: VerifyKeyOptions): Promise<VerifyKeyResult>;
    /**
     * Verify an OpenAI-compatible API key
     */
    private verifyOpenAICompatible;
    /**
     * Verify an Anthropic API key
     */
    private verifyAnthropic;
    /**
     * Verify a Google Gemini API key
     * Uses header-based authentication to avoid exposing API key in URL
     */
    private verifyGemini;
    /**
     * Normalize model ID by removing common prefixes
     * Handles formats like:
     * - models/gemini-1.5-pro
     * - gemini-1.5-pro
     * - publishers/google/models/gemini-1.5-pro
     */
    private normalizeModelId;
    /**
     * Extract error message from Axios error
     */
    private extractErrorMessage;
    /**
     * Verify an Azure OpenAI API key
     * Azure OpenAI requires deployment-specific endpoints
     */
    private verifyAzureOpenAI;
    /**
     * Get known AWS Bedrock models
     * Bedrock requires AWS SigV4 auth, so we return known models
     */
    private getBedrockModels;
    /**
     * Get known Google Vertex AI models
     * Vertex AI requires GCP auth, so we return known models
     */
    private getVertexAIModels;
    /**
     * Verify AWS Bedrock credentials
     * Supports two formats:
     * 1. For third-party proxies (like OpenRouter): Simple API key
     * 2. For native AWS: access_key_id:secret_access_key[:region]
     */
    private verifyBedrock;
    /**
     * Verify Google Vertex AI credentials
     * Supports API key authentication
     */
    private verifyVertexAI;
}
