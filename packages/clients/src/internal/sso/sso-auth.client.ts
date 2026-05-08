import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SsoAuthClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get ssoInternalUrl(): string {
    return (
      this.configService.get<string>('SSO_INTERNAL_API_URL') ||
      'http://localhost:3102/api'
    );
  }

  private get ssoBaseUrl(): string {
    return (
      this.configService.get<string>('SSO_API_URL') ||
      'http://localhost:3102/api'
    );
  }

  /**
   * 验证 access token 有效性
   */
  async verifyToken(accessToken: string): Promise<{
    valid: boolean;
    userId?: string;
    expiresAt?: number;
  }> {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.ssoInternalUrl}/internal/verify-token`,
        { token: accessToken },
        {
          headers: {
            'Authorization': `Bearer ${this.getServiceToken()}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        },
      ),
    );
    return response.data;
  }

  /**
   * 检查 SSO 会话状态（跨子域 cookie）
   */
  async getSession(cookieHeader?: string): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (cookieHeader) headers['Cookie'] = cookieHeader;

    const response = await firstValueFrom(
      this.httpService.get(`${this.ssoBaseUrl}/auth/session`, {
        headers,
        timeout: 5000,
      }),
    );
    return response.data;
  }

  /**
   * 按 ID 获取用户信息
   */
  async getUser(userId: string): Promise<unknown> {
    const response = await firstValueFrom(
      this.httpService.get(`${this.ssoInternalUrl}/internal/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${this.getServiceToken()}`,
        },
        timeout: 5000,
      }),
    );
    return response.data;
  }

  /**
   * 获取 JWKS 公钥集合
   */
  async getJwks(): Promise<{ keys: Array<Record<string, unknown>> }> {
    const response = await firstValueFrom(
      this.httpService.get(`${this.ssoBaseUrl}/.well-known/jwks.json`, {
        timeout: 5000,
      }),
    );
    return response.data;
  }

  private getServiceToken(): string {
    return this.configService.get<string>('INTERNAL_API_SECRET') || '';
  }
}
