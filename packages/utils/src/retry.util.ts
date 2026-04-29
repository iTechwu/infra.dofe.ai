/**
 * Shared retry utility — replaces scattered hand-rolled retry loops.
 */

export interface RetryOptions {
  maxRetries: number;
  delayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<Pick<RetryOptions, 'delayMs'>> = {
  delayMs: 1000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    maxRetries,
    delayMs = DEFAULT_OPTIONS.delayMs,
    shouldRetry,
  } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries && (!shouldRetry || shouldRetry(error))) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}
