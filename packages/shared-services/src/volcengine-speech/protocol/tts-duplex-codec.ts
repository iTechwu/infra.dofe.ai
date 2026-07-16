export const VOLCENGINE_TTS_DUPLEX_EVENT = {
  START_CONNECTION: 1,
  FINISH_CONNECTION: 2,
  CONNECTION_STARTED: 50,
  CONNECTION_FAILED: 51,
  CONNECTION_FINISHED: 52,
  START_SESSION: 100,
  CANCEL_SESSION: 101,
  FINISH_SESSION: 102,
  SESSION_STARTED: 150,
  SESSION_CANCELED: 151,
  SESSION_FINISHED: 152,
  SESSION_FAILED: 153,
  USAGE: 154,
  TASK_REQUEST: 200,
  TTS_SENTENCE_START: 350,
  TTS_SENTENCE_END: 351,
  TTS_RESPONSE: 352,
  TTS_SUBTITLE: 364,
} as const;

const CONNECTION_EVENTS = new Set<number>([
  VOLCENGINE_TTS_DUPLEX_EVENT.START_CONNECTION,
  VOLCENGINE_TTS_DUPLEX_EVENT.FINISH_CONNECTION,
  VOLCENGINE_TTS_DUPLEX_EVENT.CONNECTION_STARTED,
  VOLCENGINE_TTS_DUPLEX_EVENT.CONNECTION_FAILED,
  VOLCENGINE_TTS_DUPLEX_EVENT.CONNECTION_FINISHED,
]);

const SERVER_EVENTS = new Set<number>([
  VOLCENGINE_TTS_DUPLEX_EVENT.CONNECTION_STARTED,
  VOLCENGINE_TTS_DUPLEX_EVENT.CONNECTION_FAILED,
  VOLCENGINE_TTS_DUPLEX_EVENT.CONNECTION_FINISHED,
  VOLCENGINE_TTS_DUPLEX_EVENT.SESSION_STARTED,
  VOLCENGINE_TTS_DUPLEX_EVENT.SESSION_CANCELED,
  VOLCENGINE_TTS_DUPLEX_EVENT.SESSION_FINISHED,
  VOLCENGINE_TTS_DUPLEX_EVENT.SESSION_FAILED,
  VOLCENGINE_TTS_DUPLEX_EVENT.USAGE,
  VOLCENGINE_TTS_DUPLEX_EVENT.TTS_SENTENCE_START,
  VOLCENGINE_TTS_DUPLEX_EVENT.TTS_SENTENCE_END,
  VOLCENGINE_TTS_DUPLEX_EVENT.TTS_RESPONSE,
  VOLCENGINE_TTS_DUPLEX_EVENT.TTS_SUBTITLE,
]);

export interface VolcengineTtsDuplexFrame {
  messageType: number;
  event: number;
  sessionId?: string;
  payload: Buffer;
  json?: unknown;
}

/** Codec for the event/session packet layout documented by TTS duplex WS. */
export class VolcengineTtsDuplexCodec {
  encodeClientEvent(params: {
    event: number;
    sessionId?: string;
    payload?: unknown;
  }): Buffer {
    return this.encodeEvent(params, 1);
  }

  encodeServerEvent(params: {
    event: number;
    sessionId?: string;
    payload?: unknown;
  }): Buffer {
    if (!SERVER_EVENTS.has(params.event)) {
      throw new Error('Invalid TTS duplex server event');
    }
    return this.encodeEvent(params, 9);
  }

  private encodeEvent(params: {
    event: number;
    sessionId?: string;
    payload?: unknown;
  }, messageType: number): Buffer {
    const payload = Buffer.from(JSON.stringify(params.payload ?? {}));
    const header = Buffer.from([0x11, (messageType << 4) | 0x04, 0x10, 0x00]);
    const event = Buffer.alloc(4);
    event.writeUInt32BE(params.event);
    const parts = [header, event];
    if (!CONNECTION_EVENTS.has(params.event)) {
      if (!params.sessionId?.trim()) {
        throw new Error('TTS duplex sessionId is required for this event');
      }
      const sessionId = Buffer.from(params.sessionId);
      const sessionSize = Buffer.alloc(4);
      sessionSize.writeUInt32BE(sessionId.length);
      parts.push(sessionSize, sessionId);
    }
    const payloadSize = Buffer.alloc(4);
    payloadSize.writeUInt32BE(payload.length);
    parts.push(payloadSize, payload);
    return Buffer.concat(parts);
  }

  decode(input: Buffer): VolcengineTtsDuplexFrame {
    if (input.length < 12 || input[0] !== 0x11 || (input[1] & 0x0f) !== 4) {
      throw new Error('Invalid TTS duplex WebSocket frame');
    }
    const messageType = input[1] >> 4;
    const event = input.readUInt32BE(4);
    let offset = 8;
    let sessionId: string | undefined;
    if (!CONNECTION_EVENTS.has(event)) {
      if (input.length < offset + 4) throw new Error('Invalid TTS duplex session id');
      const length = input.readUInt32BE(offset);
      offset += 4;
      if (input.length < offset + length) throw new Error('Invalid TTS duplex session id');
      sessionId = input.subarray(offset, offset + length).toString();
      offset += length;
    }
    if (input.length < offset + 4) throw new Error('Invalid TTS duplex payload');
    const length = input.readUInt32BE(offset);
    offset += 4;
    if (input.length < offset + length) throw new Error('Invalid TTS duplex payload');
    const payload = input.subarray(offset, offset + length);
    const frame: VolcengineTtsDuplexFrame = { messageType, event, sessionId, payload };
    if (payload.length) frame.json = JSON.parse(payload.toString());
    return frame;
  }
}
