import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendRuntimeCredentialEnv,
} from '../dist/runtime-credentials.js';

test('injects a complete dynamic AK/SK pair without changing existing environment values', () => {
  const environment = ['OPENCLAW_GATEWAY_TOKEN=managed-token'];

  appendRuntimeCredentialEnv(environment, {
    SEEDANCE_ASSET_ACCESS_KEY_ID: 'asset-ak',
    SEEDANCE_ASSET_SECRET_ACCESS_KEY: 'asset-sk',
    SEEDANCE_ASSET_API_BASE_URL: 'https://ixicai.cn/api',
  });

  assert.deepEqual(environment, [
    'OPENCLAW_GATEWAY_TOKEN=managed-token',
    'SEEDANCE_ASSET_ACCESS_KEY_ID=asset-ak',
    'SEEDANCE_ASSET_SECRET_ACCESS_KEY=asset-sk',
    'SEEDANCE_ASSET_API_BASE_URL=https://ixicai.cn/api',
  ]);
});

test('rejects a partial dynamic AK/SK pair', () => {
  assert.throws(
    () =>
      appendRuntimeCredentialEnv([], {
        SEEDANCE_ASSET_ACCESS_KEY_ID: 'asset-ak',
      }),
    /must include both ACCESS_KEY_ID and SECRET_ACCESS_KEY/,
  );
});

test('rejects attempts to override a managed runtime variable', () => {
  assert.throws(
    () =>
      appendRuntimeCredentialEnv([], {
        OPENCLAW_GATEWAY_TOKEN: 'replacement',
      }),
    /not allowed/,
  );
});
