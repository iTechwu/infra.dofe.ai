import { Injectable } from '@nestjs/common';
import { VolcengineSpeechTransport } from '../volcengine-speech.transport';
import {
  StreamingTtsRequest,
  StreamingTtsResponse,
  VolcengineWebSocketCallbacks,
  VolcengineSpeechRequestOptions,
} from '../types';
import { VolcengineWebSocketSession } from '../protocol';

@Injectable()
export class VolcengineTtsStreamingClient {
  constructor(private readonly transport: VolcengineSpeechTransport) {}

  async synthesizeStream(
    request: StreamingTtsRequest,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<StreamingTtsResponse> {
    return this.transport.postStream(
      this.transport.getConfig().endpoints.ttsStreaming,
      request,
      options,
    );
  }

  async connectWebSocket<TEvent = unknown>(
    initPayload: unknown,
    callbacks?: VolcengineWebSocketCallbacks<TEvent>,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineWebSocketSession<TEvent>> {
    const session = new VolcengineWebSocketSession<TEvent>(this.transport, {
      url: this.transport.getConfig().endpoints.ttsWebSocket,
      initPayload,
      callbacks,
      requestOptions: options,
    });
    await session.connect();
    return session;
  }
}
