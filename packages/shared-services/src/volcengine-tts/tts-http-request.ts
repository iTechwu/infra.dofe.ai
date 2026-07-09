import type { TtsPayload } from './tts-payload';
import type { TtsResultDto } from './dto/tts.dto';
import {
  resolveTtsResponseStream,
  type ResolveTtsResponseStreamOptions,
} from './tts-stream-processor';
import { readVolcengineHeader } from '../volcengine-speech/headers';
import { executeVolcengineRetry } from '../volcengine-speech/retry';
import {
  normalizeVolcengineHttpError,
  VolcengineSpeechError,
} from '../volcengine-speech/errors';

export interface TtsHttpResponse {
  headers?: Record<string, unknown>;
  data: NodeJS.ReadableStream;
}

export interface ExecuteTtsHttpRequestOptions {
  url: string;
  headers: Record<string, string>;
  payload: TtsPayload;
  timeoutMs?: number;
  maxRetries: number;
  post: (params: {
    url: string;
    payload: TtsPayload;
    headers: Record<string, string>;
    timeoutMs?: number;
  }) => Promise<TtsHttpResponse>;
  resolveStream: (params: {
    stream: NodeJS.ReadableStream;
    logId?: string;
  }) => Promise<TtsResultDto>;
}

export async function executeTtsHttpRequest(
  options: ExecuteTtsHttpRequestOptions,
): Promise<TtsResultDto> {
  const response = await executeVolcengineRetry(
    () =>
      options.post({
        url: options.url,
        payload: options.payload,
        headers: options.headers,
        timeoutMs: options.timeoutMs,
      }),
    {
      maxRetries: options.maxRetries,
      normalizeError: (error) => normalizeVolcengineHttpError(error),
      isRetryableError: (error) =>
        error instanceof VolcengineSpeechError && error.retryable,
    },
  );

  const logId = readVolcengineHeader(response.headers, 'x-tt-logid');
  return options.resolveStream({ stream: response.data, logId });
}

export type TtsResponseStreamDeps = Pick<
  ResolveTtsResponseStreamOptions,
  'getAudioDuration' | 'uploadAudio' | 'onParseError' | 'onState'
>;

export function createTtsResponseStreamResolver(
  deps: TtsResponseStreamDeps,
): ExecuteTtsHttpRequestOptions['resolveStream'] {
  return ({ stream, logId }) =>
    resolveTtsResponseStream({
      ...deps,
      stream,
      logId,
    });
}
