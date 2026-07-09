import { Injectable } from '@nestjs/common';
import { VolcengineSpeechTransport } from '../volcengine-speech.transport';
import {
  VolcengineSpeechRequestOptions,
  VolcengineSpeechResult,
  VolcengineVoiceRequest,
} from '../types';
import { validateRequiredString } from '../validation';

@Injectable()
export class VolcengineVoiceClient {
  constructor(private readonly transport: VolcengineSpeechTransport) {}

  async request<T = unknown>(
    request: VolcengineVoiceRequest,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineSpeechResult<T>> {
    validateRequiredString(request.action, 'action');
    const url = new URL(this.transport.getConfig().endpoints.voice);
    url.pathname = joinUrlPath(url.pathname, request.action);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return this.transport.post<T>(url.toString(), request.body ?? {}, options);
  }

  listVoices<T = unknown>(
    query?: VolcengineVoiceRequest['query'],
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineSpeechResult<T>> {
    return this.request<T>({ action: 'list', query }, options);
  }

  submitVoiceTraining<T = unknown>(
    body: Record<string, unknown>,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineSpeechResult<T>> {
    return this.request<T>({ action: 'train', body }, options);
  }

  queryVoiceTraining<T = unknown>(
    taskId: string,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineSpeechResult<T>> {
    validateRequiredString(taskId, 'taskId');
    return this.request<T>({ action: 'task/query', body: { task_id: taskId } }, options);
  }
}

function joinUrlPath(basePath: string, action: string): string {
  return `${basePath.replace(/\/$/, '')}/${action.replace(/^\//, '')}`;
}
