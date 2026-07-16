import type { StreamingTtsResponse } from '../types';

export type VolcengineTtsAudioFormat = 'mp3' | 'pcm' | 'ogg_opus' | 'wav';

export interface VolcengineTtsAudioParams {
  format?: VolcengineTtsAudioFormat;
  sample_rate?: 8000 | 16000 | 22050 | 24000 | 32000 | 44100 | 48000;
  bit_rate?: number;
  emotion?: string;
  emotion_scale?: number;
  speech_rate?: number;
  loudness_rate?: number;
  enable_subtitle?: boolean;
}

export interface VolcengineTtsHttpRequest {
  user?: { uid?: string };
  req_params: {
    text?: string;
    ssml?: string;
    speaker: string;
    model?: string;
    audio_params: VolcengineTtsAudioParams;
    additions?: Record<string, unknown>;
    mix_speaker?: Record<string, unknown>;
  };
}

/** Request body for the asynchronous long-text submit endpoint. */
export interface VolcengineTtsLongTextSubmitRequest extends VolcengineTtsHttpRequest {
  unique_id?: string;
  namespace?: 'BidirectionalTTS';
}

export type VolcengineTtsHttpResponse = StreamingTtsResponse;
