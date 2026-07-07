/**
 * Model Verification Client
 * 封装模型 API 验证和模型列表获取
 */

import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';

/**
 * DMXAPI 等第三方聚合平台的域名特征
 * 这些平台需要特殊的 headers：
 * - Authorization 不需要 Bearer 前缀
 * - 需要 Rix-Api-User header
 */
const AGGREGATOR_PLATFORM_DOMAINS = [
  'dmxapi.com',
  'dmxapi.cn',
  'api.dmxapi.com',
];

/**
 * 模型列表响应
 */
interface ModelListResponse {
  data?: Array<{
    id: string;
    owned_by?: string;
    description?: string;
    name?: string;
  }>;
  object?: string;
}

/**
 * 模型信息（包含 description）
 */
export interface ModelInfo {
  id: string;
  description?: string;
}

/**
 * Gemini 模型列表响应
 */
interface GeminiModelListResponse {
  models?: Array<{
    name: string;
    supportedGenerationMethods?: string[];
    description?: string;
  }>;
}

@Injectable()
export class ModelVerifyClient {
  private readonly TIMEOUT_MS = 15000;

  constructor(private readonly httpService: HttpService) {}

  /**
   * 判断是否是 DMXAPI 等第三方聚合平台
   * 基于 baseUrl 的域名进行匹配
   */
  private isAggregatorPlatform(baseUrl: string): boolean {
    try {
      const url = new URL(baseUrl);
      const hostname = url.hostname.toLowerCase();
      return AGGREGATOR_PLATFORM_DOMAINS.some((domain) =>
        hostname.includes(domain),
      );
    } catch {
      return false;
    }
  }

  /**
   * 获取 API 请求的 headers
   * 根据平台类型动态调整：
   * - DMXAPI 等聚合平台：Authorization 不需要 Bearer，需要 Rix-Api-User
   * - 标准 OpenAI 兼容 API：Authorization 使用 Bearer 前缀
   */
  private getHeaders(baseUrl: string, apiKey: string): Record<string, string> {
    if (this.isAggregatorPlatform(baseUrl)) {
      // DMXAPI 等聚合平台的特殊 headers
      const userId = process.env.DMXAPI_USER_ID || '20700';
      return {
        Authorization: apiKey, // 不需要 Bearer 前缀
        Accept: 'application/json',
        'Rix-Api-User': userId,
      };
    }

    // 标准 OpenAI 兼容 API
    return {
      Authorization: `Bearer ${apiKey}`,
    };
  }

