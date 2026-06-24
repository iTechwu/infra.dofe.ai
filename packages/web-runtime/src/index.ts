/**
 * @dofe/infra-web-runtime
 *
 * Shared browser runtime utilities for dofe.ai frontend applications.
 *
 * Subpath exports:
 * - cn — Tailwind className merge utility
 * - fetch — ts-rest API client factory with auth/session/version handling
 * - version — API version & deprecation helpers
 * - errors — Browser error normalization
 * - reconnect — Backoff & network monitoring
 *
 * What does NOT belong here:
 * - Project-specific router contracts (stay in @repo/contracts)
 * - SSO token/session/OIDC logic (use @dofe/sso-browser)
 * - Models API endpoints (use @dofe/models-sdk)
 * - Toast/notification UI (project-specific)
 * - Login page paths (project-specific)
 */

export { cn } from './cn';
export {
  createDofeApiClient,
  type DofeTsRestFetcherOptions,
  VersionHeaders as DofeVersionHeaders,
  defaultIsSessionExpired,
  defaultIsVersionMismatch,
} from './fetch';
export {
  VERSION_HEADERS,
  isVersionMismatchStatus,
  parseDeprecationWarning,
  parseSunsetDate,
} from './version';
export {
  normalizeError,
  errorToastKey,
  type NormalizedError,
} from './errors';
export {
  backoffDelay,
  createNetworkMonitor,
  type ReconnectOptions,
} from './reconnect';
