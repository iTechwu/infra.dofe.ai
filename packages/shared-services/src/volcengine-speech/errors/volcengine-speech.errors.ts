import { BadGatewayException } from '@nestjs/common';
import { readVolcengineHeader } from '../headers';

export const VOLCENGINE_SPEECH_SUCCESS_CODE = 20000000;

export class VolcengineSpeechValidationError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'VolcengineSpeechValidationError';
    this.field = field;
  }
}

export class VolcengineSpeechError extends BadGatewayException {
  readonly code?: number | string;
  readonly logId?: string;
  readonly requestId?: string;
  readonly retryable: boolean;
  readonly raw?: unknown;

  constructor(params: {
    message: string;
    code?: number | string;
    logId?: string;
    requestId?: string;
    retryable?: boolean;
    raw?: unknown;
  }) {
    super({
      message: params.message,
      code: params.code,
      logId: params.logId,
      requestId: params.requestId,
    });
    this.code = params.code;
    this.logId = params.logId;
    this.requestId = params.requestId;
    this.retryable = params.retryable ?? isRetryableVolcengineSpeechCode(params.code);
    this.raw = params.raw;
  }
}

export function isRetryableVolcengineSpeechCode(
  code?: number | string,
): boolean {
  if (code === undefined) {
    return false;
  }
  const normalized = Number(code);
  if (Number.isNaN(normalized)) {
    return false;
  }
  return normalized >= 50000000 || normalized === 45000081;
}

export function assertVolcengineSpeechSuccess(params: {
  body: Record<string, unknown> | undefined;
  logId?: string;
  requestId?: string;
}): void {
  const code = params.body?.code;
  if (code === undefined || code === 0 || code === VOLCENGINE_SPEECH_SUCCESS_CODE) {
    return;
  }

  throw new VolcengineSpeechError({
    message: typeof params.body?.message === 'string'
      ? params.body.message
      : `Volcengine speech request failed: ${String(code)}`,
    code: typeof code === 'number' || typeof code === 'string' ? code : String(code),
    logId: params.logId,
    requestId: params.requestId,
    raw: params.body,
  });
}

export function assertVolcengineHeaderStatusSuccess(params: {
  statusCode?: string;
  statusMessage?: string;
  logId?: string;
  requestId?: string;
  raw?: unknown;
}): void {
  const statusCode = normalizeHeaderStatusValue(params.statusCode);
  if (!statusCode || statusCode === String(VOLCENGINE_SPEECH_SUCCESS_CODE)) {
    return;
  }
  const statusMessage = normalizeHeaderStatusValue(params.statusMessage);

  throw new VolcengineSpeechError({
    message:
      statusMessage ??
      `Volcengine speech request failed: ${statusCode}`,
    code: statusCode,
    logId: params.logId,
    requestId: params.requestId,
    raw: params.raw,
  });
}

function normalizeHeaderStatusValue(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNABORTED',
  'ENETUNREACH',
  'EAI_AGAIN',
]);

export function isRetryableHttpStatus(status: number | undefined): boolean {
  if (status === undefined) {
    return true;
  }
  return status >= 500;
}

/**
 * Normalizes axios-style HTTP/network errors into {@link VolcengineSpeechError}
 * so callers always observe a unified upstream error shape with `requestId`,
 * `logId`, `code` (HTTP status) and `retryable`. The original error is retained
 * in `raw`; non-HTTP errors (e.g. programming mistakes) are returned unchanged.
 */
export function normalizeVolcengineHttpError(
  error: unknown,
  context: { requestId?: string } = {},
): Error {
  if (error instanceof VolcengineSpeechError) {
    return error;
  }
  if (!error || typeof error !== 'object') {
    return error instanceof Error ? error : new Error(String(error));
  }

  const axiosLike = error as {
    message?: string;
    code?: string;
    response?: {
      status?: number;
      headers?: Record<string, unknown>;
    };
  };
  const response = axiosLike.response;
  const networkCode =
    typeof axiosLike.code === 'string' ? axiosLike.code : undefined;

  if (response === undefined && !networkCode) {
    return error instanceof Error ? error : new Error(String(error));
  }

  const status = response?.status;
  const retryable =
    isRetryableHttpStatus(status) || RETRYABLE_NETWORK_CODES.has(networkCode ?? '');

  return new VolcengineSpeechError({
    message:
      (typeof axiosLike.message === 'string' && axiosLike.message) ||
      (response === undefined
        ? `Volcengine speech HTTP request failed: ${networkCode ?? 'network error'}`
        : `Volcengine speech HTTP request failed with status ${status ?? 'unknown'}`),
    code: status,
    logId: readVolcengineHeader(response?.headers, 'x-tt-logid'),
    requestId: context.requestId,
    retryable,
    raw: error,
  });
}
