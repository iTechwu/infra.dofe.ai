import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mock, test } from 'node:test';

const require = createRequire(import.meta.url);
const amqp = require('amqplib');

test('module startup and connection error logs never expose credentials', async () => {
  const previous = process.env.RABBITMQ_URL;
  const url = 'amqp://audit-user:audit-password@broker.invalid/test';
  process.env.RABBITMQ_URL = url;
  const logs = [];
  const utilsPath = require.resolve('@dofe/infra-utils');
  const previousUtils = require.cache[utilsPath];
  // Isolate the logger boundary from unrelated Prisma-backed utils exports.
  require.cache[utilsPath] = {
    exports: {
      createContextLogger: () => ({
        info: (...args) => logs.push(args),
        error: (...args) => logs.push(args),
      }),
    },
  };
  let failConnect = false;
  mock.method(amqp, 'connect', async () => {
    if (failConnect) throw new Error(`Cannot connect to ${url}`);
    return { close: async () => undefined };
  });
  // Stubbed connections settle immediately; do not retain real timeout handles.
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { RabbitmqModule } = require('../dist/rabbitmq.module.js');
    const provider = Reflect.getMetadata('providers', RabbitmqModule)
      .find((entry) => entry.useFactory);
    const client = await provider.useFactory();
    await client.connect();
    await client.close();
    failConnect = true;
    await assert.rejects(client.connect(), /Cannot connect/);
    assert.ok(logs.length >= 3, 'expected startup and connection diagnostics');
    const output = JSON.stringify(logs);
    assert.ok(!output.includes(url), 'connection URL appeared in logs');
    assert.ok(!output.includes('audit-password'), 'connection password appeared in logs');
  } finally {
    if (previousUtils) require.cache[utilsPath] = previousUtils;
    else delete require.cache[utilsPath];
    mock.restoreAll();
    mock.timers.reset();
    if (previous === undefined) delete process.env.RABBITMQ_URL;
    else process.env.RABBITMQ_URL = previous;
  }
});
