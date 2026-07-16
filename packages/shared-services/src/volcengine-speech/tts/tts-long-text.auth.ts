import { VolcengineSpeechRequestOptions } from '../types';
import { VolcengineSpeechValidationError } from '../errors';

export interface VolcengineTtsLongTextCredentials {
  appId: string;
  accessKey: string;
}

/** Builds the legacy long-text headers without leaking them into API-key auth. */
export function buildVolcengineTtsLongTextHeaders(
  credentials: VolcengineTtsLongTextCredentials,
  resourceId: string,
  options: VolcengineSpeechRequestOptions = {},
): Record<string, string> {
  if (!credentials.appId?.trim()) throw new VolcengineSpeechValidationError('longText.appId is required');
  if (!credentials.accessKey?.trim()) throw new VolcengineSpeechValidationError('longText.accessKey is required');
  if (!resourceId?.trim()) throw new VolcengineSpeechValidationError('resourceId is required');
  return {
    'X-Api-App-Id': credentials.appId,
    'X-Api-Access-Key': credentials.accessKey,
    'X-Api-Resource-Id': resourceId,
    ...(options.requestId ? { 'X-Api-Request-Id': options.requestId } : {}),
  };
}
