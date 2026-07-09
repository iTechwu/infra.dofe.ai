import { randomUUID } from 'crypto';
import {
  VolcengineSpeechRequestOptions,
  VolcengineSpeechResolvedConfig,
} from '../types';
import { validateRequestOptions } from '../validation';

const RESERVED_HEADER_NAMES = new Set([
  'x-api-key',
  'x-api-request-id',
  'x-api-resource-id',
  'x-api-sequence',
]);

/** 认证所需的最小字段集，供模块复用而不依赖完整的 resolved config */
export interface VolcengineSpeechAuthConfig {
  apiKey: string;
  resourceId: string;
}

/**
 * 构建火山引擎认证头（不含 Content-Type、自定义 header、request id）。
 *
 * @description 从 {@link buildVolcengineSpeechHeaders} 抽出的认证核心，只负责新版控制台
 * `X-Api-Key`（APP Key）和可选 `X-Api-Resource-Id`。旧版控制台的 `X-Api-App-Key` /
 * `X-Api-Access-Key` 已移除，所有火山云调用统一走 `X-Api-Key`。
 * 其它模块（如 `volcengine-tts`）可通过 {@link VolcengineSpeechAuthConfig} 直接调用，
 * 无需构造完整的 {@link VolcengineSpeechResolvedConfig}（含 endpoints 校验）。
 */
export function buildVolcengineAuthHeaders(
  auth: VolcengineSpeechAuthConfig,
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (auth.apiKey) {
    headers['X-Api-Key'] = auth.apiKey;
  }

  if (auth.resourceId) {
    headers['X-Api-Resource-Id'] = auth.resourceId;
  }

  return headers;
}

/**
 * 构建完整的火山引擎 HTTP 请求头（含 Content-Type、自定义 header 过滤、
 * 认证头和 X-Api-Request-Id）。
 */
export function buildVolcengineSpeechHeaders(
  config: VolcengineSpeechResolvedConfig,
  options: VolcengineSpeechRequestOptions = {},
): Record<string, string> {
  validateRequestOptions(options);
  const requestId = options.requestId ?? randomUUID();
  const resourceId = options.resourceId ?? config.resourceId;

  return {
    'Content-Type': 'application/json',
    ...getCustomHeaders(options.headers),
    'X-Api-Request-Id': requestId,
    ...buildVolcengineAuthHeaders({ ...config, resourceId }),
    ...(options.sequence !== undefined
      ? { 'X-Api-Sequence': String(options.sequence) }
      : {}),
  };
}

function getCustomHeaders(
  headers?: Record<string, string>,
): Record<string, string> {
  if (!headers) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(headers).filter(
      ([key]) => !RESERVED_HEADER_NAMES.has(key.toLowerCase()),
    ),
  );
}
