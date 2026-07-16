import { VolcengineWebSocketSession } from '../protocol';
import { VolcengineSpeechTransport } from '../volcengine-speech.transport';
import { VolcengineSpeechRequestOptions } from '../types';
import { validateTtsHttpRequest } from '../validation';
import { VolcengineTtsHttpRequest } from './tts.types';

export type VolcengineTtsOneWayEventName =
  | 'TTSSentenceStart'
  | 'TTSResponse'
  | 'TTSSentenceEnd'
  | 'TTSSubtitle'
  | 'SessionFinished';

export interface VolcengineTtsOneWayEvent {
  event?: VolcengineTtsOneWayEventName;
  [key: string]: unknown;
}

export interface VolcengineTtsOneWayWebSocketCallbacks {
  onOpen?: () => void;
  onEvent?: (event: VolcengineTtsOneWayEvent) => void;
  onAudio?: (audio: Buffer) => void;
  onError?: (error: Error) => void;
  onClose?: (code: number, reason: Buffer) => void;
}

/** One-way TTS accepts a single init request and only receives server output. */
export class VolcengineTtsOneWayWebSocketSession {
  private readonly socket: VolcengineWebSocketSession<VolcengineTtsOneWayEvent>;

  constructor(
    transport: VolcengineSpeechTransport,
    request: VolcengineTtsHttpRequest,
    callbacks: VolcengineTtsOneWayWebSocketCallbacks = {},
    requestOptions?: VolcengineSpeechRequestOptions,
  ) {
    validateTtsHttpRequest(request);
    this.socket = new VolcengineWebSocketSession(transport, {
      url: transport.getConfig().endpoints.ttsOneWayWebSocket,
      initPayload: request,
      requestOptions,
      callbacks,
    });
  }

  async connect(): Promise<void> {
    await this.socket.connect();
  }

  isOpen(): boolean {
    return this.socket.isOpen();
  }

  close(code?: number, reason?: string | Buffer): void {
    this.socket.close(code, reason);
  }
}
