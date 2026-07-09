import { Injectable } from '@nestjs/common';
import { VolcengineSpeechTransport } from '../volcengine-speech.transport';
import {
  VolcengineSpeechRequestOptions,
  VolcengineSpeechTaskRequest,
  VolcengineSpeechTaskResult,
} from '../types';
import { validateMemoTaskRequest, validateRequiredString } from '../validation';
import { normalizeTaskResult } from './memo.normalizer';

@Injectable()
export class VolcengineMemoClient {
  constructor(private readonly transport: VolcengineSpeechTransport) {}

  async submitTask<T = unknown>(
    request: VolcengineSpeechTaskRequest,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineSpeechTaskResult<T>> {
    validateMemoTaskRequest(request);
    const result = await this.transport.post<Record<string, unknown>>(
      `${this.transport.getConfig().endpoints.memo.replace(/\/$/, '')}/submit`,
      {
        audio_url: request.audioUrl,
        resource_url: request.resourceUrl,
        callback_url: request.callbackUrl,
        ...(request.options ?? {}),
      },
      options,
    );
    return normalizeTaskResult<T>(result);
  }

  async queryTask<T = unknown>(
    taskId: string,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineSpeechTaskResult<T>> {
    validateRequiredString(taskId, 'taskId');
    const result = await this.transport.post<Record<string, unknown>>(
      `${this.transport.getConfig().endpoints.memo.replace(/\/$/, '')}/query`,
      { task_id: taskId },
      options,
    );
    return normalizeTaskResult<T>(result, taskId);
  }
}

