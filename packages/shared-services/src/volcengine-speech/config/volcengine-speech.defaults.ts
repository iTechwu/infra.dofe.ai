import {
  VolcengineSpeechConfig,
  VolcengineSpeechEndpointConfig,
  VolcengineSpeechResolvedConfig,
} from '../types';

export const defaultVolcengineSpeechEndpoints: VolcengineSpeechEndpointConfig =
  {
    audioGeneration: 'https://openspeech.bytedance.com/api/v3/tts/create',
    ttsStreaming: 'https://openspeech.bytedance.com/api/v3/tts/unidirectional',
    ttsWebSocket: 'wss://openspeech.bytedance.com/api/v3/tts/bidirectional',
    realtime: 'wss://openspeech.bytedance.com/api/v3/realtime/dialogue',
    podcast: 'wss://openspeech.bytedance.com/api/v3/podcast',
    memo: 'https://openspeech.bytedance.com/api/v3/memo',
    voice: 'https://openspeech.bytedance.com/api/v3/voice',
  };

export const defaultVolcengineSpeechConfig: Omit<
  VolcengineSpeechResolvedConfig,
  'apiKey' | 'appId' | 'accessKey' | 'resourceId'
> = {
  authMode: 'api-key',
  region: 'cn-shanghai',
  endpoints: defaultVolcengineSpeechEndpoints,
  timeoutMs: 30000,
  maxRetries: 2,
};

export function resolveVolcengineSpeechConfig(
  speechConfig: VolcengineSpeechConfig,
): VolcengineSpeechResolvedConfig {
  const timeoutMs =
    speechConfig.timeoutMs ??
    speechConfig.timeout ??
    defaultVolcengineSpeechConfig.timeoutMs;
  const maxRetries =
    speechConfig.maxRetries ??
    speechConfig.retryCount ??
    defaultVolcengineSpeechConfig.maxRetries;
  const endpoints = {
    ...defaultVolcengineSpeechEndpoints,
    ...(speechConfig.endpoints ?? {}),
    ...(speechConfig.endpoint
      ? {
          audioGeneration: speechConfig.endpoint,
          ttsStreaming: speechConfig.endpoint,
        }
      : {}),
  };

  return {
    apiKey: speechConfig.apiKey ?? '',
    appId: speechConfig.appId ?? '',
    accessKey: speechConfig.accessKey ?? '',
    resourceId: speechConfig.resourceId ?? '',
    authMode:
      speechConfig.authMode ?? (speechConfig.apiKey ? 'api-key' : 'legacy'),
    region: speechConfig.region ?? defaultVolcengineSpeechConfig.region,
    endpoints: normalizeEndpoints(endpoints),
    timeoutMs: normalizePositiveNumber(timeoutMs, 'timeoutMs'),
    maxRetries: normalizeNonNegativeInteger(maxRetries, 'maxRetries'),
  };
}

function normalizeEndpoints(
  endpoints: VolcengineSpeechEndpointConfig,
): VolcengineSpeechEndpointConfig {
  return {
    audioGeneration: normalizeEndpoint(
      endpoints.audioGeneration,
      'endpoints.audioGeneration',
    ),
    ttsStreaming: normalizeEndpoint(
      endpoints.ttsStreaming,
      'endpoints.ttsStreaming',
    ),
    ttsWebSocket: normalizeEndpoint(
      endpoints.ttsWebSocket,
      'endpoints.ttsWebSocket',
    ),
    realtime: normalizeEndpoint(endpoints.realtime, 'endpoints.realtime'),
    podcast: normalizeEndpoint(endpoints.podcast, 'endpoints.podcast'),
    memo: normalizeEndpoint(endpoints.memo, 'endpoints.memo'),
    voice: normalizeEndpoint(endpoints.voice, 'endpoints.voice'),
  };
}

function normalizeEndpoint(value: string, field: string): string {
  const endpoint = value.trim();
  if (!endpoint) {
    throw new Error(`${field} is required`);
  }

  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error(`${field} must be an absolute URL`);
  }
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) {
    throw new Error(`${field} must use http, https, ws, or wss`);
  }
  return endpoint;
}

function normalizePositiveNumber(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive number`);
  }
  return value;
}

function normalizeNonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return value;
}
