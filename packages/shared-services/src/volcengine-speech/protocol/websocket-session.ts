import WebSocket from 'ws';
import { VolcengineSpeechTransport } from '../volcengine-speech.transport';
import {
  VolcengineSpeechRequestOptions,
  VolcengineWebSocketCallbacks,
} from '../types';
import {
  VOLCENGINE_WS_MESSAGE_TYPE,
  VolcengineWebSocketCodec,
  VolcengineWebSocketFrame,
} from './websocket-codec';
import { VolcengineSpeechError } from '../errors';

type WebSocketMessageData = Buffer | ArrayBuffer | Buffer[];

export interface VolcengineWebSocketSessionOptions<TEvent = unknown> {
  url: string;
  initPayload?: unknown;
  callbacks?: VolcengineWebSocketCallbacks<TEvent>;
  requestOptions?: VolcengineSpeechRequestOptions;
}

export class VolcengineWebSocketSession<TEvent = unknown> {
  private readonly codec = new VolcengineWebSocketCodec();
  private ws?: WebSocket;
  private sequence = 1;

  constructor(
    private readonly transport: VolcengineSpeechTransport,
    private readonly options: VolcengineWebSocketSessionOptions<TEvent>,
  ) {}

  async connect(): Promise<void> {
    const headers = this.transport.buildHeaders(this.options.requestOptions);
    this.ws = new WebSocket(this.options.url, { headers });

    await new Promise<void>((resolve, reject) => {
      const ws = this.ws;
      if (!ws) {
        reject(new Error('WebSocket was not initialized'));
        return;
      }
      const timeoutMs =
        this.options.requestOptions?.timeoutMs ??
        this.transport.getConfig().timeoutMs;
      let settled = false;
      let timeout: NodeJS.Timeout | undefined;

      const cleanupConnectListeners = () => {
        if (timeout) {
          clearTimeout(timeout);
        }
        ws.off('open', handleOpen);
        ws.off('error', handleConnectError);
      };

      const rejectConnect = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanupConnectListeners();
        this.options.callbacks?.onError?.(error);
        ws.close();
        reject(error);
      };

      const handleConnectError = (error: Error) => {
        rejectConnect(error);
      };

      const handleOpen = () => {
        if (settled) {
          return;
        }
        settled = true;
        cleanupConnectListeners();
        ws.on('error', (error) => {
          this.options.callbacks?.onError?.(error);
        });
        this.options.callbacks?.onOpen?.();
        if (this.options.initPayload !== undefined) {
          this.sendFrame(this.codec.encodeJsonRequest(this.options.initPayload));
        }
        resolve();
      };

      timeout = setTimeout(
        () => rejectConnect(new Error('Volcengine WebSocket connection timed out')),
        timeoutMs,
      );
      ws.once('open', handleOpen);
      ws.once('error', handleConnectError);
      ws.on('message', (data) => this.handleMessage(data));
      ws.on('close', (code, reason) => {
        if (this.ws === ws) {
          this.ws = undefined;
        }
        this.options.callbacks?.onClose?.(code, reason);
      });
    });
  }

  sendJson(payload: unknown, isLast = false): void {
    this.assertOpen();
    const sequence = isLast ? -Math.abs(this.sequence++) : this.sequence++;
    this.sendFrame(this.codec.encodeJsonRequest(payload, sequence));
  }

  sendAudio(audio: Buffer, isLast = false): void {
    this.assertOpen();
    const sequence = isLast ? -Math.abs(this.sequence++) : this.sequence++;
    this.sendFrame(this.codec.encodeAudioRequest(audio, isLast, sequence));
  }

  /**
   * Returns whether the underlying WebSocket is open and can send frames.
   * Returns `false` before `connect()` resolves and after `close()`/connection
   * drop; create a new session instead of reusing a closed one.
   */
  isOpen(): boolean {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  close(): void {
    this.ws?.close();
  }

  private handleMessage(data: WebSocketMessageData): void {
    try {
      const frame = this.codec.decode(toBuffer(data));
      if (frame.messageType === VOLCENGINE_WS_MESSAGE_TYPE.ERROR_RESPONSE) {
        throw new VolcengineSpeechError({
          message: String(frame.json ?? 'Volcengine WebSocket error'),
          code: frame.errorCode,
          raw: frame,
        });
      }
      this.dispatchFrame(frame);
    } catch (error) {
      this.options.callbacks?.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private dispatchFrame(frame: VolcengineWebSocketFrame): void {
    if (frame.json !== undefined) {
      this.options.callbacks?.onEvent?.(frame.json as TEvent);
      return;
    }
    this.options.callbacks?.onAudio?.(frame.payload);
  }

  private assertOpen(): void {
    if (!this.isOpen()) {
      throw new Error('Volcengine WebSocket session is not open');
    }
  }

  private sendFrame(frame: Buffer): void {
    this.assertOpen();
    this.ws?.send(frame, (error) => {
      if (error) {
        this.options.callbacks?.onError?.(error);
      }
    });
  }
}

function toBuffer(data: WebSocketMessageData): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }
  return Buffer.from(data);
}
