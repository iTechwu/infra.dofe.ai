export interface VolcengineVoiceAudioInput {
  data: string;
  format: string;
}

export interface VolcengineVoiceTrainingRequest {
  speaker_id: string;
  audio: VolcengineVoiceAudioInput;
  text?: string;
  language?: string;
  extra_params?: {
    demo_text?: string;
    enable_audio_denoise?: boolean;
    disable_volume_normalization?: boolean;
  };
}

export interface VolcengineVoiceLookupRequest {
  speaker_id: string;
  custom_speaker_id?: string;
}

export interface VolcengineVoiceDesignRequest {
  speaker_id: string;
  prompt: string;
  text_prompt?: string;
  image_url?: string;
  image_bytes?: string;
  language?: 0 | 1;
}

export type VolcengineVoiceTrainingStatus = 0 | 1 | 2 | 3 | 4;

export interface VolcengineVoiceProfile {
  speaker_id?: string;
  status?: VolcengineVoiceTrainingStatus;
  speaker_status?: string;
  model_type?: number;
  language?: string;
  create_time?: string;
  available_training_times?: number;
  demo_audio?: string;
}
