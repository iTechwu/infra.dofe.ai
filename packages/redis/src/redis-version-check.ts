import Redis from 'ioredis';

const MIN_REDIS_VERSION = 5;

/**
 * Validate Redis version meets BullMQ minimum requirement (>= 5.0.0).
 * Called during bootstrap before NestJS DI is available, so uses console for logging.
 */
export async function validateRedisVersion(redisUrl: string): Promise<void> {
  const checkClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    lazyConnect: true,
  });

  try {
    await checkClient.connect();
    const info = await checkClient.info('server');

    const versionMatch = info.match(/redis_version:([\d.]+)/);
    if (versionMatch) {
      const version = versionMatch[1];
      const [major] = version.split('.').map(Number);
      if (major < MIN_REDIS_VERSION) {
        const errorMsg =
          `❌ Redis 版本错误: 当前版本 ${version}，BullMQ 需要 >= ${MIN_REDIS_VERSION}.0.0\n` +
          `请升级 Redis 服务器。参考文档: docs/redis-version-error.md\n` +
          `升级命令 (macOS): brew upgrade redis\n` +
          `升级命令 (Linux): sudo apt update && sudo apt install redis-server`;
        console.error(errorMsg);
        throw new Error(
          `Redis version ${version} is too old. BullMQ requires Redis >= ${MIN_REDIS_VERSION}.0.0. Please upgrade Redis server.`,
        );
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log(`✓ Redis 版本检查通过: ${version}`);
      }
    }
  } finally {
    await checkClient.quit();
  }
}
