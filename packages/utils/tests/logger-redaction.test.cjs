const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getReqMainInfo } = require('../dist/logger.util.js');
test('request logs remove query keys, values, fragments and credentials', () => {
  for (const url of ['/v1/models?secret-query-key=value', '/v1/models#secret-fragment']) {
    const result = getReqMainInfo({ url, headers: { authorization: 'secret-auth', cookie: 'secret-cookie' }, user: { email: 'secret-email' } }, { statusCode: 401 });
    assert.equal(result.url, '/v1/models');
    assert.equal(result.statusCode, 401);
    assert.ok(!JSON.stringify(result).includes('secret'));
  }
});
