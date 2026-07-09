import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  VolcengineSpeechApiResponse,
  VolcengineSpeechRequestOptions,
  VolcengineSpeechResolvedConfig,
  VolcengineSpeechResult,
} from './types';
import { VolcengineSpeechConfigService } from './config/volcengine-speech.config';
import {
  VolcengineSpeechError,
  assertVolcengineSpeechSuccess,
  normalizeVolcengineHttpError,
} from './errors';
import { readVolcengineHeader } from './headers';
import { buildVolcengineSpeechHeaders } from './auth';

@Injectable()
export class VolcengineSpeechTransport {
  private readonly config: VolcengineSpeechResolvedConfig;

  constructor(
    private readonly httpService: HttpService,
    configService: VolcengineSpeechConfigService,
  ) {
    this.config = configService.getConfig();
  }

  static create(
    httpService: HttpService,
    config: VolcengineSpeechResolvedConfig,
  ): VolcengineSpeechTransport {
    const instance = Object.create(
      VolcengineSpeechTransport.prototype,
    ) as VolcengineSpeechTransport;
    Object.assign(instance, { httpService, config });
    return instance;
  }

  getConfig(): VolcengineSpeechResolvedConfig {
    return this.config;
  }

  buildHeaders(
    options: VolcengineSpeechRequestOptions = {},
  ): Record<string, string> {
    return buildVolcengineSpeechHeaders(this.config, options);
  }

  async post<T = unknown>(
    url: string,
    payload: unknown,
    options: VolcengineSpeechRequestOptions = {},
  ): Promise<VolcengineSpeechResult<T>> {
    const headers = this.buildHeaders(options);
    const requestId = headers['X-Api-Request-Id'];
    const response = await this.executeWithRetry(
      async () => {
        const response = await firstValueFrom(
          this.httpService.post<VolcengineSpeechApiResponse<T>>(url, payload, {
            headers,
            timeout: options.timeoutMs ?? this.config.timeoutMs,
          }),
        );
        assertVolcengineSpeechSuccess({
          body: response.data,
          logId: readVolcengineHeader(response.headers, 'x-tt-logid'),
          requestId,
        });
        return response;
      },
      { requestId },
    );
    const logId = readVolcengineHeader(response.headers, 'x-tt-logid');

    return {
      data: (response.data.data ?? response.data.result ?? response.data) as T,
      requestId,
      logId,
      raw: response.data,
    };
  }

  async postStream(
    url: string,
    payload: unknown,
    options: VolcengineSpeechRequestOptions = {},
  ) {
    const headers = this.buildHeaders(options);
    const response = await this.executeWithRetry(
      () =>
        firstValueFrom(
          this.httpService.post(url, payload, {
            headers,
            timeout: options.timeoutMs ?? this.config.timeoutMs,
            responseType: 'stream',
          }),
        ),
      { requestId: headers['X-Api-Request-Id'] },
    );

    return {
      stream: response.data,
      requestId: headers['X-Api-Request-Id'],
      logId: readVolcengineHeader(response.headers, 'x-tt-logid'),
    };
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: { requestId?: string } = {},
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const normalized = normalizeVolcengineHttpError(error, context);
        lastError = normalized;
        if (
          attempt >= this.config.maxRetries ||
          !isRetryableError(normalized)
        ) {
          throw normalized;
        }
        await delay(getRetryDelayMs(attempt));
      }
    }

    throw lastError;
  }
}

function isRetryableError(error: unknown): boolean {
  // All HTTP/network errors are normalized to VolcengineSpeechError before
  // reaching the retry loop; any other error is a non-retryable caller bug.
  return error instanceof VolcengineSpeechError && error.retryable;
}

function getRetryDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 5000);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
