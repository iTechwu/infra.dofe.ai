/**
 * SSO cross-subdomain session detection utilities.
 *
 * On page load, subdomain apps can check if the user
 * already has a session at the central SSO via:
 *   Layer 1: fetch API to /auth/session (same-site, cookie sent automatically)
 *   Layer 2: hidden iframe + postMessage (fallback for strict browser policies)
 *   Layer 3: full OIDC redirect (existing flow, always works)
 */

/**
 * User information from SSO session.
 * Projects should extend this interface or provide their own.
 */
export interface SsoUserInfo {
  id: string;
  email?: string;
  nickname?: string;
  avatar?: string;
  tenantId?: string;
}

/**
 * Session data returned from SSO.
 */
export interface SsoSessionData {
  user: SsoUserInfo;
  access: string;
  refresh: string;
  accessExpire: number;
  expire: number;
}

/**
 * Configuration for SSO session detection.
 */
export interface SsoSessionConfig {
  /** SSO base URL */
  ssoBaseUrl: string;
  /** Timeout in milliseconds for silent check (default: 5000) */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Layer 1: Check SSO session via direct fetch API call.
 * Since all subdomains share the same domain, the access_token cookie
 * is sent automatically with SameSite=Lax + credentials:'include'.
 *
 * @param config - SSO configuration with base URL
 * @returns Session data if authenticated, null otherwise
 */
export async function checkSsoSession(
  config: SsoSessionConfig,
): Promise<SsoSessionData | null> {
  const { ssoBaseUrl, timeoutMs = DEFAULT_TIMEOUT_MS } = config;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${ssoBaseUrl}/auth/session`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      mode: 'cors',
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const body = await res.json();
    if (body.code !== 0 || !body.data?.access) return null;

    return body.data as SsoSessionData;
  } catch {
    // Network error, timeout, or CORS blocked — fall through to next layer
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Layer 2: Check SSO session via hidden iframe + postMessage.
 * Fallback for browsers that block third-party cookies or CORS requests.
 *
 * @param config - SSO configuration with base URL
 * @returns Session data if authenticated, null otherwise
 */
export function checkSsoSessionViaIframe(
  config: SsoSessionConfig,
): Promise<SsoSessionData | null> {
  const { ssoBaseUrl, timeoutMs = DEFAULT_TIMEOUT_MS } = config;

  return new Promise((resolve) => {
    let settled = false;
    let iframe: HTMLIFrameElement | null = null;

    const finish = (result: SsoSessionData | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      window.removeEventListener('message', handler);
      if (iframe) {
        iframe.onerror = null;
        iframe.onload = null;
      }
      try {
        if (iframe) {
          document.body.removeChild(iframe);
        }
      } catch {
        /* already removed */
      }
      resolve(result);
    };

    const timeout = setTimeout(() => finish(null), timeoutMs);

    const handler = (event: MessageEvent) => {
      // Exact origin match to prevent spoofing via sibling subdomains
      if (event.origin !== ssoBaseUrl) return;

      if (event.data?.type === 'SSO_SILENT_CHECK_RESULT') {
        if (event.data.authenticated && event.data.data) {
          finish(event.data.data as SsoSessionData);
        } else {
          finish(null);
        }
      }
    };

    window.addEventListener('message', handler);

    iframe = document.createElement('iframe');
    iframe.src = `${ssoBaseUrl}/auth/silent-check?parent=${encodeURIComponent(window.location.origin)}`;
    iframe.style.display = 'none';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.onerror = () => finish(null);
    document.body.appendChild(iframe);
  });
}

/**
 * Combined session check - tries Layer 1 first, then Layer 2 if needed.
 *
 * @param config - SSO configuration with base URL
 * @returns Session data if authenticated, null otherwise
 */
export async function checkSsoSessionCombined(
  config: SsoSessionConfig,
): Promise<SsoSessionData | null> {
  // Try Layer 1 first (direct fetch)
  const sessionData = await checkSsoSession(config);
  if (sessionData) {
    return sessionData;
  }

  // Fall back to Layer 2 (iframe + postMessage)
  return checkSsoSessionViaIframe(config);
}