import { Readable } from 'stream';

export interface VolcengineSpeechEndpointConfig {
  audioGeneration: string;
  ttsStreaming: string;
  ttsWebSocket: string;
  asrStandard: string;
  asrFast: string;
  asrOffPeak: string;
  realtime: string;
  interpretation: string;
  streamingAsr: string;
  podcast: string;
  memo: string;
  voice: string;
}

export interface VolcengineSpeechConfig {
  apiKey?: string;
  resourceId?: string;
  region?: string;
  endpoints?: Partial<VolcengineSpeechEndpointConfig>;
  endpoint?: string;
  timeoutMs?: number;
  timeout?: number;
  maxRetries?: number;
  retryCount?: number;
}

export interface VolcengineSpeechResolvedConfig {
  apiKey: string;
  resourceId: string;
  region: string;
  endpoints: VolcengineSpeechEndpointConfig;
  timeoutMs: number;
  maxRetries: number;
}

export interface VolcengineSpeechRequestOptions {
  requestId?: string;
  resourceId?: string;
  sequence?: number;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface VolcengineSpeechApiResponse<T = unknown> {
  code?: number;
  message?: string;
  data?: T;
  result?: T;
  audio?: string;
  url?: string;
  duration?: number;
  original_duration?: number;
  subtitle?: VolcengineSpeechSubtitle;
  [key: string]: unknown;
}

export interface VolcengineSpeechResult<T = unknown> {
  data: T;
  requestId?: string;
  logId?: string;
  raw: unknown;
}

export interface VolcengineSpeechSubtitleToken {
  start_time: number;
  end_time: number;
  text: string;
}

export interface VolcengineSpeechSubtitleSentence
  extends VolcengineSpeechSubtitleToken {
  words?: VolcengineSpeechSubtitleToken[];
}

export interface VolcengineSpeechSubtitle {
  text: string;
  sentences?: VolcengineSpeechSubtitleSentence[];
}

export interface VolcengineSpeechAudioConfig {
  format?: 'wav' | 'mp3' | 'pcm' | 'ogg_opus';
  sample_rate?: 8000 | 16000 | 24000 | 32000 | 44100 | 48000;
  speech_rate?: number;
  loudness_rate?: number;
  pitch_rate?: number;
  enable_subtitle?: boolean;
}

export interface VolcengineSpeechWatermarkConfig {
  aigc_watermark?: boolean;
  aigc_metadata?: {
    enable?: boolean;
    content_producer?: string;
    produce_id?: string;
    content_propagator?: string;
    propagate_id?: string;
  };
}

export type VolcengineSpeechReference =
  | {
      speaker: string;
      audio_data?: never;
      audio_url?: never;
      image_data?: never;
      image_url?: never;
    }
  | {
      audio_data: string;
      speaker?: never;
      audio_url?: never;
      image_data?: never;
      image_url?: never;
    }
  | {
      audio_url: string;
      speaker?: never;
      audio_data?: never;
      image_data?: never;
      image_url?: never;
    }
  | {
      image_data: string;
      speaker?: never;
      audio_data?: never;
      audio_url?: never;
      image_url?: never;
    }
  | {
      image_url: string;
      speaker?: never;
      audio_data?: never;
      audio_url?: never;
      image_data?: never;
    };

export interface CreateAudioRequest {
  model: string;
  text_prompt: string;
  references?: VolcengineSpeechReference[];
  audio_config?: VolcengineSpeechAudioConfig;
  watermark?: VolcengineSpeechWatermarkConfig;
}

export interface CreateAudioResponse {
  audio?: string;
  url?: string;
  duration?: number;
  originalDuration?: number;
  subtitle?: VolcengineSpeechSubtitle;
}

export interface StreamingTtsRequest {
  text: string;
  speaker?: string;
  model?: string;
  audio_config?: VolcengineSpeechAudioConfig;
  extra?: Record<string, unknown>;
}

export interface StreamingTtsResponse {
  stream: Readable;
  requestId?: string;
  logId?: string;
}

export interface VolcengineSpeechTaskRequest {
  audioUrl?: string;
  resourceUrl?: string;
  callbackUrl?: string;
  options?: Record<string, unknown>;
}

export interface VolcengineSpeechTaskResult<T = unknown> {
  taskId: string;
  status?: string;
  statusCode?: string;
  statusMessage?: string;
  result?: T;
  error?: string;
  requestId?: string;
  logId?: string;
  raw: unknown;
}

export type VolcengineAsrMode = 'standard' | 'fast' | 'offPeak';

export interface VolcengineAsrRequest {
  audioUrl: string;
  callbackUrl?: string;
  mode?: VolcengineAsrMode;
  resourceId?: string;
  options?: Record<string, unknown>;
}

export interface VolcengineInterpretationRequest {
  session_id?: string;
  source_language?: string;
  target_language?: string;
  audio_format?: string;
  sample_rate?: number;
  [key: string]: unknown;
}

export interface VolcengineStreamingAsrRequest {
  user?: { uid?: string; [key: string]: unknown };
  audio?: {
    format?: string;
    rate?: number;
    bits?: number;
    channel?: number;
    codec?: string;
    language?: string;
    [key: string]: unknown;
  };
  request?: { model_name?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface VolcengineVoiceRequest {
  action: string;
  body?: Record<string, unknown>;
  query?: Record<string, string | number | boolean | undefined>;
}

export interface VolcengineWebSocketCallbacks<TEvent = unknown> {
  onOpen?: () => void;
  onEvent?: (event: TEvent) => void;
  onAudio?: (audio: Buffer) => void;
  onError?: (error: Error) => void;
  onClose?: (code: number, reason: Buffer) => void;
}