  /**
   * 从 OpenAI 兼容 API 获取模型列表
   * 支持 DMXAPI 等第三方聚合平台的特殊 headers
   */
  async fetchOpenAICompatibleModels(
    baseUrl: string,
    apiKey: string,
  ): Promise<ModelInfo[]> {
    try {
      const headers = this.getHeaders(baseUrl, apiKey);
      const response = await firstValueFrom(
        this.httpService
          .get<ModelListResponse>(`${baseUrl}/models`, {
            headers,
          })
          .pipe(
            timeout(10000),
            catchError(() => of({ status: 500, data: {} })),
          ),
      );

      if (
        response.status === 200 &&
        'data' in response.data &&
        response.data.data
      ) {
        return response.data.data.map((m) => ({
          id: m.id,
          description: m.description,
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * 从 Gemini API 获取模型列表
   */
  async fetchGeminiModels(
    baseUrl: string,
    apiKey: string,
  ): Promise<ModelInfo[]> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .get<GeminiModelListResponse>(
            `${baseUrl}/v1beta/models?key=${apiKey}`,
          )
          .pipe(
            timeout(10000),
            catchError(() => of({ status: 500, data: {} })),
          ),
      );

      if (
        response.status === 200 &&
        'models' in response.data &&
        response.data.models
      ) {
        return response.data.models
          .filter((m) =>
            m.supportedGenerationMethods?.includes('generateContent'),
          )
          .map((m) => ({
            id: m.name.replace('models/', ''),
            description: m.description,
          }))
          .slice(0, 20);
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * 验证 Chat 模型 (OpenAI/Anthropic)
   * 支持 DMXAPI 等第三方聚合平台
   */
  async verifyChatModel(
    apiHost: string,
    apiKey: string,
    model: string,
    apiType: 'openai' | 'anthropic',
  ): Promise<boolean> {
    const isAnthropic = apiType === 'anthropic';
    const url = isAnthropic
      ? `${apiHost}/v1/messages`
      : `${apiHost}/chat/completions`;

    // 判断是否是聚合平台，使用对应的 headers
    const headers = isAnthropic
      ? {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        }
      : {
          ...this.getHeaders(apiHost, apiKey),
          'Content-Type': 'application/json',
        };

    try {
      const response = await firstValueFrom(
        this.httpService
          .post(
            url,
            {
              model,
              max_tokens: 1,
              messages: [{ role: 'user', content: 'Hi' }],
            },
            { headers },
          )
          .pipe(
            timeout(this.TIMEOUT_MS),
            catchError((error) =>
              of({ status: error.response?.status || 500 }),
            ),
          ),
      );

      // 200 = 成功, 429 = 限流但有效
      return response.status === 200 || response.status === 429;
    } catch {
      return true; // 其他错误视为可用
    }
  }

  /**
   * Step 7: 验证 Chat 模型的特定能力（capability smoke test）。
   * 在最小 chat 请求上叠加 capability-specific 参数（response_format / tools），
   * 200/429 视为支持；400/422（参数错误）视为不支持并返回原因；其他错误保守视为可用。
   * Anthropic 协议暂不叠加 response_format/tools（无原生等价），仅做基础 chat 探活。
   */
  async verifyChatCapability(
    apiHost: string,
    apiKey: string,
    model: string,
    apiType: 'openai' | 'anthropic',
    options?: {
      responseFormat?: { type: string };
      tools?: unknown[];
      extraBody?: Record<string, unknown>;
    },
  ): Promise<{ verified: boolean; failureReason?: string }> {
    const isAnthropic = apiType === 'anthropic';
    const url = isAnthropic ? `${apiHost}/v1/messages` : `${apiHost}/chat/completions`;
    const headers = isAnthropic
      ? {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        }
      : { ...this.getHeaders(apiHost, apiKey), 'Content-Type': 'application/json' };

    const body: Record<string, unknown> = {
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }],
    };
    if (!isAnthropic) {
      if (options?.responseFormat) body.response_format = options.responseFormat;
      if (options?.tools) body.tools = options.tools;
      if (options?.extraBody) Object.assign(body, options.extraBody);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, body, { headers }).pipe(
          timeout(this.TIMEOUT_MS),
          catchError((error) =>
            of({
              status: error.response?.status || 500,
              data: error.response?.data as unknown,
            }),
          ),
        ),
      );
      if (response.status === 200 || response.status === 429) {
        return { verified: true };
      }
      if (response.status === 400 || response.status === 422) {
        const data = response.data as { error?: { message?: unknown } } | undefined;
        const msg = data?.error?.message ? String(data.error.message) : '';
        return {
          verified: false,
          failureReason: `HTTP ${response.status}: ${msg || 'capability not supported'}`,
        };
      }
      return { verified: true };
    } catch {
      return { verified: true };
    }
  }

  /**
   * 验证 Gemini 模型
   */
  async verifyGeminiModel(
    apiHost: string,
    apiKey: string,
    model: string,
  ): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .post(
            `${apiHost}/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              contents: [{ parts: [{ text: 'Hi' }] }],
              generationConfig: { maxOutputTokens: 1 },
            },
            { headers: { 'Content-Type': 'application/json' } },
          )
          .pipe(
            timeout(this.TIMEOUT_MS),
            catchError((error) =>
              of({ status: error.response?.status || 500 }),
            ),
          ),
      );

      return response.status === 200 || response.status === 429;
    } catch {
      return true;
    }
  }

  /**
   * 验证 Azure OpenAI 模型
   */
  async verifyAzureOpenAIModel(
    apiHost: string,
    apiKey: string,
    model: string,
  ): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .post(
            `${apiHost}/openai/deployments/${model}/chat/completions?api-version=2024-02-15-preview`,
            {
              messages: [{ role: 'user', content: 'Hi' }],
              max_tokens: 1,
            },
            {
              headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json',
              },
            },
          )
          .pipe(
            timeout(this.TIMEOUT_MS),
            catchError((error) =>
              of({ status: error.response?.status || 500 }),
            ),
          ),
      );

      return response.status === 200 || response.status === 429;
    } catch {
      return true;
    }
  }

  /**
   * 验证图像生成模型
   * 支持 DMXAPI 等第三方聚合平台
   */
  async verifyImageModel(
    apiHost: string,
    apiKey: string,
    model: string,
    apiType: string,
  ): Promise<boolean> {
    const headers =
      apiType === 'anthropic'
        ? { 'x-api-key': apiKey, 'Content-Type': 'application/json' }
        : {
            ...this.getHeaders(apiHost, apiKey),
            'Content-Type': 'application/json',
          };

    try {
      const response = await firstValueFrom(
        this.httpService
          .post(
            `${apiHost}/images/generations`,
            {
              model,
              prompt: 'A dot',
              n: 1,
              size: '256x256',
              response_format: 'url',
            },
            { headers },
          )
          .pipe(
            timeout(30000),
            catchError((error) =>
              of({ status: error.response?.status || 500 }),
            ),
          ),
      );

      return response.status === 200 || response.status === 429;
    } catch {
      return true;
    }
  }

  /**
   * 验证 Embedding 模型
   * 支持 DMXAPI 等第三方聚合平台
   */
  async verifyEmbeddingModel(
    apiHost: string,
    apiKey: string,
    model: string,
    apiType: string,
  ): Promise<boolean> {
    const headers =
      apiType === 'anthropic'
        ? { 'x-api-key': apiKey, 'Content-Type': 'application/json' }
        : {
            ...this.getHeaders(apiHost, apiKey),
            'Content-Type': 'application/json',
          };

    try {
      const response = await firstValueFrom(
        this.httpService
          .post(`${apiHost}/embeddings`, { model, input: 'test' }, { headers })
          .pipe(
            timeout(this.TIMEOUT_MS),
            catchError((error) =>
              of({ status: error.response?.status || 500 }),
            ),
          ),
      );

      return response.status === 200 || response.status === 429;
    } catch {
      return true;
    }
  }

  /**
   * 验证 TTS 模型
   * 支持 DMXAPI 等第三方聚合平台
   */
  async verifyTTSModel(
    apiHost: string,
    apiKey: string,
    model: string,
    apiType: string,
  ): Promise<boolean> {
    const headers =
      apiType === 'anthropic'
        ? { 'x-api-key': apiKey, 'Content-Type': 'application/json' }
        : {
            ...this.getHeaders(apiHost, apiKey),
            'Content-Type': 'application/json',
          };

    try {
      const response = await firstValueFrom(
        this.httpService
          .post(
            `${apiHost}/audio/speech`,
            {
              model,
              input: 'Hi',
              voice: 'alloy',
              response_format: 'mp3',
            },
            { headers },
          )
          .pipe(
            timeout(this.TIMEOUT_MS),
            catchError((error) =>
              of({ status: error.response?.status || 500 }),
            ),
          ),
      );

      return response.status === 200 || response.status === 429;
    } catch {
      return true;
    }
  }

  /**
   * 验证 Rerank 模型
   * 支持 DMXAPI 等第三方聚合平台
   */
  async verifyRerankModel(
    apiHost: string,
    apiKey: string,
    model: string,
    apiType: string,
  ): Promise<boolean> {
    const headers =
      apiType === 'anthropic'
        ? { 'x-api-key': apiKey, 'Content-Type': 'application/json' }
        : {
            ...this.getHeaders(apiHost, apiKey),
            'Content-Type': 'application/json',
          };

    try {
      const response = await firstValueFrom(
        this.httpService
          .post(
            `${apiHost}/rerank`,
            {
              model,
              query: 'test',
              documents: ['test'],
              top_n: 1,
            },
            { headers },
          )
          .pipe(
            timeout(this.TIMEOUT_MS),
            catchError((error) =>
              of({ status: error.response?.status || 500 }),
            ),
          ),
      );

      return response.status === 200 || response.status === 429;
    } catch {
      return true;
    }
  }

  /**
   * 验证 Moderation 模型
   * 支持 DMXAPI 等第三方聚合平台
   */
  async verifyModerationModel(
    apiHost: string,
    apiKey: string,
    model: string,
    apiType: string,
  ): Promise<boolean> {
    const headers =
      apiType === 'anthropic'
        ? { 'x-api-key': apiKey, 'Content-Type': 'application/json' }
        : {
            ...this.getHeaders(apiHost, apiKey),
            'Content-Type': 'application/json',
          };

    try {
      const response = await firstValueFrom(
        this.httpService
          .post(`${apiHost}/moderations`, { model, input: 'test' }, { headers })
          .pipe(
            timeout(this.TIMEOUT_MS),
            catchError((error) =>
              of({ status: error.response?.status || 500 }),
            ),
          ),
      );

      return response.status === 200 || response.status === 429;
    } catch {
      return true;
    }
  }
}
