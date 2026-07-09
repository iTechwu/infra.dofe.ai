import type { TtsResponseDto } from './dto/tts.dto';
import {
  createTtsChunkReducerState,
  reduceTtsChunk,
  type TtsChunkReducerState,
} from './tts-stream-reducer';
import {
  resolveTtsStreamResult,
  type TtsCloudUploadResult,
} from './tts-stream-result';

export interface ResolveTtsResponseStreamOptions {
  stream: NodeJS.ReadableStream;
  logId?: string;
  now?: () => number;
  getAudioDuration: (audioData: Buffer) => Promise<number>;
  uploadAudio: (
    audioData: Buffer,
    fileName: string,
  ) => Promise<TtsCloudUploadResult>;
  onParseError?: (error: Error, line: string) => void;
  onState?: (state: TtsChunkReducerState) => void;
}

/**
 * Consumes the legacy Volcengine TTS NDJSON response stream.
 *
 * The HTTP request remains in `VolcengineTtsClient`; this helper owns only the
 * deterministic stream protocol: line buffering, JSON parsing, reducer updates
 * and final legacy result mapping.
 */
export function resolveTtsResponseStream(
  options: ResolveTtsResponseStreamOptions,
): Promise<Awaited<ReturnType<typeof resolveTtsStreamResult>>> {
  return new Promise((resolve, reject) => {
    const state = createTtsChunkReducerState();
    let buffer = '';

    const consumeLine = (line: string): void => {
      if (!line.trim()) {
        return;
      }

      try {
        reduceTtsChunk(state, JSON.parse(line) as TtsResponseDto);
        options.onState?.(state);
      } catch (error) {
        options.onParseError?.(
          error instanceof Error ? error : new Error(String(error)),
          line,
        );
      }
    };

    options.stream.on('data', (chunk: Buffer | string) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        consumeLine(line);
        if (state.completed || state.error) {
          break;
        }
      }
    });

    options.stream.on('end', async () => {
      if (buffer.trim()) {
        consumeLine(buffer);
      }

      resolve(
        await resolveTtsStreamResult({
          state,
          logId: options.logId,
          now: options.now,
          getAudioDuration: options.getAudioDuration,
          uploadAudio: options.uploadAudio,
        }),
      );
    });

    options.stream.on('error', (error: Error) => {
      reject(error);
    });
  });
}
