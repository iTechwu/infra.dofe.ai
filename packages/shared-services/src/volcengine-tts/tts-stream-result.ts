import type { TtsResultDto } from './dto/tts.dto';
import type { TtsChunkReducerState } from './tts-stream-reducer';

export interface TtsCloudUploadResult {
  success: boolean;
  cloudUrl?: string;
  error?: string;
}

export interface ResolveTtsStreamResultOptions {
  state: TtsChunkReducerState;
  logId?: string;
  now?: () => number;
  getAudioDuration: (audioData: Buffer) => Promise<number>;
  uploadAudio: (
    audioData: Buffer,
    fileName: string,
  ) => Promise<TtsCloudUploadResult>;
}

/**
 * Maps the reduced Volcengine TTS stream state to the legacy public result.
 *
 * The legacy client still owns NDJSON parsing and TOS upload orchestration, but
 * this pure boundary keeps the result contract testable without real TOS or
 * NestJS dependencies.
 */
export async function resolveTtsStreamResult(
  options: ResolveTtsStreamResultOptions,
): Promise<TtsResultDto> {
  const { state } = options;

  if (state.error) {
    return {
      success: false,
      error: state.error,
    };
  }

  if (state.audioBuffer.length === 0) {
    return {
      success: false,
      error: '未收到音频数据',
    };
  }

  const audioData = state.audioBuffer;
  const fileName = `tts_${(options.now ?? Date.now)()}_${options.logId || 'unknown'}.mp3`;
  const duration = await options.getAudioDuration(audioData);

  try {
    const cloudResult = await options.uploadAudio(audioData, fileName);
    if (cloudResult.success) {
      return {
        success: true,
        audio: cloudResult.cloudUrl,
        duration,
      };
    }

    return {
      success: false,
      error: cloudResult.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
