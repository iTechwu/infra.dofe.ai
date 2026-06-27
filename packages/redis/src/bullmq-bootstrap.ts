export interface InfraBullMqLogger {
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
}

export interface RedisVersionCheckClient {
  connect(): Promise<void>;
  info(section: string): Promise<string>;
  quit(): Promise<unknown>;
}

export type RedisVersionCheckClientFactory = (
  url: string,
  options: {
    maxRetriesPerRequest: number;
    connectTimeout: number;
    lazyConnect: boolean;
  },
) => RedisVersionCheckClient;

export interface InfraBullMqBootstrapOptions {
  redisUrl?: string;
  logger: InfraBullMqLogger;
  isProduction: () => boolean;
  createRedisClient: RedisVersionCheckClientFactory;
  minimumMajorVersion?: number;
  warnWhenRedisUrlMissing?: string;
  warnWhenPreflightSkipped?: string;
  warnWhenPreflightFails?: (
    message: string,
    durationMs: number,
  ) => string | [string, Record<string, unknown>];
  errorWhenVersionTooOld?: (
    version: string,
    minimumMajorVersion: number,
  ) => string | { logMessage: string; throwMessage: string };
  infoWhenVersionOk?: (version: string) => string | undefined;
  nonProductionRetryLimit?: number;
}

export interface InfraBullMqRootOptions {
  connection: {
    url: string;
  };
}

export interface InfraBullMqNonProductionOptions {
  connection: {
    url: string;
    connectTimeout: number;
    maxRetriesPerRequest: number;
    enableReadyCheck: boolean;
    maxRetries: number;
    retryStrategy: (times: number) => number | null;
  };
}

export type InfraBullMqOptions =
  | InfraBullMqRootOptions
  | InfraBullMqNonProductionOptions;

export function parseRedisMajorVersion(info: string): {
  version: string | null;
  major: number | null;
} {
  const versionMatch = info.match(/redis_version:([\d.]+)/);
  const version = versionMatch?.[1] ?? null;
  if (!version) return { version: null, major: null };
  const major = Number(version.split('.')[0]);
  return { version, major: Number.isFinite(major) ? major : null };
}

export function createBullMqNonProductionOptions(
  redisUrl: string,
  logger: InfraBullMqLogger,
  retryLimit = 3,
): InfraBullMqNonProductionOptions {
  return {
    connection: {
      url: redisUrl,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      maxRetries: retryLimit,
      retryStrategy: (times: number) => {
        if (times > retryLimit) {
          logger.warn('BullMQ Redis connection retries exhausted');
          return null;
        }
        return Math.min(times * 1000, 3000);
      },
    },
  };
}

export async function createBullMqBootstrapOptions({
  redisUrl,
  logger,
  isProduction,
  createRedisClient,
  minimumMajorVersion = 5,
  warnWhenRedisUrlMissing = 'REDIS_URL is not set; BullMQ queues are unavailable',
  warnWhenPreflightSkipped = 'BullMQ Redis preflight skipped in non-production mode',
  warnWhenPreflightFails = (message) =>
    `Unable to preflight Redis version; BullMQ will attempt to connect: ${message}`,
  errorWhenVersionTooOld = (version, minimum) =>
    `Redis version ${version} is too old. BullMQ requires Redis >= ${minimum}.0.0.`,
  infoWhenVersionOk,
  nonProductionRetryLimit = 3,
}: InfraBullMqBootstrapOptions): Promise<InfraBullMqOptions> {
  if (!redisUrl) {
    logger.warn(warnWhenRedisUrlMissing);
    throw new Error('REDIS_URL environment variable is not set');
  }

  if (!isProduction()) {
    logger.warn(warnWhenPreflightSkipped);
    return createBullMqNonProductionOptions(
      redisUrl,
      logger,
      nonProductionRetryLimit,
    );
  }

  const preflightStartedAt = Date.now();
  try {
    const checkClient = createRedisClient(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true,
    });

    await checkClient.connect();
    const info = await checkClient.info('server');
    await checkClient.quit();

    const { version, major } = parseRedisMajorVersion(info);
    if (version && major !== null) {
      if (major < minimumMajorVersion) {
        const errorMessage = errorWhenVersionTooOld(version, minimumMajorVersion);
        if (typeof errorMessage === 'string') {
          logger.error(errorMessage);
          throw new Error(errorMessage);
        }
        logger.error(errorMessage.logMessage);
        throw new Error(errorMessage.throwMessage);
      }

      const infoMessage = infoWhenVersionOk?.(version);
      if (infoMessage) logger.info(infoMessage);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('version')) {
      throw error;
    }

    const warning = warnWhenPreflightFails(
      message,
      Date.now() - preflightStartedAt,
    );
    if (Array.isArray(warning)) {
      logger.warn(warning[0], warning[1]);
    } else {
      logger.warn(warning);
    }
  }

  return {
    connection: {
      url: redisUrl,
    },
  };
}
