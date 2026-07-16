import { Injectable } from '@nestjs/common';
import { VolcengineAudioGenerationClient } from '../audio-generation';
import {
  CreateAudioRequest,
  CreateAudioResponse,
  VolcengineSpeechRequestOptions,
  VolcengineSpeechResult,
} from '../types';
import {
  VolcengineTtsHttpRequest,
  VolcengineTtsHttpResponse,
} from './tts.types';
import { VolcengineTtsHttpClient } from './tts-http.client';
import {
  VolcengineTtsDuplexWebSocketCallbacks,
  VolcengineTtsDuplexWebSocketSession,
} from './tts-duplex-websocket.session';
import {
  VolcengineTtsOneWayWebSocketCallbacks,
  VolcengineTtsOneWayWebSocketSession,
} from './tts-one-way-websocket.session';
import { VolcengineSpeechTransport } from '../volcengine-speech.transport';

/**
 * Typed entrypoint for the documented HTTP TTS product family.
 * WebSocket and long-text methods are intentionally added only after their
 * protocol and authentication contracts are independently verified.
 */
@Injectable()
export class VolcengineTtsApiClient {
  constructor(
    private readonly audioGeneration: VolcengineAudioGenerationClient,
    private readonly http: VolcengineTtsHttpClient,
    private readonly transport: VolcengineSpeechTransport,
  ) {}

  createAudio(
    request: CreateAudioRequest,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineSpeechResult<CreateAudioResponse>> {
    return this.audioGeneration.createAudio(request, options);
  }

  synthesizeHttpStream(
    request: VolcengineTtsHttpRequest,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineTtsHttpResponse> {
    return this.http.synthesizeHttpStream(request, options);
  }

  async connectDuplex(
    callbacks?: VolcengineTtsDuplexWebSocketCallbacks,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineTtsDuplexWebSocketSession> {
    const session = new VolcengineTtsDuplexWebSocketSession(
      this.transport,
      callbacks,
      options,
    );
    await session.connect();
    return session;
  }

  async connectOneWay(
    request: VolcengineTtsHttpRequest,
    callbacks?: VolcengineTtsOneWayWebSocketCallbacks,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineTtsOneWayWebSocketSession> {
    const session = new VolcengineTtsOneWayWebSocketSession(
      this.transport,
      request,
      callbacks,
      options,
    );
    await session.connect();
    return session;
  }
}
