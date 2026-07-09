import { randomUUID } from 'crypto';
import {
  VolcengineSpeechRequestOptions,
  VolcengineSpeechResolvedConfig,
} from '../types';
import { validateRequestOptions } from '../validation';

const RESERVED_HEADER_NAMES = new Set([
  'x-api-key',
  'x-api-app-id',
  'x-api-access-key',
  'x-api-request-id',
  'x-api-resource-id',
]);

export function buildVolcengineSpeechHeaders(
  config: VolcengineSpeechResolvedConfig,
  options: VolcengineSpeechRequestOptions = {},
): Record<string, string> {
  validateRequestOptions(options);
  const requestId = options.requestId ?? randomUUID();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getCustomHeaders(options.headers),
    'X-Api-Request-Id': requestId,
  };

  if (config.authMode === 'api-key') {
    headers['X-Api-Key'] = config.apiKey;
  } else {
    headers['X-Api-App-Id'] = config.appId;
    headers['X-Api-Access-Key'] = config.accessKey;
  }

  if (config.resourceId) {
    headers['X-Api-Resource-Id'] = config.resourceId;
  }

  return headers;
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
