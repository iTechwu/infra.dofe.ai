import { Injectable } from '@nestjs/common';
import { VolcengineSpeechTransport } from '../volcengine-speech.transport';
import {
  VolcengineInterpretationRequest,
  VolcengineSpeechRequestOptions,
  VolcengineWebSocketCallbacks,
} from '../types';
import { VolcengineWebSocketSession } from '../protocol';
import { validateInterpretationRequest } from '../validation';

@Injectable()
export class VolcengineInterpretationClient {
  constructor(private readonly transport: VolcengineSpeechTransport) {}

  async connect<TEvent = unknown>(
    initPayload: VolcengineInterpretationRequest,
    callbacks?: VolcengineWebSocketCallbacks<TEvent>,
    options?: VolcengineSpeechRequestOptions,
  ): Promise<VolcengineWebSocketSession<TEvent>> {
    validateInterpretationRequest(initPayload);
    const session = new VolcengineWebSocketSession<TEvent>(this.transport, {
      url: this.transport.getConfig().endpoints.interpretation,
      initPayload,
      callbacks,
      requestOptions: options,
    });
    await session.connect();
    return session;
  }
}
