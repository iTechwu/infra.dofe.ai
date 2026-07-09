import { Injectable } from '@nestjs/common';
import { VolcengineSpeechTransport } from '../volcengine-speech.transport';
import {
  CreateAudioRequest,
  CreateAudioResponse,
  VolcengineSpeechApiResponse,
  VolcengineSpeechRequestOptions,
  VolcengineSpeechResult,
} from '../types';
import { validateCreateAudioRequest } from '../validation';

@Injectable()
export class VolcengineAudioGenerationClient {
  constructor(private readonly transport: VolcengineSpeechTransport) {}

  async createAudio(
    request: CreateAudioRequest,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineSpeechResult<CreateAudioResponse>> {
    validateCreateAudioRequest(request);
    const result = await this.transport.post<
      VolcengineSpeechApiResponse<CreateAudioResponse>
    >(
      this.transport.getConfig().endpoints.audioGeneration,
      request,
      options,
    );
    const raw = result.raw as VolcengineSpeechApiResponse<CreateAudioResponse>;

    return {
      ...result,
      data: {
        audio: raw.audio,
        url: raw.url,
        duration: raw.duration,
        originalDuration: raw.original_duration,
        subtitle: raw.subtitle,
      },
    };
  }
}
