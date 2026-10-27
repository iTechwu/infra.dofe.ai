/** Browser transport for opaque, HttpOnly RP sessions. No AT or RT is returned or persisted. */
export class BrowserSessionV2Error extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); this.name = 'BrowserSessionV2Error'; }
}
export interface BrowserSessionV2Status {
  authenticated: boolean; suppressed?: boolean; csrf?: string; idle_expires_at?: number; user?: Record<string, unknown>;
}
export interface BrowserSessionV2Options {
  bffPath?: string;
  apiBaseUrl: string; ssoBaseUrl: string; fetch?: typeof fetch;
  /** Fixed resource prefix used by the RP contract when transport uses a mounted alias. */
  canonicalApiPath?: string;
  /** Maps existing SSO-upload proxy URLs onto explicitly supported uploader resource paths. */
  uploadProxyPath?: string;
  /** API-key data plane keeps its own credential; it still passes session coordination. */
  credentialPaths?: RegExp[];
  onSessionActivity?: (idleExpiresAt: number) => void;
}
interface RequestEnvelope { method: string; path: string; headers: Record<string, string>; body: string; }
// A page may create more than one client. Share admission order for the same RP,
// and use Web Locks when available to include other tabs of this origin.
const sessionTurns = new Map<string, Promise<void>>();
async function waitForSessionTurn(turn: Promise<void>, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason); };
    signal.addEventListener('abort', abort, { once: true });
    turn.then(() => { signal.removeEventListener('abort', abort); resolve(); });
  });
}
const ALLOWED_HEADERS = /^(content-type|accept|idempotency-key|anthropic-version|x-(api-version|app-build|platform|os|device-id|mptrail|current-tenant|knowledge-tenant|workspace-id|request-id|idempotency-key))$/i;
function base64(bytes: Uint8Array): string {
  let value = ''; const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) value += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(value);
}
async function json(response: Response): Promise<Record<string, unknown>> {
  let raw: unknown; try { raw = await response.json(); } catch { throw new BrowserSessionV2Error(response.status || 502, 'invalid_session_response'); }
  if (!raw || typeof raw !== 'object') throw new BrowserSessionV2Error(502, 'invalid_session_response');
  const record = raw as Record<string, unknown>;
  if (!response.ok) throw new BrowserSessionV2Error(response.status, typeof record.error === 'string' ? record.error : typeof record.msg === 'string' && record.msg && record.msg !== 'Http Exception' ? record.msg : 'session_request_failed');
  // Existing apps may wrap plain Nest controllers in the common success envelope.
  return record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : record;
}
export class BrowserSessionV2 {
  private csrf?: string;
  private restorePromise?: Promise<BrowserSessionV2Status>;
  private readonly transport: typeof fetch;
  private readonly api: string;
  private readonly sso: string;
  private loggedOut = false;
  constructor(readonly options: BrowserSessionV2Options) {
    this.transport = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.api = options.apiBaseUrl.replace(/\/+$/, '');
    this.sso = options.ssoBaseUrl.replace(/\/+$/, '');
    if (options.canonicalApiPath !== undefined && !/^\/(?:[A-Za-z0-9_-]+\/?)+$/.test(options.canonicalApiPath))
      throw new BrowserSessionV2Error(500, 'invalid_canonical_api_path');
  }
  async status(): Promise<BrowserSessionV2Status> {
    if (this.loggedOut) return { authenticated: false };
    if (this.restorePromise) return this.restorePromise;
    this.restorePromise = (async () => {
      const value = await json(await this.transport(`${this.api}${this.options.bffPath ?? '/auth/session/v2'}/status`, { credentials: 'include', cache: 'no-store' }));
      if (typeof value.authenticated !== 'boolean') throw new BrowserSessionV2Error(502, 'invalid_session_response');
      if (value.authenticated && (typeof value.csrf !== 'string' || typeof value.idle_expires_at !== 'number'))
        throw new BrowserSessionV2Error(502, 'invalid_session_response');
      this.csrf = value.authenticated || value.logout_pending === true ? value.csrf as string : undefined;
      if (value.logout_pending === true && typeof this.csrf === 'string') await this.logout();
      if (value.authenticated && typeof value.idle_expires_at === 'number') this.options.onSessionActivity?.(value.idle_expires_at);
      return value as unknown as BrowserSessionV2Status;
    })().finally(() => { this.restorePromise = undefined; });
    return this.restorePromise;
  }
  private async requireCsrf(): Promise<string> {
    if (!this.csrf) await this.status();
    if (!this.csrf || this.loggedOut) throw new BrowserSessionV2Error(401, 'session_required');
    return this.csrf;
  }
  private async post(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
    return this.transport(`${this.api}${this.options.bffPath ?? '/auth/session/v2'}/${path}`, {
      method: 'POST', credentials: 'include', cache: 'no-store', signal,
      headers: { 'content-type': 'application/json', 'x-dofe-csrf': await this.requireCsrf() }, body: JSON.stringify(body),
    });
  }
  private async prepare(body: { operation_id: string; request: RequestEnvelope }, signal?: AbortSignal): Promise<Record<string, unknown>> {
    for (let attempt = 0; ; attempt++) {
      try { return await json(await this.post('prepare', body, signal)); }
      catch (error) {
        // This response is emitted only before dispatch. Preserve business bytes
        // and their idempotency header while starting a fresh authority operation.
        if (error instanceof BrowserSessionV2Error && error.code === 'operation_expired_retry' && attempt < 3) {
          body.operation_id = crypto.randomUUID();
          continue;
        }
        if (!(error instanceof BrowserSessionV2Error) || error.code !== 'session_busy' || attempt >= 20) throw error;
        await new Promise<void>((resolve, reject) => {
          if (signal?.aborted) { reject(signal.reason); return; }
          const abort = () => { clearTimeout(timer); reject(signal?.reason); };
          const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, Math.min(100 * (attempt + 1), 1000));
          signal?.addEventListener('abort', abort, { once: true });
        });
      }
    }
  }
  private async sessionTurn<T>(signal: AbortSignal, run: () => Promise<T>): Promise<T> {
    const key = `${this.api}${this.options.bffPath ?? '/auth/session/v2'}`;
    const previous = sessionTurns.get(key) ?? Promise.resolve();
    let release!: () => void;
    const ready = new Promise<void>(resolve => { release = resolve; });
    const tail = previous.then(() => ready);
    sessionTurns.set(key, tail);
    try {
      await waitForSessionTurn(previous, signal);
      signal.throwIfAborted();
      if (globalThis.navigator?.locks)
        return await globalThis.navigator.locks.request(`dofe:session-v2:${key}`, { signal }, run);
      return await run();
    } finally {
      release();
      void tail.then(() => { if (sessionTurns.get(key) === tail) sessionTurns.delete(key); });
    }
  }
  private async envelope(input: RequestInfo | URL, init?: RequestInit): Promise<{ value: RequestEnvelope; signal: AbortSignal }> {
    const absolute = input instanceof Request ? input : new URL(String(input), globalThis.location?.origin ?? this.api);
    const request = new Request(absolute, init);
    const url = new URL(request.url); const apiUrl = new URL(this.api, globalThis.location?.origin);
    // Validate origin before the upload exception: matching a path never grants an external origin.
    if (url.origin !== apiUrl.origin) throw new BrowserSessionV2Error(403, 'request_origin_rejected');
    let path = url.pathname + url.search;
    if (this.options.uploadProxyPath && url.pathname.startsWith(this.options.uploadProxyPath + '/')) {
      path = url.pathname.slice(this.options.uploadProxyPath.length).replace(/^\/api\//, '/') + url.search;
    } else if (!(url.pathname === apiUrl.pathname || url.pathname.startsWith(apiUrl.pathname.replace(/\/$/, '') + '/'))) {
      throw new BrowserSessionV2Error(403, 'request_origin_rejected');
    } else if (this.options.canonicalApiPath) {
      path = this.options.canonicalApiPath.replace(/\/$/, '') + url.pathname.slice(apiUrl.pathname.replace(/\/$/, '').length) + url.search;
    }
    const credential = this.options.credentialPaths?.some(pattern => pattern.test(path)) === true;
    const headers: Record<string, string> = {};
    request.headers.forEach((value, name) => {
      if (ALLOWED_HEADERS.test(name) || (name === 'authorization' && credential)) headers[name] = value;
    });
    // Serialize FormData once: its generated boundary and exact bytes are preserved at dispatch.
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length > 50 * 1024 * 1024) throw new BrowserSessionV2Error(413, 'body_too_large');
    return { value: { method: request.method, path, headers, body: base64(bytes) }, signal: request.signal };
  }
  readonly fetch: typeof fetch = async (input, init) => {
    const { value, signal } = await this.envelope(input, init);
    return this.sessionTurn(signal, () => this.dispatch(value, signal));
  };
  private async dispatch(value: RequestEnvelope, signal: AbortSignal): Promise<Response> {
    const operation_id = crypto.randomUUID(); const body = { operation_id, request: value };
    const prepared = await this.prepare(body, signal);
    if (typeof prepared.idle_expires_at === 'number') this.options.onSessionActivity?.(prepared.idle_expires_at);
    if (prepared.session_context === 'native') return this.post('dispatch', body, signal);
    if (prepared.session_context !== 'browser') throw new BrowserSessionV2Error(502, 'invalid_session_context');
    if (typeof prepared.ticket !== 'string') throw new BrowserSessionV2Error(502, 'invalid_renew_ticket');
    const renewed = await json(await this.transport(`${this.sso}/auth/session/renew-cookie`, {
      method: 'POST', credentials: 'include', cache: 'no-store', signal,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket: prepared.ticket }),
    }));
    if (typeof renewed.challenge !== 'string') throw new BrowserSessionV2Error(502, 'invalid_cookie_challenge');
    const confirmation = await json(await this.transport(`${this.sso}/auth/session/v2/confirm-cookie`, {
      method: 'POST', credentials: 'include', cache: 'no-store', signal,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challenge: renewed.challenge }),
    }));
    if (confirmation.confirmed !== true || confirmation.operation_id !== body.operation_id)
      throw new BrowserSessionV2Error(409, 'cookie_confirmation_required');
    // Server rechecks the confirmation. Never trust this browser boolean as authorization.
    return this.post('dispatch', body, signal);
  }
  async bootstrap(ticket: string): Promise<BrowserSessionV2Status> {
    const response = await this.transport(`${this.api}${this.options.bffPath ?? '/auth/session/v2'}/bootstrap`, {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket }),
    });
    const value = await json(response); this.loggedOut = false;
    if (typeof value.csrf !== 'string') throw new BrowserSessionV2Error(502, 'invalid_session_response');
    this.csrf = value.csrf; return value as unknown as BrowserSessionV2Status;
  }
  async logout(): Promise<void> {
    const result = await json(await this.post('logout', {}));
    if (typeof result.logout_ticket !== 'string' || !['browser', 'native'].includes(String(result.session_context))) throw new BrowserSessionV2Error(502, 'invalid_logout_response');
    if (result.session_context === 'browser') {
      const completed = await json(await this.transport(`${this.sso}/auth/session/v2/logout-complete`, {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ logout_ticket: result.logout_ticket }),
      }));
      if (completed.logged_out !== true) throw new BrowserSessionV2Error(502, 'logout_completion_failed');
      const confirmed = await json(await this.transport(`${this.sso}/auth/session/v2/logout-cookie-confirm`, {
        method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ logout_ticket: result.logout_ticket }),
      }));
      if (confirmed.confirmed !== true) throw new BrowserSessionV2Error(409, 'logout_cookie_confirmation_required');
    }
    await json(await this.post('logout-confirm', {}));
    this.loggedOut = true; this.csrf = undefined;
  }
  /** Explicit login completion clears the local suppression latch; status probes do not. */
  loginCompleted() { this.loggedOut = false; this.csrf = undefined; }
}

