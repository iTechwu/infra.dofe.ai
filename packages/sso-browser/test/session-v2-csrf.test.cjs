const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BrowserSessionV2 } = require('../dist/session-v2');

function fixture(options = {}) {
  const state = { csrf: 'initial-csrf', userId: 'member-1', authenticated: true, statuses: 0, prepares: [], dispatches: [] };
  const api = `https://${crypto.randomUUID()}.example/api`;
  const client = new BrowserSessionV2({
    apiBaseUrl: api,
    ssoBaseUrl: 'https://sso.example/api',
    fetch: async (url, init = {}) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/status')) {
        state.statuses++;
        if (state.statuses > 1) options.onRestore?.(state);
        return Response.json({ authenticated: state.authenticated, csrf: state.csrf, idle_expires_at: Date.now() + 60_000, user: state.userId === undefined ? undefined : { id: state.userId } });
      }
      const body = JSON.parse(init.body);
      if (path.endsWith('/bootstrap')) return Response.json({ authenticated: true, csrf: state.csrf, user: { id: state.userId } });
      if (path.endsWith('/prepare')) {
        state.prepares.push({ body, csrf: init.headers['x-dofe-csrf'] });
        const code = options.prepareError ?? (init.headers['x-dofe-csrf'] !== state.csrf ? 'csrf_rejected' : undefined);
        if (code) return Response.json(options.rawError ? { error: code } : { code: 403, msg: code }, { status: 403 });
        return Response.json({ session_context: 'native' });
      }
      if (path.endsWith('/dispatch')) {
        state.dispatches.push(body);
        return options.dispatchError
          ? Response.json({ msg: options.dispatchError }, { status: 403 })
          : Response.json({ ok: true });
      }
      throw new Error(`Unexpected route: ${path}`);
    },
  });
  return { state, client, url: `${api}/tenant/tenants` };
}

for (const rawError of [false, true]) {
  test(`refreshes stale CSRF before dispatch (${rawError ? 'raw' : 'wrapped'} error)`, async () => {
    const { client, state, url } = fixture({ rawError });
    await client.status();
    // A different tab re-establishes the opaque Cookie session after this tab restored it.
    state.csrf = 'replacement-session-csrf';
    const response = await client.fetch(url, { method: 'POST', headers: { 'idempotency-key': 'business-key' }, body: 'exact bytes' });
    assert.equal(response.status, 200);
    assert.equal(state.statuses, 2);
    assert.equal(state.prepares.length, 2);
    assert.equal(state.prepares[0].csrf, 'initial-csrf');
    assert.equal(state.prepares[1].csrf, state.csrf);
    assert.deepEqual(state.prepares[0].body, state.prepares[1].body);
    assert.equal(state.dispatches.length, 1);
    assert.equal(state.dispatches[0].operation_id, state.prepares[0].body.operation_id);
    assert.equal(atob(state.dispatches[0].request.body), 'exact bytes');
    assert.equal(state.dispatches[0].request.headers['idempotency-key'], 'business-key');
  });
}

test('an unchanged authoritative CSRF is rejected without retrying preparation', async () => {
  const { client, state, url } = fixture({ prepareError: 'csrf_rejected' });
  await assert.rejects(client.fetch(url), error => error.status === 403 && error.code === 'csrf_rejected');
  assert.equal(state.statuses, 2);
  assert.equal(state.prepares.length, 1);
  assert.equal(state.dispatches.length, 0);
});

test('CSRF recovery is bounded to one status refresh and one preparation retry', async () => {
  const { client, state, url } = fixture({ prepareError: 'csrf_rejected' });
  await client.status();
  state.csrf = 'changed-but-still-rejected';
  await assert.rejects(client.fetch(url), error => error.code === 'csrf_rejected');
  assert.equal(state.statuses, 2);
  assert.equal(state.prepares.length, 2);
  assert.equal(state.dispatches.length, 0);
});

