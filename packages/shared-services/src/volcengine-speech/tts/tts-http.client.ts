import { Injectable } from '@nestjs/common';
import { VolcengineSpeechTransport } from '../volcengine-speech.transport';
import { VolcengineSpeechRequestOptions } from '../types';
import { validateTtsHttpRequest } from '../validation';
import { normalizeVolcengineTtsError } from '../errors';
import {
  VolcengineTtsHttpRequest,
  VolcengineTtsHttpResponse,
} from './tts.types';

@Injectable()
export class VolcengineTtsHttpClient {
  constructor(private readonly transport: VolcengineSpeechTransport) {}

  async synthesizeHttpStream(
    request: VolcengineTtsHttpRequest,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineTtsHttpResponse> {
    validateTtsHttpRequest(request);
    try {
      return await this.transport.postStream(
        this.transport.getConfig().endpoints.ttsStreaming,
        request,
        options,
      );
    } catch (error) {
      throw normalizeVolcengineTtsError(error, 'tts_http');
    }
  }
}
