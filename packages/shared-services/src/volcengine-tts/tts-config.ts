/**
 * @fileoverview 火山 TTS runtime 配置归一化
 *
 * @description 旧 `volcengine-tts` 仍保留自己的 TOS / bucket / secretKey 配置形状；
 * 本模块只把可共享的 endpoint、timeout、retry 数值校验委托到统一
 * `volcengine-speech` 配置 helper，避免复制配置边界规则。
 */

import {
  defaultVolcengineSpeechEndpoints,
  normalizeVolcengineEndpoint,
  normalizeVolcengineNonNegativeInteger,
  normalizeVolcenginePositiveNumber,
} from '../volcengine-speech/config/volcengine-speech.defaults';

export const VOLCENGINE_TTS_DEFAULT_MAX_RETRIES = 0;

export interface VolcengineTtsRuntimeConfigInput {
  endpoint?: string;
  timeoutMs?: number;
  timeout?: number;
  maxRetries?: number;
  retryCount?: number;
}

export interface VolcengineTtsRuntimeConfig {
  endpoint: string;
  timeoutMs?: number;
  maxRetries: number;
}

export function resolveVolcengineTtsRuntimeConfig(
  config: VolcengineTtsRuntimeConfigInput,
): VolcengineTtsRuntimeConfig {
  const timeoutMs = config.timeoutMs ?? config.timeout;
  const maxRetries =
    config.maxRetries ??
    config.retryCount ??
    VOLCENGINE_TTS_DEFAULT_MAX_RETRIES;

  return {
    endpoint: normalizeVolcengineEndpoint(
      config.endpoint ?? defaultVolcengineSpeechEndpoints.ttsStreaming,
      'endpoint',
    ),
    timeoutMs:
      timeoutMs === undefined
        ? undefined
        : normalizeVolcenginePositiveNumber(timeoutMs, 'timeoutMs'),
    maxRetries: normalizeVolcengineNonNegativeInteger(maxRetries, 'maxRetries'),
  };
}
