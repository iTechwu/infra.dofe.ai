import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { firstValueFrom } from 'rxjs';
import type { AxiosError } from 'axios';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import {
  PROVIDER_CONFIGS,
  getProviderDefaultApiHost,
  isProviderVendor,
  isProviderApiType,
} from '@dofe/infra-contracts';
import type {
  ProviderVendor,
  ProviderApiType,
  ProviderConfig,
} from '@dofe/infra-contracts';

/**
 * Timeout configuration for different API operations (in milliseconds)
 */
const TIMEOUT_CONFIG = {
  /** Standard timeout for most API calls (30s) */
  standard: 30000,
  /** Shorter timeout for health checks (15s) */
  healthCheck: 15000,
  /** Longer timeout for cloud providers like Azure/AWS (45s) */
  cloudProvider: 45000,
  /** Extended timeout for model listing with large responses (60s) */
  extended: 60000,
} as const;

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

@Injectable()
export class AIProviderClient {
  constructor(
    private readonly httpService: HttpService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  /**
   * Verify an API key and get available models
   */
  async verifyKey(options: VerifyKeyOptions): Promise<VerifyKeyResult> {
    const { vendor, secret, baseUrl, apiType } = options;
    const startTime = Date.now();

    try {
      // Validate vendor type
      if (!isProviderVendor(vendor)) {
        return { valid: false, error: `Unknown provider: ${vendor}` };
      }

      // Get provider config
      const providerConfig = PROVIDER_CONFIGS[vendor];
      if (!providerConfig) {
        return { valid: false, error: `Provider config not found: ${vendor}` };
      }

      // Determine the API URL
      const effectiveBaseUrl = baseUrl || providerConfig.apiHost;
      if (!effectiveBaseUrl) {
        return { valid: false, error: 'API URL is required' };
      }

      // Determine the API type
      let effectiveApiType: ProviderApiType = apiType ?? providerConfig.apiType;

      // Validate apiType if provided
      if (apiType && !isProviderApiType(apiType)) {
        effectiveApiType = providerConfig.apiType;
        this.logger.warn(
          '[AIProviderClient] Invalid apiType provided, using default',
          {
            provided: apiType,
            default: effectiveApiType,
          },
        );
      }

      // Call the appropriate verification method based on API type
      let models: ProviderModel[] = [];

      switch (effectiveApiType) {
        case 'openai':
        case 'openai-response':
        case 'new-api':
        case 'ollama':
        case 'gateway':
          models = await this.verifyOpenAICompatible(effectiveBaseUrl, secret);
          break;
        case 'anthropic':
          models = await this.verifyAnthropic(effectiveBaseUrl, secret);
          break;
        case 'gemini':
          models = await this.verifyGemini(effectiveBaseUrl, secret);
          break;
        case 'azure-openai':
          models = await this.verifyAzureOpenAI(effectiveBaseUrl, secret);
          break;
        case 'aws-bedrock':
          // AWS Bedrock requires AWS credentials in format: access_key_id:secret_access_key:region
          // or just an API key for third-party proxies
          models = await this.verifyBedrock(effectiveBaseUrl, secret);
          break;
        case 'vertexai':
          // Vertex AI requires GCP API key or service account
          models = await this.verifyVertexAI(effectiveBaseUrl, secret);
          break;
        default:
          // Default to OpenAI-compatible for unknown types
          models = await this.verifyOpenAICompatible(effectiveBaseUrl, secret);
      }

      const latency = Date.now() - startTime;
      this.logger.info('[AIProviderClient] Key verification successful', {
        vendor,
        modelCount: models.length,
        latency,
      });

      return { valid: true, latency, models };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = this.extractErrorMessage(error as AxiosError);

      this.logger.warn('[AIProviderClient] Key verification failed', {
        vendor,
        error: errorMessage,
        latency,
      });

      return { valid: false, latency, error: errorMessage };
    }
  }

  /**
   * Verify an OpenAI-compatible API key
   */
  private async verifyOpenAICompatible(
    baseUrl: string,
    apiKey: string,
  ): Promise<ProviderModel[]> {
    const url = `${baseUrl.replace(/\/$/, '')}/models`;

    const response = await firstValueFrom(
      this.httpService.get<{ data?: Array<{ id: string; owned_by?: string }> }>(
        url,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: TIMEOUT_CONFIG.standard,
        },
      ),
    );

    const models = response.data?.data || [];
    return models.map((m) => ({
      id: m.id,
      owned_by: m.owned_by,
    }));
  }

