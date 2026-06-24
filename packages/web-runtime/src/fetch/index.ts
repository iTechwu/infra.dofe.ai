import type { AppRouter, InitClientReturn } from '@ts-rest/core';
import { initClient } from '@ts-rest/core';

/**
 * Options for creating a dofe.ai ts-rest API fetcher.
 *
 * All hooks are optional. Projects customize by providing their specific
 * token management, session handling, and version strategies.
 */
export interface DofeTsRestFetcherOptions {
  /** Base URL for the API. Defaults to '/api'. */
  baseUrl?: string;

  /** Get the current auth token (e.g., from cookie, localStorage, or SSO). */
  getToken?: () => string | null | Promise<string | null>;

  /** Ensure we have a valid token (refresh if needed). Returns the token. */
  ensureValidToken?: () => Promise<string | null>;

  /** Clear the current token (e.g., on logout). */
  clearToken?: () => void | Promise<void>;

  /** Additional base headers to include with every request. */
  getBaseHeaders?: () => HeadersInit;

  /** Extra headers based on the request URL. */
  getExtraHeaders?: (input: RequestInfo | URL) => HeadersInit | Promise<HeadersInit>;

  /** Detect if a URL is the refresh/token endpoint (to avoid refresh loops). */
  isRefreshEndpoint?: (url: string) => boolean;

  /** Detect if a response indicates the session has expired. */
  isSessionExpiredResponse?: (response: Response, body: unknown) => boolean;

  /** Called when the session has expired. */
  onSessionExpired?: (context: { response: Response; body: unknown }) => void | Promise<void>;

  /** Detect if a response indicates a version mismatch (HTTP 426 or header). */
  isVersionMismatchResponse?: (response: Response, body: unknown) => boolean;

  /** Called when API version is incompatible. */
  onVersionMismatch?: (context: { response: Response; body: unknown }) => void | Promise<void>;

  /** Called when the API returns a deprecation warning header. */
  onDeprecationWarning?: (warning: string, response: Response) => void;

  /** Detect if a response indicates the client needs to refresh (e.g., page reload). */
  isClientRefreshNeeded?: (response: Response, body: unknown) => boolean;

  /** Called when the client needs to refresh. */
  onClientRefreshNeeded?: () => void | Promise<void>;
}

/**
 * Version-related HTTP headers used by dofe.ai APIs.
 */
export const VersionHeaders = {
  API_VERSION: 'x-api-version',
  APP_BUILD: 'x-app-build',
  SERVER_BUILD: 'x-server-build',
  MIN_APP_BUILD: 'x-min-app-build',
  DEPRECATION: 'x-deprecation',
  DEPRECATION_MESSAGE: 'x-deprecation-message',
  SUNSET: 'x-sunset',
  PLATFORM: 'x-platform',
  OS: 'x-os',
  DEVICE_ID: 'x-device-id',
} as const;

/**
 * Default session-expired response detector.
 * Override with isSessionExpiredResponse option for project-specific logic.
 */
export function defaultIsSessionExpired(response: Response): boolean {
  return response.status === 401;
}

/**
 * Default version-mismatch response detector.
 * Override with isVersionMismatchResponse option.
 */
export function defaultIsVersionMismatch(response: Response): boolean {
  return response.status === 426;
}

/**
 * Create a ts-rest client (raw fetch) with dofe.ai-standard behavior:
 * - Auth token injection
 * - Session expiry handling
 * - API version mismatch handling
 * - Deprecation warning handling
 * - Platform/device headers
 *
 * @example
 * ```ts
 * import { createDofeApiClient } from '@dofe/infra-web-runtime/fetch';
 * import { contract } from './my-contracts';
 *
 * export const apiClient = createDofeApiClient(contract, {
 *   baseUrl: '/api',
 *   getToken: () => getCookie('access_token'),
 *   onSessionExpired: () => redirectToLogin(),
 * });
 * ```
 */
export function createDofeApiClient<T extends AppRouter>(
  router: T,
  options: DofeTsRestFetcherOptions = {},
): InitClientReturn<T, any> {
  const {
    baseUrl = '/api',
    getToken,
    ensureValidToken,
    isRefreshEndpoint,
    isSessionExpiredResponse,
    onSessionExpired,
    isVersionMismatchResponse,
    onVersionMismatch,
    onDeprecationWarning,
    isClientRefreshNeeded,
    onClientRefreshNeeded,
    getBaseHeaders,
    getExtraHeaders,
  } = options;

  return initClient(router, {
    baseUrl,
    baseHeaders: {
      'Content-Type': 'application/json',
      ...(getBaseHeaders?.() as Record<string, string> | undefined ?? {}),
    },
    api: async (args) => {
      // Ensure fresh token before non-refresh requests
      if (
        ensureValidToken &&
        !(isRefreshEndpoint?.(args.path) ?? false)
      ) {
        const token = await ensureValidToken();
        if (token) {
          args.headers = {
            ...args.headers,
            Authorization: `Bearer ${token}`,
          };
        }
      } else if (getToken) {
        const token = await getToken();
        if (token) {
          args.headers = {
            ...args.headers,
            Authorization: `Bearer ${token}`,
          };
        }
      }

      // Add extra headers
      if (getExtraHeaders) {
        const extra = await getExtraHeaders(args.path);
        args.headers = { ...args.headers, ...(extra as Record<string, string>) };
      }

      // Perform the fetch
      const response = await fetch(args.path, {
        method: args.method,
        headers: args.headers as Record<string, string>,
        body: args.body,
        signal: args.signal,
      });

      let body: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        body = await response.json();
      } else {
        body = await response.text();
      }

      // Check deprecation warnings
      const deprecationHeader = response.headers.get(VersionHeaders.DEPRECATION);
      if (deprecationHeader === 'true' && onDeprecationWarning) {
        const message =
          response.headers.get(VersionHeaders.DEPRECATION_MESSAGE) ||
          'This API version is deprecated';
        onDeprecationWarning(message, response);
      }

      // Check session expiry
      if (
        isSessionExpiredResponse?.(response, body) ??
        defaultIsSessionExpired(response)
      ) {
        await onSessionExpired?.({ response, body });
      }

      // Check version mismatch
      if (
        isVersionMismatchResponse?.(response, body) ??
        defaultIsVersionMismatch(response)
      ) {
        await onVersionMismatch?.({ response, body });
      }

      // Check if client refresh is needed
      if (isClientRefreshNeeded?.(response, body)) {
        await onClientRefreshNeeded?.();
      }

      return {
        status: response.status,
        body,
        headers: response.headers,
      };
    },
  });
}
