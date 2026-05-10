import { Injectable, OnModuleInit } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";

/**
 * Internal API response wrapper type
 */
interface ApiResponse<T> {
  code: number;
  msg?: string;
  data: T;
}

/**
 * User information from SSO internal API
 */
export interface SsoInternalUser {
  id: string;
  nickname: string | null;
  code: string | null;
  email: string | null;
  mobile: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  isActive: boolean;
}

/**
 * Tenant information from SSO internal API
 */
export interface SsoInternalTenant {
  id: string;
  name: string;
  slug: string;
  type: string;
  plan: string;
  status: string;
}

/**
 * OIDC session information
 */
export interface SsoOidcSessionInfo {
  clientId: string;
  scope?: string;
  accessExpire: number;
  authTime: number;
}

/**
 * Main session information
 */
export interface SsoMainSessionInfo {
  accessExpire: number;
  expire: number;
  isAnonymity: boolean;
}

/**
 * User sessions response
 */
export interface SsoUserSessionsResponse {
  mainSession?: SsoMainSessionInfo;
  oidcSessions: SsoOidcSessionInfo[];
}

/**
 * Key status information
 */
export interface SsoKeyInfo {
  kid: string;
  status: "active" | "rotating" | "retired";
  createdAt: string;
  retiredAt?: string;
}

/**
 * Key status response
 */
export interface SsoKeyStatusResponse {
  keys: SsoKeyInfo[];
  activeKid?: string;
  totalKeys: number;
}

/**
 * Key rotate response
 */
export interface SsoKeyRotateResponse {
  newKid: string;
  oldKid: string;
}

/**
 * Key purge response
 */
export interface SsoKeyPurgeResponse {
  purgedCount: number;
}

@Injectable()
export class SsoAuthClient implements OnModuleInit {
  private ssoInternalUrl!: string;
  private ssoBaseUrl!: string;
  private serviceToken!: string;
  private serviceName!: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    // 强制要求配置环境变量，不使用默认值
    this.ssoInternalUrl =
      this.configService.get<string>("SSO_INTERNAL_API_URL") ?? "";
    this.ssoBaseUrl = this.configService.get<string>("SSO_API_URL") ?? "";
    this.serviceToken =
      this.configService.get<string>("INTERNAL_API_SECRET") ?? "";
    this.serviceName = this.configService.get<string>("SSO_SERVICE_NAME") ?? "";

    if (!this.ssoInternalUrl) {
      throw new Error(
        "SSO_INTERNAL_API_URL is required but not configured. Please set it in environment variables.",
      );
    }

    if (!this.ssoBaseUrl) {
      throw new Error(
        "SSO_API_URL is required but not configured. Please set it in environment variables.",
      );
    }

    if (!this.serviceToken) {
      throw new Error(
        "INTERNAL_API_SECRET is required but not configured. Please set it in environment variables.",
      );
    }