  /**
   * Verify an Anthropic API key
   */
  private async verifyAnthropic(
    baseUrl: string,
    apiKey: string,
  ): Promise<ProviderModel[]> {
    // Anthropic doesn't have a /models endpoint, so we just verify the key format
    // and return a placeholder model list
    const url = `${baseUrl.replace(/\/$/, '')}/v1/messages`;

    // We'll make a minimal request to verify the key
    // Note: Anthropic API requires a model parameter, so we use a simple test
    try {
      await firstValueFrom(
        this.httpService.post(
          url,
          {
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          },
          {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            timeout: TIMEOUT_CONFIG.healthCheck,
          },
        ),
      );
      // If we get here without error, the key is valid and we have quota
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      // 401 = invalid API key
      if (status === 401) {
        throw new Error('Invalid API key');
      }

      // 429 = rate limited, but key is valid
      if (status === 429) {
        this.logger.info(
          '[AIProviderClient] Anthropic key valid but rate limited',
        );
        // Key is valid, continue to return models
      }
      // 400/403/404 = key might be valid but request format issue
      else if (status && status >= 400 && status < 500) {
        this.logger.info(
          '[AIProviderClient] Anthropic key likely valid, got client error',
          {
            status,
          },
        );
        // Assume key is valid for non-401 client errors
      }
      // 5xx or network errors = cannot verify, treat as invalid
      else if (status && status >= 500) {
        throw new Error('Anthropic service unavailable, cannot verify key');
      }
      // Network errors (no response)
      else if (!status) {
        throw new Error('Network error, cannot verify key');
      }
    }

    // Return known Anthropic models
    return [
      { id: 'claude-3-5-sonnet-20241022', owned_by: 'anthropic' },
      { id: 'claude-3-5-haiku-20241022', owned_by: 'anthropic' },
      { id: 'claude-3-opus-20240229', owned_by: 'anthropic' },
      { id: 'claude-3-sonnet-20240229', owned_by: 'anthropic' },
      { id: 'claude-3-haiku-20240307', owned_by: 'anthropic' },
    ];
  }

  /**
   * Verify a Google Gemini API key
   * Uses header-based authentication to avoid exposing API key in URL
   */
  private async verifyGemini(
    baseUrl: string,
    apiKey: string,
  ): Promise<ProviderModel[]> {
    // Use header-based auth for better security
    const url = `${baseUrl.replace(/\/$/, '')}/models`;

    const response = await firstValueFrom(
      this.httpService.get<{
        models?: Array<{ name: string; displayName?: string }>;
      }>(url, {
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: TIMEOUT_CONFIG.standard,
      }),
    );

    const models = response.data?.models || [];
    return models.map((m) => ({
      id: this.normalizeModelId(m.name),
      owned_by: 'google',
    }));
  }

