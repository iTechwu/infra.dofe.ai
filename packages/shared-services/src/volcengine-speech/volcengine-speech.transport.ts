import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  VolcengineSpeechApiResponse,
  VolcengineSpeechRequestOptions,
  VolcengineSpeechResolvedConfig,
  VolcengineSpeechResult,
  VolcengineSpeechTaskResult,
} from './types';
import { VolcengineSpeechConfigService } from './config/volcengine-speech.config';
import {
  VolcengineSpeechError,
  assertVolcengineHeaderStatusSuccess,
  assertVolcengineSpeechSuccess,
  normalizeVolcengineHttpError,
} from './errors';
import { readVolcengineHeader } from './headers';
import { executeVolcengineRetry } from './retry';
import { buildVolcengineSpeechHeaders } from './auth';
import { normalizeHeaderStatusTaskResult } from './task-result';

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

  async postHeaderStatus<T = unknown>(
    url: string,
    payload: unknown,
    options: VolcengineSpeechRequestOptions = {},
  ): Promise<VolcengineSpeechTaskResult<T>> {
    const headers = this.buildHeaders(options);
    const requestId = headers['X-Api-Request-Id'];
    const response = await this.executeWithRetry(
      () =>
        firstValueFrom(
          this.httpService.post<T>(url, payload, {
            headers,
            timeout: options.timeoutMs ?? this.config.timeoutMs,
          }),
        ),
      { requestId },
    );
    const logId = readVolcengineHeader(response.headers, 'x-tt-logid');
    const statusCode = readVolcengineHeader(
      response.headers,
      'x-api-status-code',
    );
    const statusMessage = readVolcengineHeader(
      response.headers,
      'x-api-message',
    );
    assertVolcengineHeaderStatusSuccess({
      statusCode,
      statusMessage,
      logId,
      requestId,
      raw: response.data,
    });

    return normalizeHeaderStatusTaskResult<T>({
      statusCode,
      statusMessage,
      result: response.data,
      requestId,
      logId,
      raw: response.data,
    });
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: { requestId?: string } = {},
  ): Promise<T> {
    return executeVolcengineRetry(operation, {
      maxRetries: this.config.maxRetries,
      normalizeError: (error) => normalizeVolcengineHttpError(error, context),
      isRetryableError,
    });
  }
}

function isRetryableError(error: unknown): boolean {
  // All HTTP/network errors are normalized to VolcengineSpeechError before
  // reaching the retry loop; any other error is a non-retryable caller bug.
  return error instanceof VolcengineSpeechError && error.retryable;
}
