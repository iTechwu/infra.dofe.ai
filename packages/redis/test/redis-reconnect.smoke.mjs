import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { RedisModule } from '../dist/redis.module.js';

test('shared Redis recovers after more than ten retries and fails disconnected commands promptly', { timeout: 35_000 }, async () => {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const previous = process.env.REDIS_URL;
  process.env.REDIS_URL = `redis://127.0.0.1:${port}`;
  let server;
  let client;
  const waitFor = async (condition, timeout = 8000) => {
    const deadline = Date.now() + timeout;
    while (!condition()) {
      assert.ok(Date.now() < deadline, 'Redis condition did not become true');
      await delay(20);
    }
  };
  const start = async () => {
    server = spawn('redis-server', ['--bind', '127.0.0.1', '--port', String(port), '--save', '', '--appendonly', 'no'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let ready = false;
    server.stdout.on('data', (chunk) => { if (chunk.toString().includes('Ready to accept connections')) ready = true; });
    await waitFor(() => ready);
  };
  try {
    const provider = Reflect.getMetadata('providers', RedisModule).find((entry) => entry.useFactory);
    client = await provider.useFactory();
    client.on('error', () => undefined);
    await assert.rejects(client.get('nonexistent'), /writeable|closed|retry|timeout/i);
    await start();
    await waitFor(() => client.status === 'ready');
    assert.equal(client.options.enableOfflineQueue, false);
    assert.equal(client.options.maxRetriesPerRequest, 1);
    assert.equal(client.options.commandTimeout, 5000);
    assert.equal(client.options.retryStrategy(100), 3000);
    let retries = 0;
    client.on('reconnecting', () => { retries++; });
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await exited;
    await waitFor(() => retries > 10, 15_000);
    const before = Date.now();
    await assert.rejects(client.get('nonexistent'), /writeable|closed|retry|timeout/i);
    assert.ok(Date.now() - before < 1000, 'disconnected command was queued');
    await start();
    await waitFor(() => client.status === 'ready');
    assert.equal(await client.ping(), 'PONG');
    assert.equal(await client.get('nonexistent'), null);
  } finally {
    client?.disconnect();
    if (server && server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill('SIGTERM');
      await exited;
    }
    if (previous === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previous;
  }
});
