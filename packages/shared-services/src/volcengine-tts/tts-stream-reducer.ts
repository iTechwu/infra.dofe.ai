/**
 * @fileoverview 火山 TTS NDJSON 流式响应的纯归约逻辑
 *
 * @description 从 {@link VolcengineTtsClient.processStreamResponse} 抽出的纯函数：
 * 给定一个已解析的响应对象，按火山 TTS 流协议更新累积状态（音频缓冲、完成标志、错误信息）。
 * 不做任何 I/O、不依赖 logger，可在无密钥环境下 smoke 验证。
 *
 * 协议分支（与历史内联实现的主循环语义一致，互斥）：
 * - `code === 0 && data`：base64 音频块，追加到 `audioBuffer`。
 * - `code === 0 && sentence`：句子信息，跳过。
 * - `code === VOLCENGINE_SPEECH_SUCCESS_CODE`：完成信号，置 `completed = true`。
 * - `code > 0`（且非上述分支）：错误，记录 `error`。
 *
 * 注意：用互斥分支（提前 return）替代历史“缓冲区剩余数据处理”中的顺序 `if`，
 * 避免 `code === 20000000` 同时命中“完成”与“code > 0 错误”两个分支的潜在误判。
 */

import { VOLCENGINE_SPEECH_SUCCESS_CODE } from '../volcengine-speech/errors';
import type { TtsResponseDto } from './dto/tts.dto';

/**
 * TTS 流归约状态
 */
export interface TtsChunkReducerState {
  /** 累积的音频缓冲（base64 解码后的二进制） */
  audioBuffer: Buffer;
  /** 是否已收到完成信号 */
  completed: boolean;
  /** 错误信息（一旦置位即为终态） */
  error?: string;
}

/**
 * 创建初始归约状态
 */
export function createTtsChunkReducerState(): TtsChunkReducerState {
  return {
    audioBuffer: Buffer.alloc(0),
    completed: false,
  };
}

/**
 * 用一个已解析的响应对象更新归约状态
 *
 * @param state - 当前归约状态（会被原地更新）
 * @param parsed - 从 NDJSON 行解析出的响应对象
 */
export function reduceTtsChunk(
  state: TtsChunkReducerState,
  parsed: TtsResponseDto,
): void {
  // 音频数据块
  if (parsed.code === 0 && parsed.data) {
    const chunk = Buffer.from(parsed.data, 'base64');
    state.audioBuffer = Buffer.concat([state.audioBuffer, chunk]);
    return;
  }

  // 句子信息（无音频，跳过）
  if (parsed.code === 0 && parsed.sentence) {
    return;
  }

  // 完成信号
  if (parsed.code === VOLCENGINE_SPEECH_SUCCESS_CODE) {
    state.completed = true;
    return;
  }

  // 错误（code > 0 且非完成码）
  if (parsed.code !== undefined && parsed.code > 0) {
    state.error = parsed.message || `错误码: ${parsed.code}`;
  }
}
