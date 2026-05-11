'use client';

import { useEffect, useCallback, useRef } from 'react';

const DEFAULT_CHANNEL_NAME = 'dofe-auth-sync';
const DEFAULT_DEBOUNCE_MS = 2000;

export interface SsoLogoutSyncOptions {
  /** Clear local auth tokens and storage. Called when logout is detected. */
  clearAuth: () => void;
  /** Get the login page path for redirect. Called after clearing auth. */
  getLoginPath: () => string;
  /** Check whether the SSO session is still valid. Should return false if not authenticated. */
  checkSession: () => Promise<boolean>;
  /** BroadcastChannel name (default: 'dofe-auth-sync') */
  channelName?: string;
  /** Session check debounce in ms (default: 2000) */
  debounceMs?: number;
}

/**
 * BroadcastChannel-based logout sync + cross-origin session monitoring.
 *
 * Within the same origin (e.g., multiple tabs of the same app):
 *   BroadcastChannel notifies sibling tabs when logout occurs.
 *
 * Cross-origin (e.g., logout from a different subdomain while this tab is open):
 *   On visibility change (user returns to tab), re-checks SSO session.
 *   If the session was cleared, clears local auth and redirects to login.
 *
 * @returns { broadcastLogout } — call BEFORE redirecting to SSO logout
 */
export function useSsoLogoutSync(options: SsoLogoutSyncOptions) {
  const {
    clearAuth,
    getLoginPath,
    checkSession,
    channelName = DEFAULT_CHANNEL_NAME,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options;

  const lastCheckRef = useRef<number>(0);
  const intentionalRef = useRef<boolean>(false);

  const handleDetectedLogout = useCallback(() => {
    clearAuth();
    window.location.replace(getLoginPath());
  }, [clearAuth, getLoginPath]);

  const broadcastLogout = useCallback(() => {
    intentionalRef.current = true;
    try {
      const channel = new BroadcastChannel(channelName);
      channel.postMessage({ type: 'LOGOUT', ts: Date.now() });
      channel.close();
    } catch {
      // BroadcastChannel not supported
    }
  }, [channelName]);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;

    try {
      channel = new BroadcastChannel(channelName);

      channel.onmessage = (event: MessageEvent) => {
        // Don't react to our own broadcast
        if (intentionalRef.current) return;
        if (event.data?.type === 'LOGOUT') {
          handleDetectedLogout();
        }
      };
    } catch {
      // BroadcastChannel not available
    }

    /**
     * On visibility change, verify SSO session is still valid.
     * Handles the case where user logged out from a DIFFERENT subdomain.
     */
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;

      const now = Date.now();
      if (now - lastCheckRef.current < debounceMs) return;
      lastCheckRef.current = now;

      const hasSession = await checkSession();
      if (!hasSession) {
        handleDetectedLogout();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (channel) {
        channel.close();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearAuth, getLoginPath, checkSession, channelName, debounceMs, handleDetectedLogout]);

  return { broadcastLogout };
}
