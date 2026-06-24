/**
 * Browser error normalization utilities.
 *
 * Standardizes error objects from various sources (fetch, ts-rest, zod)
 * into a consistent format suitable for toast notifications and error displays.
 */

export interface NormalizedError {
  message: string;
  code?: string | number;
  status?: number;
  details?: unknown;
}

/**
 * Normalize an error from various sources into a consistent shape.
 */
export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof Error) {
    return {
      message: error.message,
      details: error,
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;

    // ts-rest error shape: { status, body: { message, code } }
    if ('body' in err && err.body && typeof err.body === 'object') {
      const body = err.body as Record<string, unknown>;
      return {
        message: String(body.message || body.msg || 'An error occurred'),
        code: body.code as string | undefined,
        status: err.status as number | undefined,
        details: body,
      };
    }

    // Generic API error shape: { code, msg, message }
    return {
      message: String(err.message || err.msg || 'An error occurred'),
      code: err.code as string | undefined,
      status: err.status as number | undefined,
      details: error,
    };
  }

  return { message: 'An unknown error occurred' };
}

/**
 * Simple deduplication key for toast-like error displays.
 * Two errors with the same key should not both be shown.
 */
export function errorToastKey(error: NormalizedError): string {
  return `${error.code ?? 'unknown'}:${error.message.slice(0, 50)}`;
}
