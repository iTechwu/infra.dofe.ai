/**
 * @fileoverview 火山 TTS 请求体构造的纯函数
 *
 * @description 从 {@link VolcengineTtsClient.textToSpeech} 抽出的纯逻辑：
 * 给定请求参数和已解析的 speaker，构造符合火山 seed-tts 协议的请求体。
 * 不做任何 I/O，可在无密钥环境下 smoke 验证请求契约。
 *
 * 注意：默认 speaker 的解析（`getRandomVoice`，依赖 OpenAPI）仍留在 client 内，
 * 因为它是异步副作用；本函数只负责确定性的请求体拼装。
 */

import type { TtsRequestDto } from './dto/tts.dto';

/** seed-tts 默认模型标识 */
export const TTS_DEFAULT_MODEL = 'seed-tts-1.1';

/** 火山 TTS 请求体 */
export interface TtsPayload {
  req_params: {
    text: string;
    model: string;
    speaker: string;
    additions: string;
    audio_params: {
      format: string;
      sample_rate: number;
      speech_rate: number;
      loudness_rate: number;
    };
  };
}

/**
 * 构造火山 TTS 请求体
 *
 * @param request - TTS 请求参数（text / speaker 占位 / pitch / speech_rate / loudness_rate）
 * @param speaker - 已解析的 speaker id（由调用方负责默认值/随机选取）
 * @returns 符合 seed-tts 协议的请求体
 */
export function buildTtsPayload(
  request: TtsRequestDto,
  speaker: string,
): TtsPayload {
  return {
    req_params: {
      text: request.text,
      model: TTS_DEFAULT_MODEL,
      speaker,
      additions: JSON.stringify({
        disable_markdown_filter: true,
        enable_language_detector: true,
        enable_latex_tn: true,
        disable_default_bit_rate: true,
        max_length_to_filter_parenthesis: 0,
        cache_config: {
          text_type: 1,
          use_cache: true,
        },
        post_process: {
          pitch: request.pitch || 0,
        },
      }),
      audio_params: {
        format: 'mp3',
        sample_rate: 32000,
        speech_rate: request.speech_rate || 0,
        loudness_rate: request.loudness_rate || 0,
      },
    },
  };
}
