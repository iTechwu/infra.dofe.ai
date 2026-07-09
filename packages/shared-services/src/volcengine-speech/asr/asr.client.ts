import { Injectable } from '@nestjs/common';
import { VolcengineSpeechTransport } from '../volcengine-speech.transport';
import {
  VolcengineAsrMode,
  VolcengineAsrRequest,
  VolcengineSpeechRequestOptions,
  VolcengineSpeechTaskResult,
} from '../types';
import { validateAsrRequest, validateRequiredString } from '../validation';

const DEFAULT_ASR_RESOURCE_IDS: Record<VolcengineAsrMode, string> = {
  standard: 'volc.bigasr.auc',
  fast: 'volc.bigasr.auc.fast',
  offPeak: 'volc.bigasr.auc.concurrent',
};

@Injectable()
export class VolcengineAsrClient {
  constructor(private readonly transport: VolcengineSpeechTransport) {}

  async submitTask<T = unknown>(
    request: VolcengineAsrRequest,
    options: VolcengineSpeechRequestOptions = {},
  ): Promise<VolcengineSpeechTaskResult<T>> {
    validateAsrRequest(request);
    const mode = request.mode ?? 'standard';
    const result = await this.transport.postHeaderStatus<T>(
      `${this.getBaseUrl(mode)}/submit`,
      {
        audio: { url: request.audioUrl },
        ...(request.callbackUrl ? { callback: request.callbackUrl } : {}),
        ...(request.options ?? {}),
      },
      {
        ...options,
        resourceId:
          request.resourceId ??
          options.resourceId ??
          DEFAULT_ASR_RESOURCE_IDS[mode],
        sequence: options.sequence ?? -1,
      },
    );

    return {
      ...result,
      taskId: result.logId ?? result.requestId ?? result.taskId,
    };
  }

  async queryTask<T = unknown>(
    taskId: string,
    mode: VolcengineAsrMode = 'standard',
    options: VolcengineSpeechRequestOptions = {},
  ): Promise<VolcengineSpeechTaskResult<T>> {
    validateRequiredString(taskId, 'taskId');
    const result = await this.transport.postHeaderStatus<T>(
      `${this.getBaseUrl(mode)}/query`,
      {},
      {
        ...options,
        resourceId: options.resourceId ?? DEFAULT_ASR_RESOURCE_IDS[mode],
        headers: {
          ...(options.headers ?? {}),
          'X-Tt-Logid': taskId,
        },
      },
    );

    return {
      ...result,
      taskId,
    };
  }

  async submitStandardTask<T = unknown>(
    request: Omit<VolcengineAsrRequest, 'mode'>,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineSpeechTaskResult<T>> {
    return this.submitTask<T>({ ...request, mode: 'standard' }, options);
  }

  async submitFastTask<T = unknown>(
    request: Omit<VolcengineAsrRequest, 'mode'>,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineSpeechTaskResult<T>> {
    return this.submitTask<T>({ ...request, mode: 'fast' }, options);
  }

  async submitOffPeakTask<T = unknown>(
    request: Omit<VolcengineAsrRequest, 'mode'>,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineSpeechTaskResult<T>> {
    return this.submitTask<T>({ ...request, mode: 'offPeak' }, options);
  }

  private getBaseUrl(mode: VolcengineAsrMode): string {
    const endpoints = this.transport.getConfig().endpoints;
    const endpoint =
      mode === 'fast'
        ? endpoints.asrFast
        : mode === 'offPeak'
          ? endpoints.asrOffPeak
          : endpoints.asrStandard;
    return endpoint.replace(/\/$/, '');
  }
}
