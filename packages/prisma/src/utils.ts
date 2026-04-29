/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * BigInt serialization utilities
 */
export const bigintUtil = {
  serialize<T>(data: T): T {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'bigint') {
      return data.toString() as T;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.serialize(item)) as T;
    }

    if (typeof data === 'object') {
      const serialized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        serialized[key] = this.serialize(value);
      }
      return serialized as T;
    }

    return data;
  },
};

/**
 * Logger interface compatible with Winston
 */
export interface LoggerLike {
  error(message: string | object, meta?: unknown): void;
  warn(message: string | object, meta?: unknown): void;
  info(message: string | object, meta?: unknown): void;
  debug(message: string | object, meta?: unknown): void;
}

/**
 * Simple console logger fallback when Winston is not available
 */
export const consoleLogger: LoggerLike = {
  error(message: string | object, meta?: unknown) {
    if (typeof message === 'string') {
      console.error(message, meta);
    } else {
      console.error(JSON.stringify(message), meta);
    }
  },
  warn(message: string | object, meta?: unknown) {
    if (typeof message === 'string') {
      console.warn(message, meta);
    } else {
      console.warn(JSON.stringify(message), meta);
    }
  },
  info(message: string | object, meta?: unknown) {
    if (typeof message === 'string') {
      console.info(message, meta);
    } else {
      console.info(JSON.stringify(message), meta);
    }
  },
  debug(message: string | object, meta?: unknown) {
    if (!isProduction()) {
      if (typeof message === 'string') {
        console.debug(message, meta);
      } else {
        console.debug(JSON.stringify(message), meta);
      }
    }
  },
};