/** Fetch-based SSE supports opaque BFF sessions without putting credentials in URLs. */
export function createSessionEventSource(url: string | URL, transport: typeof fetch, options?: EventSourceInit): EventSource {
  const controller = new AbortController();
  class Stream extends EventTarget {
    readonly CONNECTING = 0; readonly OPEN = 1; readonly CLOSED = 2;
    readyState = 0; readonly url = String(url); readonly withCredentials = options?.withCredentials ?? true;
    onopen: EventSource['onopen'] = null; onmessage: EventSource['onmessage'] = null; onerror: EventSource['onerror'] = null;
    close() { this.readyState = 2; controller.abort(); }
    async run() {
      try {
        const response = await transport(url, { headers: { accept: 'text/event-stream' }, credentials: 'include', signal: controller.signal });
        if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('SSE connection failed');
        this.readyState = 1; const opened = new Event('open'); this.onopen?.call(this as unknown as EventSource, opened); this.dispatchEvent(opened);
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = ''; let data: string[] = []; let type = 'message'; let lastId = '';
        const line = (value: string) => {
          if (!value) {
            if (data.length) { const event = new MessageEvent(type, { data: data.join('\n'), lastEventId: lastId });
              if (type === 'message') this.onmessage?.call(this as unknown as EventSource, event); this.dispatchEvent(event); }
            data = []; type = 'message'; return;
          }
          if (value.startsWith(':')) return;
          const split = value.indexOf(':'); const field = split < 0 ? value : value.slice(0, split); const text = split < 0 ? '' : value.slice(split + 1).replace(/^ /, '');
          if (field === 'data') data.push(text); if (field === 'event') type = text; if (field === 'id' && !text.includes('\0')) lastId = text;
        };
        while (!controller.signal.aborted) {
          const chunk = await reader.read(); if (chunk.done) break;
          pending += decoder.decode(chunk.value, { stream: true });
          let boundary: number;
          while ((boundary = pending.indexOf('\n')) >= 0) { line(pending.slice(0, boundary).replace(/\r$/, '')); pending = pending.slice(boundary + 1); }
        }
        if (!controller.signal.aborted) throw new Error('SSE connection ended');
      } catch {
        if (!controller.signal.aborted) { this.readyState = 2; const event = new Event('error'); this.onerror?.call(this as unknown as EventSource, event); this.dispatchEvent(event); }
      }
    }
  }
  const stream = new Stream(); queueMicrotask(() => { void stream.run(); }); return stream as unknown as EventSource;
}
