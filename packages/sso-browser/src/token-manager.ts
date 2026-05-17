/**
 * Unified Token Manager for SSO/OIDC authentication.
 *
 * [SSO-LOGIN-REDESIGN] Phase 4 - TokenManager unification
 * @see sso.dofe.ai/docs/0517/sso-login-redesign.md
 *
 * Provides a standardized interface for token operations across
 * models.dofe.ai, agents.dofe.ai, and other subdomains.
 *
 * Design:
 * - StorageAdapter: Abstracts localStorage/cookie operations (project-specific)
 * - RefreshClient: Abstracts API calls (project-specific ts-rest client)
 * - TokenManager: Core logic with deduplication queue and event system
 */

'use client';

import type { UserInfo } from '@repo/contracts';

// ============================================================================
// Types
// ============================================================================

/**
 * Token data structure stored in localStorage.
 */
export interface TokenData {
  access: string;
  accessExpire: number;
  expire?: number;
}

/**
 * Result from a successful token refresh.
 */
export interface TokenRefreshResult {
  access: string;
  accessExpire: number;
  expire: number;
  user: UserInfo;
}

/**
 * Response from the refresh API endpoint.
 */
export interface RefreshApiResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  user?: UserInfo;
}

/**
 * Callback for token update events.
 */
export type TokenUpdateCallback = (data: TokenRefreshResult) => void;

// ============================================================================
// StorageAdapter Interface
// ============================================================================

/**
 * Abstract interface for token storage operations.
 * Each project implements its own adapter based on its storage strategy.
 *
 * models.dofe.ai: Stores access token in cookie for middleware + localStorage
 * agents.dofe.ai: Stores token presence indicator in cookie + localStorage
 */
export interface StorageAdapter {
  /** Get the current access token */
  getAccessToken(): string | null;

  /** Get full token data including expiry */
  getTokens(): TokenData | null;

  /** Store token data */
  setTokens(tokens: TokenData): void;

  /** Store user info */
  setUser(user: UserInfo): void;

  /** Get stored user info */
  getUser(): UserInfo | null;

  /** Clear all auth data */
  clearAll(): void;

  /** Check if access token is expired */
  isTokenExpired(): boolean;
}

// ============================================================================
// RefreshClient Interface
// ============================================================================

/**
 * Abstract interface for token refresh API calls.
 * Each project implements using its ts-rest client or direct fetch.
 */
export interface RefreshClient {
  /** Call the OIDC refresh endpoint */
  refreshToken(): Promise<RefreshApiResponse>;

  /** Fetch current user info (optional, called after refresh) */
  fetchUser?(): Promise<UserInfo | null>;
}

// ============================================================================
// TokenManager (Core Implementation)
// ============================================================================

/**
 * Unified Token Manager.
 *
 * Features:
 * - Deduplication queue: Prevents concurrent refresh requests
 * - Event system: Notify listeners when tokens are updated
 * - Storage abstraction: Works with any project's storage implementation
 * - API abstraction: Works with any project's API client
 */
export class TokenManager {
  private refreshPromise: Promise<TokenRefreshResult> | null = null;
  private listeners: Set<TokenUpdateCallback> = new Set();
  private storage: StorageAdapter;
  private apiClient: RefreshClient;

  constructor(storage: StorageAdapter, apiClient: RefreshClient) {
    this.storage = storage;
    this.apiClient = apiClient;
  }

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /** Get current access token */
  getToken(): string | null {
    return this.storage.getAccessToken();
  }

  /** Check if token is expired */
  isTokenExpired(): boolean {
    return this.storage.isTokenExpired();
  }

  /** Get stored user info */
  getUser(): UserInfo | null {
    return this.storage.getUser();
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /** Store login data */
  setLoginData(access: string, accessExpire: number, expire: number, user: UserInfo): void {
    if (typeof window === 'undefined') return;

    this.storage.setTokens({ access, accessExpire, expire });
    this.storage.setUser(user);

    this.notify({
      access,
      accessExpire,
      expire,
      user,
    });
  }

  /** Clear all auth data */
  clearToken(): void {
    this.storage.clearAll();
  }

  // ---------------------------------------------------------------------------
  // Token refresh (with deduplication queue)
  // ---------------------------------------------------------------------------

  /**
   * Refresh the access token.
   * Uses a promise queue to prevent concurrent refresh requests.
   */
  async refreshToken(): Promise<TokenRefreshResult> {
    // Deduplication: Return existing promise if refresh is in progress
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefreshToken().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  /**
   * Ensure a valid token is available.
   * Automatically refreshes if expired.
   */
  async ensureValidToken(): Promise<string> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    if (this.isTokenExpired()) {
      try {
        await this.refreshToken();
        const newToken = this.getToken();
        if (!newToken) {
          throw new Error('Token refresh produced no token');
        }
        return newToken;
      } catch {
        throw new Error('Token expired, please re-login');
      }
    }

    return token;
  }

  // ---------------------------------------------------------------------------
  // Event subscription
  // ---------------------------------------------------------------------------

  /** Subscribe to token update events */
  onTokenUpdate(callback: TokenUpdateCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private notify(data: TokenRefreshResult): void {
    for (const cb of this.listeners) {
      try {
        cb(data);
      } catch {
        // Listener errors should not break others
      }
    }
  }

  private async doRefreshToken(): Promise<TokenRefreshResult> {
    // Call the refresh API (refresh_token is sent via HttpOnly cookie)
    const response = await this.apiClient.refreshToken();

    if (!response.access_token) {
      throw new Error('No access token in refresh response');
    }

    const now = Date.now();
    const expiresInMs = (response.expires_in || 3600) * 1000;
    const expire = now + 30 * 24 * 60 * 60 * 1000; // 30 days

    // Store tokens
    this.storage.setTokens({
      access: response.access_token,
      accessExpire: now + expiresInMs,
      expire,
    });

    // Fetch user info if available
    let user = this.storage.getUser();
    if (this.apiClient.fetchUser) {
      try {
        const fetchedUser = await this.apiClient.fetchUser();
        if (fetchedUser) {
          user = fetchedUser;
          this.storage.setUser(user);
        }
      } catch {
        // Keep existing user if fetch fails
      }
    } else if (response.user) {
      user = response.user;
      this.storage.setUser(user);
    }

    const result: TokenRefreshResult = {
      access: response.access_token,
      accessExpire: now + expiresInMs,
      expire,
      user: user ?? {
        id: '',
        nickname: null,
        code: null,
        headerImg: null,
        sex: null,
        isAnonymity: false,
        isAdmin: false,
      },
    };

    this.notify(result);
    return result;
  }
}

// ============================================================================
// Factory function for creating project-specific instances
// ============================================================================

/**
 * Create a TokenManager instance with project-specific adapters.
 */
export function createTokenManager(
  storage: StorageAdapter,
  apiClient: RefreshClient,
): TokenManager {
  return new TokenManager(storage, apiClient);
}