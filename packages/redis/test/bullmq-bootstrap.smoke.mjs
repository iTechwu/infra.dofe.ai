import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBullMqBootstrapOptions,
  createBullMqNonProductionOptions,
  parseRedisMajorVersion,
} from '../dist/bullmq-bootstrap.js';

function logger() {
  return {
    warn: (...args) => logs.warn.push(args),
    error: (...args) => logs.error.push(args),
    info: (...args) => logs.info.push(args),
  };
}

const logs = {
  warn: [],
  error: [],
  info: [],
};

function resetLogs() {
  logs.warn.length = 0;
  logs.error.length = 0;
  logs.info.length = 0;
}

function clientFactory(infoOrError) {
  return () => ({
    connect: async () => {
      if (infoOrError instanceof Error) throw infoOrError;
    },
    info: async () => {
      if (infoOrError instanceof Error) throw infoOrError;
      return infoOrError;
    },
    quit: async () => undefined,
  });
}

test('parseRedisMajorVersion extracts server version', () => {
  assert.deepEqual(parseRedisMajorVersion('redis_version:7.2.4\r\n'), {
    version: '7.2.4',
    major: 7,
  });
  assert.deepEqual(parseRedisMajorVersion('no version'), {
    version: null,
    major: null,
  });
});

test('createBullMqBootstrapOptions rejects too old Redis versions', async () => {
  resetLogs();
  await assert.rejects(
    () =>
      createBullMqBootstrapOptions({
        redisUrl: 'redis://localhost:6379',
        logger: logger(),
        isProduction: () => true,
        createRedisClient: clientFactory('redis_version:4.0.14\r\n'),
      }),
    /Redis version 4\.0\.14 is too old/,
  );
  assert.equal(logs.error.length, 1);
});

test('createBullMqBootstrapOptions supports non-production tolerant config', async () => {
  resetLogs();
  const options = await createBullMqBootstrapOptions({
    redisUrl: 'redis://localhost:6379',
    logger: logger(),
    isProduction: () => false,
    createRedisClient: clientFactory('redis_version:4.0.14\r\n'),
  });
  assert.equal(options.connection.url, 'redis://localhost:6379');
  assert.equal(typeof options.connection.retryStrategy, 'function');
  assert.equal(options.connection.retryStrategy(4), null);
});

test('createBullMqNonProductionOptions retry strategy caps backoff', () => {
  resetLogs();
  const options = createBullMqNonProductionOptions(
    'redis://localhost:6379',
    logger(),
  );
  assert.equal(options.connection.retryStrategy(2), 2000);
  assert.equal(options.connection.retryStrategy(99), null);
});
