import { VolcengineSpeechError } from './volcengine-speech.errors';
import {
  classifyVolcengineTtsFailure,
  VolcengineTtsCapability,
  VolcengineTtsErrorCategory,
} from './volcengine-tts-error-codes';

export class VolcengineTtsError extends VolcengineSpeechError {
  readonly capability: VolcengineTtsCapability;
  readonly category: VolcengineTtsErrorCategory;
  readonly providerCode?: number | string;

  constructor(params: {
    capability: VolcengineTtsCapability;
    message: string;
    providerCode?: number | string;
    httpStatus?: number;
    logId?: string;
    requestId?: string;
    raw?: unknown;
  }) {
    const classification = classifyVolcengineTtsFailure({
      capability: params.capability,
      providerCode: params.providerCode,
      httpStatus: params.httpStatus,
    });
    super({
      message: params.message,
      code: params.providerCode ?? params.httpStatus,
      logId: params.logId,
      requestId: params.requestId,
      retryable: classification.retryable,
      raw: params.raw,
    });
    this.name = 'VolcengineTtsError';
    this.capability = params.capability;
    this.category = classification.category;
    this.providerCode = params.providerCode;
  }
}

/** Adds TTS capability context without discarding the shared transport error. */
export function normalizeVolcengineTtsError(
  error: unknown,
  capability: VolcengineTtsCapability,
): Error {
  if (error instanceof VolcengineTtsError) return error;
  if (error instanceof VolcengineSpeechError) {
    return new VolcengineTtsError({
      capability,
      message: error.message,
      providerCode: error.code,
      logId: error.logId,
      requestId: error.requestId,
      raw: error.raw,
    });
  }
  return error instanceof Error ? error : new Error(String(error));
}
