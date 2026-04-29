/**
 * 飞书 OAuth 客户端
 *
 * 用于飞书机器人扫码配置功能，调用飞书 Accounts API 实现自动注册机器人。
 *
 * API 端点：
 * - accounts.feishu.cn / accounts.larksuite.com
 * - /oauth/v1/app/registration?action=init|begin|poll
 *
 * 流程：
 * 1. init - 检查支持的认证方法
 * 2. begin - 生成二维码 URL 和 device_code
 * 3. poll - 轮询扫码结果，成功返回 client_id 和 client_secret
 */
import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';

// ============================================================================
// Types
// ============================================================================

export interface FeishuOAuthConfig {
  domain: 'feishu' | 'lark';
}

export interface FeishuOAuthInitResponse {
  auth_methods: string[];
}

export interface FeishuOAuthBeginResponse {
  device_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  interval: number;
  expires_in: number;
}

export interface FeishuOAuthPollResponse {
  status: 'pending' | 'success' | 'expired' | 'error';
  // On success
  client_id?: string;
  client_secret?: string;
  user_info?: {
    open_id: string;
    union_id?: string;
    name?: string;
    avatar_url?: string;
    tenant_brand?: 'feishu' | 'lark';
  };
  // On error
  error?: string;
  error_code?: string;
  error_description?: string;
}

// ============================================================================
// Client
// ============================================================================

@Injectable()
export class FeishuOAuthClient {
  private readonly TIMEOUT_MS = 15000;

  constructor(
    private readonly httpService: HttpService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  /**
   * 获取飞书 Accounts API 基础 URL
   */
  private getBaseUrl(domain: 'feishu' | 'lark'): string {
    return domain === 'lark'
      ? 'https://accounts.larksuite.com'
      : 'https://accounts.feishu.cn';
  }

  /**
   * 初始化 OAuth - 检查支持的认证方法
   */
  async init(config: FeishuOAuthConfig): Promise<{ authMethods: string[] }> {
    const baseUrl = this.getBaseUrl(config.domain);
    const url = `${baseUrl}/oauth/v1/app/registration`;

    // 飞书 API 需要 application/x-www-form-urlencoded 格式
    const formData = new URLSearchParams({
      action: 'init',
    }).toString();

    try {
      const response = await firstValueFrom(
        this.httpService
          .post<FeishuOAuthInitResponse>(url, formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          })
          .pipe(
            timeout(this.TIMEOUT_MS),
            catchError((error) => {
              this.logger.warn('Feishu OAuth init failed, using defaults', {
                domain: config.domain,
                error: error.message,
              });
              return of({
                status: 500,
                data: {
                  auth_methods: ['client_secret'],
                } as FeishuOAuthInitResponse,
              });
            }),
          ),
      );

      const authMethods = response.data?.auth_methods || ['client_secret'];

      this.logger.info('Feishu OAuth init completed', {
        domain: config.domain,
        authMethods,
      });

      return { authMethods };
    } catch (error) {
      this.logger.error('Feishu OAuth init failed', {
        domain: config.domain,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Return default methods if init fails
      return { authMethods: ['client_secret'] };
    }
  }

  /**
   * 开始 OAuth 流程 - 获取设备码和二维码 URL
   */
  async begin(config: FeishuOAuthConfig): Promise<FeishuOAuthBeginResponse> {
    const baseUrl = this.getBaseUrl(config.domain);
    const url = `${baseUrl}/oauth/v1/app/registration`;

    // 飞书 API 需要 application/x-www-form-urlencoded 格式
    const formData = new URLSearchParams({
      action: 'begin',
      archetype: 'PersonalAgent',
      auth_method: 'client_secret',
      request_user_info: 'open_id',
    }).toString();

    try {
      const response = await firstValueFrom(
        this.httpService
          .post<FeishuOAuthBeginResponse>(url, formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          })
          .pipe(
            timeout(this.TIMEOUT_MS),
            catchError((error) => {
              this.logger.error('Feishu OAuth begin request failed', {
                domain: config.domain,
                error: error.message,
              });
              throw error;
            }),
          ),
      );

      const data = response.data;

      if (!data.device_code) {
        throw new Error('Failed to get device code from Feishu');
      }

      this.logger.info('Feishu OAuth begin completed', {
        domain: config.domain,
        deviceCode: data.device_code,
        expiresIn: data.expires_in,
      });

      return {
        device_code: data.device_code,
        verification_uri: data.verification_uri,
        verification_uri_complete: data.verification_uri_complete,
        interval: data.interval || 5,
        expires_in: data.expires_in || 300,
      };
    } catch (error) {
      this.logger.error('Feishu OAuth begin failed', {
        domain: config.domain,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * 轮询 OAuth 完成状态
   */
  async poll(
    deviceCode: string,
    config: FeishuOAuthConfig,
  ): Promise<FeishuOAuthPollResponse> {
    const baseUrl = this.getBaseUrl(config.domain);
    const url = `${baseUrl}/oauth/v1/app/registration`;

    // 飞书 API 需要 application/x-www-form-urlencoded 格式
    const formData = new URLSearchParams({
      action: 'poll',
      device_code: deviceCode,
    }).toString();

    try {
      const response = await firstValueFrom(
        this.httpService
          .post<FeishuOAuthPollResponse>(url, formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            validateStatus: (status) => status < 500, // Accept 400 as valid response
          })
          .pipe(
            timeout(this.TIMEOUT_MS),
            catchError((error) => {
              this.logger.warn('Feishu OAuth poll request failed', {
                domain: config.domain,
                deviceCode,
                error: error.message,
              });
              return of({
                data: {
                  status: 'error' as const,
                  error: error.message,
                } as FeishuOAuthPollResponse,
              });
            }),
          ),
      );

      const data = response.data;

      this.logger.debug('Feishu OAuth poll result', {
        domain: config.domain,
        deviceCode,
        status: data?.status,
        error: data?.error,
      });

      // Handle different response formats
      if (data?.client_id && data?.client_secret) {
        return {
          status: 'success',
          client_id: data.client_id,
          client_secret: data.client_secret,
          user_info: data.user_info,
        };
      }

      // authorization_pending is normal status, not an error
      if (
        data?.error === 'authorization_pending' ||
        data?.status === 'pending'
      ) {
        return { status: 'pending' };
      }

      if (
        data?.error === 'expired_token' ||
        data?.error === 'invalid_grant' ||
        data?.status === 'expired'
      ) {
        return { status: 'expired', error: 'Device code expired' };
      }

      if (data?.error === 'access_denied') {
        return { status: 'error', error: 'User denied authorization' };
      }

      // Handle other errors
      if (data?.error && data?.error !== 'authorization_pending') {
        return { status: 'error', error: data.error_description || data.error };
      }

      if (data?.status) {
        return data;
      }

      // Default to pending if no clear status
      return { status: 'pending' };
    } catch (error) {
      this.logger.error('Feishu OAuth poll failed', {
        domain: config.domain,
        deviceCode,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