test('a session lost during CSRF recovery never dispatches business', async () => {
  const { client, state, url } = fixture();
  await client.status();
  state.csrf = 'replacement-csrf';
  state.authenticated = false;
  await assert.rejects(client.fetch(url), error => error.status === 401 && error.code === 'session_required');
  assert.equal(state.statuses, 2);
  assert.equal(state.prepares.length, 1);
  assert.equal(state.dispatches.length, 0);
});

test('origin and ordinary permission denials do not trigger CSRF recovery', async () => {
  for (const prepareError of ['origin_rejected', 'cross_site_rejected', 'forbidden']) {
    const { client, state, url } = fixture({ prepareError });
    await assert.rejects(client.fetch(url), error => error.code === prepareError);
    assert.equal(state.statuses, 1);
    assert.equal(state.prepares.length, 1);
    assert.equal(state.dispatches.length, 0);
  }
});

test('a dispatch rejection never refreshes or replays a business write', async () => {
  const { client, state, url } = fixture({ dispatchError: 'csrf_rejected' });
  const response = await client.fetch(url, { method: 'POST', body: 'write' });
  assert.equal(response.status, 403);
  assert.equal(state.statuses, 1);
  assert.equal(state.prepares.length, 1);
  assert.equal(state.dispatches.length, 1);
});

test('cancellation during status recovery prevents preparation retry', async () => {
  const controller = new AbortController();
  const { client, state, url } = fixture({ onRestore: () => controller.abort() });
  await client.status();
  state.csrf = 'replacement-csrf';
  await assert.rejects(client.fetch(url, { signal: controller.signal }), error => error.name === 'AbortError');
  assert.equal(state.prepares.length, 1);
  assert.equal(state.dispatches.length, 0);
});

test('a different account blocks the old page and its queued requests until explicit login', async () => {
  const { client, state, url } = fixture();
  await client.status();
  state.csrf = 'another-account-csrf';
  state.userId = 'another-account';
  const results = await Promise.allSettled(Array.from({ length: 4 }, () => client.fetch(url, { method: 'POST', body: 'old-page-write' })));
  assert(results.every(result => result.status === 'rejected' && result.reason.status === 401 && result.reason.code === 'session_changed'));
  await assert.rejects(client.status(), error => error.code === 'session_changed');
  assert.equal(state.statuses, 2);
  assert.equal(state.prepares.length, 1);
  assert.equal(state.dispatches.length, 0);
  client.loginCompleted();
  assert.equal((await client.fetch(url)).status, 200);
  assert.equal(state.dispatches.length, 1);
});

test('missing or empty identity cannot prove continuity for automatic recovery', async () => {
  for (const initial of [undefined, '', 'member-1']) {
    const { client, state, url } = fixture();
    state.userId = initial;
    await client.status();
    state.csrf = 'replacement-csrf';
    state.userId = initial === 'member-1' ? undefined : 'member-1';
    await assert.rejects(client.fetch(url), error => error.status === 401 && error.code === 'session_changed');
    assert.equal(state.prepares.length, 1);
    assert.equal(state.dispatches.length, 0);
  }
});

test('bootstrap records the identity used to verify a later CSRF recovery', async () => {
  const { client, state, url } = fixture();
  await client.bootstrap('opaque-ticket');
  state.csrf = 'replacement-csrf';
  assert.equal((await client.fetch(url)).status, 200);
  assert.equal(state.statuses, 1);
  assert.equal(state.prepares.length, 2);
  assert.equal(state.dispatches.length, 1);
});

test('cancelling recovery cannot let queued writes adopt a changed account', async () => {
  const controller = new AbortController();
  const { client, state, url } = fixture({ onRestore: () => controller.abort() });
  await client.status();
  state.csrf = 'another-account-csrf';
  state.userId = 'another-account';
  await assert.rejects(client.fetch(url, { signal: controller.signal }));
  await assert.rejects(client.fetch(url, { method: 'POST', body: 'old-page-write' }), error => error.status === 401 && error.code === 'session_changed');
  assert.equal(state.prepares.length, 1);
  assert.equal(state.dispatches.length, 0);
});
