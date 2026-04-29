/**
 * Channel Verification Client
 * 封装第三方渠道凭证验证 API 调用
 */

import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';

/**
 * 飞书 API 响应
 */
interface FeishuTokenResponse {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
}

/**
 * Telegram API 响应
 */
interface TelegramMeResponse {
  ok: boolean;
  result?: { username: string; first_name: string };
  description?: string;
}

/**
 * Discord API 响应
 */
interface DiscordMeResponse {
  username: string;
  discriminator: string;
  id: string;
}

/**
 * 渠道验证结果
 */
export interface ChannelVerifyResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class ChannelVerifyClient {
  private readonly TIMEOUT_MS = 10000;

  constructor(private readonly httpService: HttpService) {}

  /**
   * 验证飞书渠道凭证
   */
  async verifyFeishu(
    appId: string,
    appSecret: string,
    domain: 'feishu' | 'lark' = 'feishu',
  ): Promise<ChannelVerifyResult> {
    const baseUrl =
      domain === 'lark'
        ? 'https://open.larksuite.com'
        : 'https://open.feishu.cn';

    try {
      const response = await firstValueFrom(
        this.httpService
          .post<FeishuTokenResponse>(
            `${baseUrl}/open-apis/auth/v3/tenant_access_token/internal`,
            { app_id: appId, app_secret: appSecret },
            { headers: { 'Content-Type': 'application/json' } },
          )
          .pipe(
            timeout(this.TIMEOUT_MS),
            catchError((error) =>
              of({
                status: 500,
                data: { code: -1, msg: error.message || 'Unknown error' },
              }),
            ),
          ),
      );

      const data = response.data;

      if (
        'tenant_access_token' in data &&
        data.code === 0 &&
        data.tenant_access_token
      ) {
        return {
          success: true,
          message: 'Feishu credentials verified successfully',
          details: {
            tokenExpire: data.expire,
            domain,
          },
        };
      } else {
        return {
          success: false,
          message: `Feishu API error: ${data.msg || 'Unknown error'}`,
          details: { code: data.code },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Feishu API: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 验证 Telegram 渠道凭证
   */
  async verifyTelegram(botToken: string): Promise<ChannelVerifyResult> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .get<TelegramMeResponse>(
            `https://api.telegram.org/bot${botToken}/getMe`,
          )
          .pipe(
            timeout(this.TIMEOUT_MS),
            catchError((error) =>
              of({
                status: 500,
                data: { ok: false, description: error.message },
              }),
            ),
          ),
      );

      const data = response.data;

      if ('result' in data && data.ok && data.result) {
        return {
          success: true,
          message: `Telegram bot verified: @${data.result.username}`,
          details: {
            username: data.result.username,
            firstName: data.result.first_name,
          },
        };
      } else {
        return {
          success: false,
          message: `Telegram API error: ${'description' in data ? data.description : 'Unknown error'}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Telegram API: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 验证 Discord 渠道凭证
   */
  async verifyDiscord(botToken: string): Promise<ChannelVerifyResult> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .get<DiscordMeResponse>('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bot ${botToken}` },
          })
          .pipe(
            timeout(this.TIMEOUT_MS),
            catchError((error) =>
              of({
                status: error.response?.status || 500,
                data: error.response?.data || { message: error.message },
              }),
            ),
          ),
      );

      if (response.status === 200) {
        const data = response.data;
        return {
          success: true,
          message: `Discord bot verified: ${data.username}#${data.discriminator}`,
          details: {
            username: data.username,
            discriminator: data.discriminator,
            id: data.id,
          },
        };
      } else {
        const errorData = response.data as { message?: string };
        return {
          success: false,
          message: `Discord API error: ${errorData.message || 'Unknown error'}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Discord API: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
