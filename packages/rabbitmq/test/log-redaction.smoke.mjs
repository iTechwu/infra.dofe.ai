import assert from 'node:assert/strict';
import test from 'node:test';
import {
  connectionClosedSeverity,
  redactErrorMessage,
  redactUrlCredentials,
} from '../dist/log-redaction.util.js';

test('redactUrlCredentials masks amqp/amqps user:password authorities', () => {
  assert.equal(
    redactUrlCredentials('amqp://dofe:password@127.0.0.1:5672/vhost'),
    'amqp://***@127.0.0.1:5672/vhost',
  );
  assert.equal(
    redactUrlCredentials('amqps://u:p@broker.example:5671'),
    'amqps://***@broker.example:5671',
  );
});

test('redactUrlCredentials leaves credential-free URLs untouched', () => {
  assert.equal(
    redactUrlCredentials('http://127.0.0.1:13100/auth/oidc/callback'),
    'http://127.0.0.1:13100/auth/oidc/callback',
  );
});

test('redactErrorMessage redacts credentials inside amqplib-style errors', () => {
  const error = new Error('connect ECONNREFUSED amqp://dofe:password@127.0.0.1:5672');
  assert.equal(
    redactErrorMessage(error),
    'connect ECONNREFUSED amqp://***@127.0.0.1:5672',
  );
});

test('connectionClosedSeverity downgrades an expected close during shutdown to debug', () => {
  assert.equal(connectionClosedSeverity(true), 'debug');
  assert.equal(connectionClosedSeverity(false), 'warn');
});
