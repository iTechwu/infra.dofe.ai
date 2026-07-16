import { Injectable } from '@nestjs/common';
import { VolcengineSpeechTransport } from '../volcengine-speech.transport';
import {
  VolcengineSpeechRequestOptions,
  VolcengineSpeechResult,
  VolcengineVoiceRequest,
} from '../types';
import {
  validateRequiredString,
  validateVoiceLookupRequest,
  validateVoiceTrainingRequest,
  validateVoiceDesignRequest,
} from '../validation';
import {
  VolcengineVoiceLookupRequest,
  VolcengineVoiceProfile,
  VolcengineVoiceTrainingRequest,
  VolcengineVoiceDesignRequest,
} from './voice.types';
import { normalizeVolcengineTtsError, VolcengineTtsCapability } from '../errors';

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

  train(
    request: VolcengineVoiceTrainingRequest,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineSpeechResult<VolcengineVoiceProfile>> {
    validateVoiceTrainingRequest(request);
    return this.postTyped('voice_training', this.transport.getConfig().endpoints.voiceTraining, request, options);
  }

  get(
    request: VolcengineVoiceLookupRequest,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineSpeechResult<VolcengineVoiceProfile>> {
    validateVoiceLookupRequest(request);
    return this.postTyped('voice_query', this.transport.getConfig().endpoints.voiceQuery, request, options);
  }

  upgrade(
    request: VolcengineVoiceLookupRequest,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineSpeechResult<VolcengineVoiceProfile>> {
    validateVoiceLookupRequest(request);
    return this.postTyped('voice_upgrade', this.transport.getConfig().endpoints.voiceUpgrade, request, options);
  }

  design(request: VolcengineVoiceDesignRequest, options?: VolcengineSpeechRequestOptions): Promise<VolcengineSpeechResult<unknown>> {
    validateVoiceDesignRequest(request);
    return this.postTyped('voice_design', this.transport.getConfig().endpoints.voiceDesign, request, options);
  }

  private async postTyped<T>(capability: VolcengineTtsCapability, url: string, body: unknown, options?: VolcengineSpeechRequestOptions): Promise<VolcengineSpeechResult<T>> {
    try { return await this.transport.post<T>(url, body, options); }
    catch (error) { throw normalizeVolcengineTtsError(error, capability); }
  }
}

function joinUrlPath(basePath: string, action: string): string {
  return `${basePath.replace(/\/$/, '')}/${action.replace(/^\//, '')}`;
}
