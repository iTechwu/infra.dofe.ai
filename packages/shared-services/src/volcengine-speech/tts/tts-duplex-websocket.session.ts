import { VolcengineSpeechTransport } from '../volcengine-speech.transport';
import {
  VolcengineTtsDuplexFrame,
  VolcengineTtsDuplexSession,
  VolcengineWebSocketSession,
} from '../protocol';
import { VolcengineSpeechRequestOptions } from '../types';

export interface VolcengineTtsDuplexWebSocketCallbacks {
  onOpen?: () => void;
  onEvent?: (event: VolcengineTtsDuplexFrame) => void;
  onError?: (error: Error) => void;
  onClose?: (code: number, reason: Buffer) => void;
}

/** Product adapter for duplex TTS frames over the shared WebSocket lifecycle. */
export class VolcengineTtsDuplexWebSocketSession {
  private readonly protocol: VolcengineTtsDuplexSession;
  private readonly socket: VolcengineWebSocketSession;

  constructor(
    transport: VolcengineSpeechTransport,
    private readonly callbacks: VolcengineTtsDuplexWebSocketCallbacks = {},
    requestOptions?: VolcengineSpeechRequestOptions,
  ) {
    this.protocol = new VolcengineTtsDuplexSession((frame) => this.socket.sendRaw(frame));
    this.socket = new VolcengineWebSocketSession(transport, {
      url: transport.getConfig().endpoints.ttsDuplexWebSocket,
      requestOptions,
      callbacks: {
        onOpen: () => {
          try {
            this.protocol.startConnection();
            this.callbacks.onOpen?.();
          } catch (error) {
            this.callbacks.onError?.(asError(error));
          }
        },
        onError: (error) => this.callbacks.onError?.(error),
        onClose: (code, reason) => this.callbacks.onClose?.(code, reason),
      },
      rawMessageHandler: (frame) => this.handleServerFrame(frame),
    });
  }

  async connect(): Promise<void> {
    await this.socket.connect();
  }

  startSession(sessionId: string, payload: unknown): void {
    this.protocol.startSession(sessionId, payload);
  }

  sendText(text: string): void {
    this.protocol.sendText(text);
  }

  finishSession(): void {
    this.protocol.finishSession();
  }

  cancelSession(): void {
    this.protocol.cancelSession();
  }

  finishConnection(): void {
    this.protocol.finishConnection();
  }

  close(code?: number, reason?: string | Buffer): void {
    this.socket.close(code, reason);
  }

  isOpen(): boolean {
    return this.socket.isOpen();
  }

  private handleServerFrame(frame: Buffer): void {
    try {
      this.callbacks.onEvent?.(this.protocol.handleServerFrame(frame));
    } catch (error) {
      this.callbacks.onError?.(asError(error));
    }
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