  /**
   * Normalize model ID by removing common prefixes
   * Handles formats like:
   * - models/gemini-1.5-pro
   * - gemini-1.5-pro
   * - publishers/google/models/gemini-1.5-pro
   */
  private normalizeModelId(modelName: string): string {
    // Remove 'models/' prefix
    let id = modelName.replace(/^models\//, '');
    // Remove 'publishers/google/models/' prefix
    id = id.replace(/^publishers\/[^/]+\/models\//, '');
    return id;
  }

  /**
   * Extract error message from Axios error
   */
  private extractErrorMessage(error: AxiosError): string {
    if (error.response?.data) {
      const data = error.response.data as any;
      return (
        data.error?.message || data.message || data.error || 'Unknown error'
      );
    }
    if (error.code === 'ECONNREFUSED') {
      return 'Connection refused';
    }
    if (error.code === 'ETIMEDOUT') {
      return 'Request timeout';
    }
    return error.message || 'Unknown error';
  }

  /**
   * Verify an Azure OpenAI API key
   * Azure OpenAI requires deployment-specific endpoints
   */
  private async verifyAzureOpenAI(
    baseUrl: string,
    apiKey: string,
  ): Promise<ProviderModel[]> {
    const url = `${baseUrl.replace(/\/$/, '')}/deployments?api-version=2024-02-01`;

    const response = await firstValueFrom(
      this.httpService.get<{ data?: Array<{ id: string }> }>(url, {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: TIMEOUT_CONFIG.cloudProvider,
      }),
    );

    const deployments = response.data?.data || [];
    return deployments.map((d) => ({
      id: d.id,
      owned_by: 'azure_openai',
    }));
  }

  /**
   * Get known AWS Bedrock models
   * Bedrock requires AWS SigV4 auth, so we return known models
   */
  private getBedrockModels(): ProviderModel[] {
    return [
      {
        id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        owned_by: 'anthropic',
      },
      { id: 'anthropic.claude-3-5-haiku-20241022-v1:0', owned_by: 'anthropic' },
      { id: 'anthropic.claude-3-opus-20240229-v1:0', owned_by: 'anthropic' },
      { id: 'anthropic.claude-3-sonnet-20240229-v1:0', owned_by: 'anthropic' },
      { id: 'anthropic.claude-3-haiku-20240307-v1:0', owned_by: 'anthropic' },
      { id: 'amazon.nova-pro-v1:0', owned_by: 'amazon' },
      { id: 'amazon.nova-lite-v1:0', owned_by: 'amazon' },
      { id: 'amazon.nova-micro-v1:0', owned_by: 'amazon' },
      { id: 'meta.llama3-1-405b-instruct-v1:0', owned_by: 'meta' },
      { id: 'meta.llama3-1-70b-instruct-v1:0', owned_by: 'meta' },
      { id: 'meta.llama3-1-8b-instruct-v1:0', owned_by: 'meta' },
    ];
  }

  /**
   * Get known Google Vertex AI models
   * Vertex AI requires GCP auth, so we return known models
   */
  private getVertexAIModels(): ProviderModel[] {
    return [
      { id: 'gemini-1.5-pro', owned_by: 'google' },
      { id: 'gemini-1.5-flash', owned_by: 'google' },
      { id: 'gemini-1.0-pro', owned_by: 'google' },
      { id: 'gemini-2.0-flash-exp', owned_by: 'google' },
    ];
  }

  /**
   * Verify AWS Bedrock credentials
   * Supports two formats:
   * 1. For third-party proxies (like OpenRouter): Simple API key
   * 2. For native AWS: access_key_id:secret_access_key[:region]
   */
  private async verifyBedrock(
    baseUrl: string,
    credentials: string,
  ): Promise<ProviderModel[]> {
    // Check if it's AWS native format (contains colon)
    if (credentials.includes(':')) {
      // Validate AWS credential format: access_key_id:secret_access_key[:region]
      const parts = credentials.split(':');
      if (parts.length < 2 || parts.length > 3) {
        throw new Error(
          'Invalid AWS credential format. Expected: access_key_id:secret_access_key[:region]',
        );
      }

      const [accessKeyId, secretAccessKey, region] = parts;

      // Validate access key ID format (starts with AKIA for long-term, ASIA for temp)
      if (!accessKeyId || accessKeyId.length < 16) {
        throw new Error('Invalid AWS access key ID format');
      }

      // Validate secret access key (typically 40 characters)
      if (!secretAccessKey || secretAccessKey.length < 30) {
        throw new Error('Invalid AWS secret access key format');
      }

      // Use STS to verify credentials are valid
      const effectiveRegion = region || 'us-east-1';
      try {
        const stsClient = new STSClient({
          region: effectiveRegion,
          credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
          },
        });

        // GetCallerIdentity is free and validates credentials
        const command = new GetCallerIdentityCommand({});
        const identity = await stsClient.send(command);

        this.logger.info('[AIProviderClient] AWS credentials verified', {
          accessKeyIdPrefix: accessKeyId.substring(0, 4) + '...',
          region: effectiveRegion,
          accountId: identity.Account,
          arn: identity.Arn,
        });

        return this.getBedrockModels();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          '[AIProviderClient] AWS credential verification failed',
          {
            error: errorMessage,
          },
        );
        throw new Error(`AWS credential verification failed: ${errorMessage}`);
      }
    }

    // Third-party proxy (like OpenRouter or other aggregators)
    // Try OpenAI-compatible endpoint
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/models`;
      const response = await firstValueFrom(
        this.httpService.get<{
          data?: Array<{ id: string; owned_by?: string }>;
        }>(url, {
          headers: {
            Authorization: `Bearer ${credentials}`,
            'Content-Type': 'application/json',
          },
          timeout: TIMEOUT_CONFIG.standard,
        }),
      );
      const models = response.data?.data || [];
      if (models.length > 0) {
        return models.map((m) => ({
          id: m.id,
          owned_by: m.owned_by,
        }));
      }
    } catch (error) {
      // If proxy endpoint fails, check if it's an auth error
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 401) {
        throw new Error('Invalid Bedrock credentials');
      }
      // For other errors, return known models (might be using different API format)
      this.logger.warn(
        '[AIProviderClient] Bedrock proxy verification failed, returning known models',
        {
          error: axiosError.message,
        },
      );
    }

    return this.getBedrockModels();
  }

  /**
   * Verify Google Vertex AI credentials
   * Supports API key authentication
   */
  private async verifyVertexAI(
    baseUrl: string,
    apiKey: string,
  ): Promise<ProviderModel[]> {
    // Vertex AI uses similar auth to Gemini
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/models`;

      const response = await firstValueFrom(
        this.httpService.get<{
          models?: Array<{ name: string; displayName?: string }>;
        }>(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: TIMEOUT_CONFIG.cloudProvider,
        }),
      );

      const models = response.data?.models || [];
      if (models.length > 0) {
        return models.map((m) => ({
          id: this.normalizeModelId(m.name),
          owned_by: 'google',
        }));
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      // 401 means invalid credentials
      if (axiosError.response?.status === 401) {
        throw new Error('Invalid Vertex AI credentials');
      }
      // For other errors, log warning and return known models
      this.logger.warn(
        '[AIProviderClient] Vertex AI verification failed, returning known models',
        {
          error: axiosError.message,
        },
      );
    }

    return this.getVertexAIModels();
  }
}
