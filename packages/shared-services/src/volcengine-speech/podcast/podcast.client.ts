import { Injectable } from '@nestjs/common';
import { VolcengineSpeechTransport } from '../volcengine-speech.transport';
import {
  VolcengineSpeechRequestOptions,
  VolcengineWebSocketCallbacks,
} from '../types';
import { VolcengineWebSocketSession } from '../protocol';

@Injectable()
export class VolcenginePodcastClient {
  constructor(private readonly transport: VolcengineSpeechTransport) {}

  async connect<TEvent = unknown>(
    initPayload: unknown,
    callbacks?: VolcengineWebSocketCallbacks<TEvent>,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineWebSocketSession<TEvent>> {
    const session = new VolcengineWebSocketSession<TEvent>(this.transport, {
      url: this.transport.getConfig().endpoints.podcast,
      initPayload,
      callbacks,
      requestOptions: options,
    });
    await session.connect();
    return session;
  }
}