    if (!this.serviceName) {
      throw new Error(
        'SSO_SERVICE_NAME is required but not configured. Please set it in environment variables (e.g., "models.dofe.ai" or "agents.dofe.ai").',
      );
    }
  }

  private getInternalHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.serviceToken}`,
      "X-Service-Name": this.serviceName,
      "Content-Type": "application/json",
    };
  }

  // ============================================================================
  // Token Verification
  // ============================================================================

  /**
   * 验证 access token 有效性
   */
  async verifyToken(accessToken: string): Promise<{
    valid: boolean;
    userId?: string;
    expiresAt?: number;
  }> {
    const response = await firstValueFrom(
      this.httpService.post<
        ApiResponse<{ valid: boolean; userId?: string; expiresAt?: number }>
      >(
        `${this.ssoInternalUrl}/internal/verify-token`,
        { token: accessToken },
        {
          headers: this.getInternalHeaders(),
          timeout: 5000,
        },
      ),
    );
    return response.data.data;
  }

  // ============================================================================
  // User Management
  // ============================================================================

  /**
   * 按 ID 获取用户信息
   */
  async getUser(userId: string): Promise<SsoInternalUser> {
    const response = await firstValueFrom(
      this.httpService.get<ApiResponse<SsoInternalUser>>(
        `${this.ssoInternalUrl}/internal/users/${userId}`,
        {
          headers: this.getInternalHeaders(),
          timeout: 5000,
        },
      ),
    );
    return response.data.data;
  }

  /**
   * 批量获取用户信息
   * @param userIds - 用户 ID 数组（最多 100 个）
   */
  async batchGetUsers(
    userIds: string[],
  ): Promise<Record<string, SsoInternalUser>> {
    const response = await firstValueFrom(
      this.httpService.post<ApiResponse<Record<string, SsoInternalUser>>>(
        `${this.ssoInternalUrl}/internal/users/batch`,
        { userIds },
        {
          headers: this.getInternalHeaders(),
          timeout: 10000, // 批量请求可能需要更长超时
        },
      ),
    );
    return response.data.data;
  }

  // ============================================================================
  // Tenant Management
  // ============================================================================

  /**
   * 按 ID 获取租户信息
   */
  async getTenant(tenantId: string): Promise<SsoInternalTenant> {
    const response = await firstValueFrom(
      this.httpService.get<ApiResponse<SsoInternalTenant>>(
        `${this.ssoInternalUrl}/internal/tenants/${tenantId}`,
        {
          headers: this.getInternalHeaders(),
          timeout: 5000,
        },
      ),
    );
    return response.data.data;
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * 检查 SSO 会话状态（跨子域 cookie）
   * 注意：此方法不使用内部 API 认证，而是传递用户 cookie
   */
  async getSession(cookieHeader?: string): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (cookieHeader) headers["Cookie"] = cookieHeader;

    const response = await firstValueFrom(
      this.httpService.get(`${this.ssoBaseUrl}/auth/session`, {
        headers,
        timeout: 5000,
      }),
    );
    return response.data;
  }

  /**
   * 获取用户活跃会话列表
   */
  async getUserSessions(userId: string): Promise<SsoUserSessionsResponse> {
    const response = await firstValueFrom(
      this.httpService.get<ApiResponse<SsoUserSessionsResponse>>(
        `${this.ssoInternalUrl}/internal/users/${userId}/sessions`,
        {
          headers: this.getInternalHeaders(),
          timeout: 5000,
        },
      ),
    );
    return response.data.data;
  }

  /**
   * 撤销用户特定 OIDC 会话
   */
  async revokeSession(
    userId: string,
    clientId: string,
  ): Promise<{ success: boolean }> {
    const response = await firstValueFrom(
      this.httpService.post<ApiResponse<{ success: boolean }>>(
        `${this.ssoInternalUrl}/internal/users/${userId}/sessions/${clientId}/revoke`,
        {},
        {
          headers: this.getInternalHeaders(),
          timeout: 5000,
        },
      ),
    );
    return response.data.data;
  }

  /**
   * 撤销用户所有会话
   */
  async revokeAllSessions(userId: string): Promise<{ success: boolean }> {
    const response = await firstValueFrom(
      this.httpService.post<ApiResponse<{ success: boolean }>>(
        `${this.ssoInternalUrl}/internal/users/${userId}/sessions/revoke-all`,
        {},
        {
          headers: this.getInternalHeaders(),
          timeout: 5000,
        },
      ),
    );
    return response.data.data;
  }

  // ============================================================================
  // Key Management (JWKS rotation)
  // ============================================================================

  /**
   * 获取密钥状态
   */
  async getKeyStatus(): Promise<SsoKeyStatusResponse> {
    const response = await firstValueFrom(
      this.httpService.get<ApiResponse<SsoKeyStatusResponse>>(
        `${this.ssoInternalUrl}/internal/keys/status`,
        {
          headers: this.getInternalHeaders(),
          timeout: 5000,
        },
      ),
    );
    return response.data.data;
  }

  /**
   * 轮换密钥
   */
  async rotateKeys(): Promise<SsoKeyRotateResponse> {
    const response = await firstValueFrom(
      this.httpService.post<ApiResponse<SsoKeyRotateResponse>>(
        `${this.ssoInternalUrl}/internal/keys/rotate`,
        {},
        {
          headers: this.getInternalHeaders(),
          timeout: 5000,
        },
      ),
    );
    return response.data.data;
  }

  /**
   * 清理过期密钥
   */
  async purgeKeys(): Promise<SsoKeyPurgeResponse> {
    const response = await firstValueFrom(
      this.httpService.post<ApiResponse<SsoKeyPurgeResponse>>(
        `${this.ssoInternalUrl}/internal/keys/purge`,
        {},
        {
          headers: this.getInternalHeaders(),
          timeout: 5000,
        },
      ),
    );
    return response.data.data;
  }

  // ============================================================================
  // JWKS (Public keys for JWT verification)
  // ============================================================================

  /**
   * 获取 JWKS 公钥集合
   * 注意：此方法是公开的，不需要认证
   */
  async getJwks(): Promise<{ keys: Array<Record<string, unknown>> }> {
    const response = await firstValueFrom(
      this.httpService.get<{ keys: Array<Record<string, unknown>> }>(
        `${this.ssoBaseUrl}/.well-known/jwks.json`,
        {
          timeout: 5000,
        },
      ),
    );
    return response.data;
  }
}
