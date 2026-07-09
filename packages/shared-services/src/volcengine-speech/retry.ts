export interface VolcengineRetryOptions {
  maxRetries: number;
  normalizeError?: (error: unknown) => Error;
  isRetryableError: (error: Error) => boolean;
  getDelayMs?: (attempt: number) => number;
  sleep?: (ms: number) => Promise<void>;
}

export async function executeVolcengineRetry<T>(
  operation: () => Promise<T>,
  options: VolcengineRetryOptions,
): Promise<T> {
  const getDelayMs = options.getDelayMs ?? getVolcengineRetryDelayMs;
  const sleep = options.sleep ?? delay;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const normalized = options.normalizeError
        ? options.normalizeError(error)
        : normalizeUnknownError(error);
      lastError = normalized;
      if (
        attempt >= options.maxRetries ||
        !options.isRetryableError(normalized)
      ) {
        throw normalized;
      }
      await sleep(getDelayMs(attempt));
    }
  }

  throw lastError ?? new Error('Volcengine retry failed without an error');
}

export function getVolcengineRetryDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 5000);
}

function normalizeUnknownError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
