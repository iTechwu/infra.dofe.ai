/**
 * Reconnect / backoff utilities for browser runtime.
 *
 * Used for WebSocket reconnection, polling retry, and network recovery.
 */

export interface ReconnectOptions {
  /** Maximum number of retry attempts. Default: Infinity */
  maxAttempts?: number;
  /** Initial delay in ms. Default: 1000 */
  initialDelay?: number;
  /** Maximum delay in ms. Default: 30000 */
  maxDelay?: number;
  /** Backoff multiplier. Default: 2 */
  factor?: number;
  /** Whether to add jitter to the delay. Default: true */
  jitter?: boolean;
}

/**
 * Calculate the delay for a given retry attempt using exponential backoff.
 */
export function backoffDelay(attempt: number, options: ReconnectOptions = {}): number {
  const {
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    jitter = true,
  } = options;

  const delay = Math.min(initialDelay * Math.pow(factor, attempt), maxDelay);

  if (jitter) {
    // Add ±25% jitter
    const jitterAmount = delay * 0.25;
    return delay + (Math.random() - 0.5) * 2 * jitterAmount;
  }

  return delay;
}

/**
 * Simple network online/offline detector hook-compatible state machine.
 *
 * Usage:
 * ```ts
 * const network = createNetworkMonitor({
 *   onOnline: () => reconnect(),
 *   onOffline: () => pause(),
 * });
 * // Call network.destroy() on cleanup
 * ```
 */
export function createNetworkMonitor(callbacks: {
  onOnline?: () => void;
  onOffline?: () => void;
}): { destroy: () => void; isOnline: () => boolean } {
  const handleOnline = () => callbacks.onOnline?.();
  const handleOffline = () => callbacks.onOffline?.();

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  return {
    destroy() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    },
    isOnline() {
      return typeof navigator !== 'undefined' ? navigator.onLine : true;
    },
  };
}
