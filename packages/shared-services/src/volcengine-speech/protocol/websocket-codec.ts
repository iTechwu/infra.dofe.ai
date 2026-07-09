import { gzipSync, gunzipSync } from 'zlib';

export const VOLCENGINE_WS_MESSAGE_TYPE = {
  FULL_CLIENT_REQUEST: 0b0001,
  AUDIO_ONLY_CLIENT_REQUEST: 0b0010,
  FULL_SERVER_RESPONSE: 0b1001,
  ERROR_RESPONSE: 0b1111,
} as const;

export const VOLCENGINE_WS_MESSAGE_FLAGS = {
  NO_SEQUENCE: 0b0000,
  POSITIVE_SEQUENCE: 0b0001,
  LAST_PACKET_NO_SEQUENCE: 0b0010,
  LAST_PACKET_WITH_SEQUENCE: 0b0011,
} as const;

export const VOLCENGINE_WS_SERIALIZATION = {
  NONE: 0b0000,
  JSON: 0b0001,
} as const;

export const VOLCENGINE_WS_COMPRESSION = {
  NONE: 0b0000,
  GZIP: 0b0001,
} as const;

export interface VolcengineWebSocketFrame {
  version: number;
  headerSize: number;
  messageType: number;
  flags: number;
  serialization: number;
  compression: number;
  sequence?: number;
  payload: Buffer;
  json?: unknown;
  errorCode?: number;
  isLast: boolean;
}

export class VolcengineWebSocketCodec {
  encodeJsonRequest(payload: unknown, sequence?: number): Buffer {
    return this.encode({
      messageType: VOLCENGINE_WS_MESSAGE_TYPE.FULL_CLIENT_REQUEST,
      flags:
        sequence === undefined
          ? VOLCENGINE_WS_MESSAGE_FLAGS.NO_SEQUENCE
          : sequence < 0
            ? VOLCENGINE_WS_MESSAGE_FLAGS.LAST_PACKET_WITH_SEQUENCE
            : VOLCENGINE_WS_MESSAGE_FLAGS.POSITIVE_SEQUENCE,
      serialization: VOLCENGINE_WS_SERIALIZATION.JSON,
      compression: VOLCENGINE_WS_COMPRESSION.GZIP,
      sequence,
      payload: Buffer.from(JSON.stringify(payload), 'utf-8'),
    });
  }

  encodeAudioRequest(audio: Buffer, isLast = false, sequence?: number): Buffer {
    return this.encode({
      messageType: VOLCENGINE_WS_MESSAGE_TYPE.AUDIO_ONLY_CLIENT_REQUEST,
      flags:
        sequence === undefined
          ? isLast
            ? VOLCENGINE_WS_MESSAGE_FLAGS.LAST_PACKET_NO_SEQUENCE
            : VOLCENGINE_WS_MESSAGE_FLAGS.NO_SEQUENCE
          : isLast
            ? VOLCENGINE_WS_MESSAGE_FLAGS.LAST_PACKET_WITH_SEQUENCE
            : VOLCENGINE_WS_MESSAGE_FLAGS.POSITIVE_SEQUENCE,
      serialization: VOLCENGINE_WS_SERIALIZATION.NONE,
      compression: VOLCENGINE_WS_COMPRESSION.GZIP,
      sequence,
      payload: audio,
    });
  }

  decode(input: Buffer): VolcengineWebSocketFrame {
    if (input.length < 8) {
      throw new Error('Invalid Volcengine WebSocket frame: too short');
    }

    const version = (input[0] >> 4) & 0x0f;
    const headerSize = (input[0] & 0x0f) * 4;
    const messageType = (input[1] >> 4) & 0x0f;
    const flags = input[1] & 0x0f;
    const serialization = (input[2] >> 4) & 0x0f;
    const compression = input[2] & 0x0f;

    if (messageType === VOLCENGINE_WS_MESSAGE_TYPE.ERROR_RESPONSE) {
      return this.decodeErrorFrame(input, {
        version,
        headerSize,
        messageType,
        flags,
        serialization,
        compression,
      });
    }

    let offset = headerSize;
    let sequence: number | undefined;
    if (
      flags === VOLCENGINE_WS_MESSAGE_FLAGS.POSITIVE_SEQUENCE ||
      flags === VOLCENGINE_WS_MESSAGE_FLAGS.LAST_PACKET_WITH_SEQUENCE
    ) {
      if (input.length < offset + 4) {
        throw new Error('Invalid Volcengine WebSocket frame: missing sequence');
      }
      sequence = input.readInt32BE(offset);
      offset += 4;
    }

    if (input.length < offset + 4) {
      throw new Error('Invalid Volcengine WebSocket frame: missing payload size');
    }
    const payloadSize = input.readUInt32BE(offset);
    offset += 4;
    if (input.length < offset + payloadSize) {
      throw new Error('Invalid Volcengine WebSocket frame: incomplete payload');
    }
    const payload = input.slice(offset, offset + payloadSize);
    const decompressed =
      compression === VOLCENGINE_WS_COMPRESSION.GZIP
        ? gunzipSync(payload)
        : payload;

    const frame: VolcengineWebSocketFrame = {
      version,
      headerSize,
      messageType,
      flags,
      serialization,
      compression,
      sequence,
      payload: decompressed,
      isLast:
        flags === VOLCENGINE_WS_MESSAGE_FLAGS.LAST_PACKET_NO_SEQUENCE ||
        flags === VOLCENGINE_WS_MESSAGE_FLAGS.LAST_PACKET_WITH_SEQUENCE,
    };

    if (serialization === VOLCENGINE_WS_SERIALIZATION.JSON) {
      frame.json = JSON.parse(decompressed.toString('utf-8'));
    }

    return frame;
  }

  private encode(params: {
    messageType: number;
    flags: number;
    serialization: number;
    compression: number;
    sequence?: number;
    payload: Buffer;
  }): Buffer {
    const header = Buffer.alloc(4);
    header[0] = (0b0001 << 4) | 0b0001;
    header[1] = (params.messageType << 4) | params.flags;
    header[2] = (params.serialization << 4) | params.compression;
    header[3] = 0x00;

    const payload =
      params.compression === VOLCENGINE_WS_COMPRESSION.GZIP
        ? gzipSync(params.payload)
        : params.payload;
    const payloadSize = Buffer.alloc(4);
    payloadSize.writeUInt32BE(payload.length, 0);

    const parts: Buffer[] = [header];
    if (params.sequence !== undefined) {
      const sequence = Buffer.alloc(4);
      sequence.writeInt32BE(params.sequence, 0);
      parts.push(sequence);
    }
    parts.push(payloadSize, payload);
    return Buffer.concat(parts);
  }

  private decodeErrorFrame(
    input: Buffer,
    frame: Omit<VolcengineWebSocketFrame, 'payload' | 'isLast'>,
  ): VolcengineWebSocketFrame {
    if (input.length < 12) {
      throw new Error('Invalid Volcengine WebSocket error frame: too short');
    }
    const errorCode = input.readUInt32BE(4);
    const errorSize = input.readUInt32BE(8);
    if (input.length < 12 + errorSize) {
      throw new Error('Invalid Volcengine WebSocket error frame: incomplete payload');
    }
    const payload = input.slice(12, 12 + errorSize);
    return {
      ...frame,
      payload,
      json: payload.toString('utf-8'),
      errorCode,
      isLast: true,
    };
  }
}
