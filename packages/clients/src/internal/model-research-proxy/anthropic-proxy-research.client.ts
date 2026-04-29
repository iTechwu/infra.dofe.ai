import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { firstValueFrom } from 'rxjs';
import type { AxiosError } from 'axios';
import { researchConfig } from '@/common/config/env-config.service';

/**
 * Anthropic-compatible message types
 * (simplified subset for research use)
 */
export interface AnthropicResearchMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicTextContent {
  type: 'text';
  text: string;
}

interface AnthropicToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

type AnthropicContentBlock = AnthropicTextContent | AnthropicToolUseContent;

interface AnthropicResearchResponse {
  id: string;
  content: AnthropicContentBlock[];
}

/**
 * Fixed sentinel model value to indicate proxy must override
 */
const SENTINEL_MODEL = '__proxy_override_required__';

/**
 * Internal client for model capability research via Anthropic-compatible proxy
 *
 * Responsibilities:
 * - Transport only - no business logic, no JSON parsing
 * - Always send fixed sentinel model
 * - Normalize Anthropic response to single text string
 * - Throw on failures (canonical failure contract)
 */
@Injectable()
export class AnthropicProxyResearchClient {
  constructor(
    private readonly httpService: HttpService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  /**
   * Perform research via Anthropic-compatible proxy
   *
   * @param messages - The conversation messages
   * @returns Normalized text string (single concatenated text)
   * @throws Error on config missing, transport failure, or no usable content
   */
  async research(messages: AnthropicResearchMessage[]): Promise<string> {
    const apiBaseUrl = researchConfig.apiBaseUrl;
    const proxyToken = researchConfig.researchBotProxyToken;
    const endpoint = researchConfig.researchProxyEndpoint;

    // Config validation - fail fast
    if (!apiBaseUrl) {
      throw new Error('Missing apiBaseUrl for model capability research proxy');
    }
    if (!proxyToken) {
      throw new Error(
        'Missing researchBotProxyToken for model capability research',
      );
    }

    this.logger.info('[AnthropicProxyResearch] Starting research request', {
      messageCount: messages.length,
      endpoint: this.sanitizeEndpointForLog(endpoint),
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post<AnthropicResearchResponse>(
          endpoint,
          {
            model: SENTINEL_MODEL,
            max_tokens: 2048,
            messages,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${proxyToken}`,
            },
            timeout: 120000,
          },
        ),
      );

      const normalizedText = this.normalizeResponseText(response.data);

      this.logger.info('[AnthropicProxyResearch] Research request successful', {
        responseId: response.data.id,
        hasContent: !!normalizedText,
        contentLength: normalizedText.length,
      });

      return normalizedText;
    } catch (error) {
      this.handleError(error as AxiosError, endpoint);
    }
  }

  /**
   * Normalize Anthropic-compatible response to single text string
   *
   * Rules:
   * - Only text blocks are considered
   * - Text blocks must be non-empty after trim()
   * - Text blocks are concatenated in order
   * - Throws if no usable text blocks
   */
  private normalizeResponseText(response: AnthropicResearchResponse): string {
    if (!response.content || !Array.isArray(response.content)) {
      throw new Error(
        'Invalid Anthropic proxy response: missing content array',
      );
    }

    const usableTexts: string[] = [];

    for (const block of response.content) {
      if (block.type === 'text' && block.text) {
        const trimmed = block.text.trim();
        if (trimmed) {
          usableTexts.push(trimmed);
        }
      }
      // Ignore tool_use blocks and other types
    }

    if (usableTexts.length === 0) {
      throw new Error('No usable text content in Anthropic proxy response');
    }

    return usableTexts.join('');
  }

  /**
   * Sanitize endpoint for logging (remove query params, etc.)
   */
  private sanitizeEndpointForLog(endpoint: string): string {
    try {
      const url = new URL(endpoint);
      return `${url.origin}${url.pathname}`;
    } catch {
      return endpoint;
    }
  }

  /**
   * Handle transport/HTTP errors
   */
  private handleError(error: AxiosError, endpoint: string): never {
    const errorMessage = this.extractErrorMessage(error);
    const statusCode = error.response?.status;

    this.logger.error('[AnthropicProxyResearch] Request failed', {
      statusCode,
      endpoint: this.sanitizeEndpointForLog(endpoint),
      errorMessage,
      code: error.code,
    });

    if (statusCode === 401) {
      throw new Error('Anthropic proxy research authentication failed');
    } else if (statusCode === 429) {
      throw new Error('Anthropic proxy research rate limit exceeded');
    } else if (statusCode === 500) {
      throw new Error(`Anthropic proxy server error: ${errorMessage}`);
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error(
        `Cannot connect to Anthropic proxy: ${this.sanitizeEndpointForLog(endpoint)}`,
      );
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error('Anthropic proxy research request timeout');
    } else {
      throw new Error(`Anthropic proxy research API error: ${errorMessage}`);
    }
  }

  private extractErrorMessage(error: AxiosError): string {
    if (error.response?.data) {
      const data = error.response.data as any;
      return (
        data.error?.message || data.message || data.error || 'Unknown error'
      );
    }
    return error.message || 'Unknown error';
  }
}
