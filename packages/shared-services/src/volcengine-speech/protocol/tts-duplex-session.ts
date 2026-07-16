import {
  VOLCENGINE_TTS_DUPLEX_EVENT,
  VolcengineTtsDuplexCodec,
  VolcengineTtsDuplexFrame,
} from './tts-duplex-codec';

type DuplexState = 'idle' | 'open' | 'session-open' | 'closed';

/** Local state machine for documented duplex TTS client events. */
export class VolcengineTtsDuplexSession {
  private readonly codec = new VolcengineTtsDuplexCodec();
  private state: DuplexState = 'idle';
  private sessionId?: string;

  constructor(private readonly sendFrame: (frame: Buffer) => void) {}

  startConnection(payload: unknown = {}): void {
    if (this.state !== 'idle') throw new Error('TTS duplex connection is already started');
    this.send(VOLCENGINE_TTS_DUPLEX_EVENT.START_CONNECTION, undefined, payload);
    this.state = 'open';
  }

  startSession(sessionId: string, payload: unknown): void {
    if (this.state !== 'open') throw new Error('TTS duplex connection is not open');
    if (!sessionId.trim()) throw new Error('TTS duplex sessionId is required');
    this.send(VOLCENGINE_TTS_DUPLEX_EVENT.START_SESSION, sessionId, payload);
    this.sessionId = sessionId;
    this.state = 'session-open';
  }

  sendText(text: string): void {
    this.assertSessionOpen();
    if (!text.trim()) throw new Error('TTS duplex text is required');
    this.send(VOLCENGINE_TTS_DUPLEX_EVENT.TASK_REQUEST, this.sessionId, { text });
  }

  finishSession(): void {
    this.assertSessionOpen();
    this.send(VOLCENGINE_TTS_DUPLEX_EVENT.FINISH_SESSION, this.sessionId, {});
    this.sessionId = undefined;
    this.state = 'open';
  }

  cancelSession(): void {
    this.assertSessionOpen();
    this.send(VOLCENGINE_TTS_DUPLEX_EVENT.CANCEL_SESSION, this.sessionId, {});
    this.sessionId = undefined;
    this.state = 'open';
  }

  finishConnection(): void {
    if (this.state === 'closed' || this.state === 'idle' || this.state === 'session-open') {
      throw new Error('TTS duplex connection is not open');
    }
    this.send(VOLCENGINE_TTS_DUPLEX_EVENT.FINISH_CONNECTION, undefined, {});
    this.state = 'closed';
  }

  /** Validates and applies a server event before product code dispatches it. */
  handleServerFrame(frame: Buffer): VolcengineTtsDuplexFrame {
    const decoded = this.codec.decode(frame);
    if (decoded.messageType !== 9) {
      throw new Error('TTS duplex frame is not a server response');
    }
    if (this.state === 'idle' || this.state === 'closed') {
      throw new Error('TTS duplex connection is not open');
    }

    switch (decoded.event) {
      case VOLCENGINE_TTS_DUPLEX_EVENT.CONNECTION_STARTED:
      case VOLCENGINE_TTS_DUPLEX_EVENT.USAGE:
        return decoded;
      case VOLCENGINE_TTS_DUPLEX_EVENT.CONNECTION_FAILED:
      case VOLCENGINE_TTS_DUPLEX_EVENT.CONNECTION_FINISHED:
        this.sessionId = undefined;
        this.state = 'closed';
        return decoded;
      case VOLCENGINE_TTS_DUPLEX_EVENT.SESSION_STARTED:
      case VOLCENGINE_TTS_DUPLEX_EVENT.SESSION_CANCELED:
      case VOLCENGINE_TTS_DUPLEX_EVENT.SESSION_FINISHED:
      case VOLCENGINE_TTS_DUPLEX_EVENT.SESSION_FAILED:
      case VOLCENGINE_TTS_DUPLEX_EVENT.TTS_SENTENCE_START:
      case VOLCENGINE_TTS_DUPLEX_EVENT.TTS_SENTENCE_END:
      case VOLCENGINE_TTS_DUPLEX_EVENT.TTS_RESPONSE:
      case VOLCENGINE_TTS_DUPLEX_EVENT.TTS_SUBTITLE:
        this.assertMatchingSession(decoded);
        if (
          decoded.event === VOLCENGINE_TTS_DUPLEX_EVENT.SESSION_CANCELED ||
          decoded.event === VOLCENGINE_TTS_DUPLEX_EVENT.SESSION_FINISHED ||
          decoded.event === VOLCENGINE_TTS_DUPLEX_EVENT.SESSION_FAILED
        ) {
          this.sessionId = undefined;
          this.state = 'open';
        }
        return decoded;
      default:
        throw new Error(`Unexpected TTS duplex server event: ${decoded.event}`);
    }
  }

  private assertSessionOpen(): void {
    if (this.state !== 'session-open' || !this.sessionId) {
      throw new Error('TTS duplex session is not open');
    }
  }

  private assertMatchingSession(frame: VolcengineTtsDuplexFrame): void {
    this.assertSessionOpen();
    if (frame.sessionId !== this.sessionId) {
      throw new Error('TTS duplex server sessionId does not match the open session');
    }
  }

  private send(event: number, sessionId: string | undefined, payload: unknown): void {
    this.sendFrame(this.codec.encodeClientEvent({ event, sessionId, payload }));
  }
}
