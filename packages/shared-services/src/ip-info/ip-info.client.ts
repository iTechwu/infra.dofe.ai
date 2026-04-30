/**
 * IP Info Client
 *
 * 职责：封装 ipinfo.io API 的 HTTP 调用
 * - 仅负责 HTTP 通信，不包含业务逻辑
 * - 使用 @nestjs/axios 的 HttpService
 */
import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { firstValueFrom } from 'rxjs';

/**
 * ipinfo.io API 返回的原始数据结构
 */
export interface IpInfoApiResponse {
  ip: string;
  hostname?: string;
  city?: string;
  region?: string;
  country: string;
  loc: string;
  org?: string;
  postal?: string;
  timezone: string;
}

@Injectable()
export class IpInfoClient {
  private readonly API_TIMEOUT = 5000;

  constructor(
    private readonly httpService: HttpService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  /**
   * 从 ipinfo.io 获取 IP 信息
   *
   * @param ip - IP 地址
   * @param token - ipinfo.io API token
   * @param baseUrl - API 基础 URL（默认：https://ipinfo.io）
   * @returns IP 信息
   */
  async fetchIpInfo(
    ip: string,
    token: string,
    baseUrl: string = 'https://ipinfo.io',
  ): Promise<IpInfoApiResponse> {
    const url = `${baseUrl}/${ip}?token=${token}`;

    try {
      this.logger.debug('[IpInfoClient] Fetching IP info', { ip, url });

      const response = await firstValueFrom(
        this.httpService.get<IpInfoApiResponse>(url, {
          timeout: this.API_TIMEOUT,
        }),
      );

      this.logger.debug('[IpInfoClient] IP info fetched successfully', {
        ip,
        data: response.data,
      });

      return response.data;
    } catch (error) {
      this.logger.error('[IpInfoClient] Failed to fetch IP info', {
        ip,
        error: error.message || String(error),
      });
      throw new Error(`Failed to fetch IP info for ${ip}: ${error.message}`);
    }
  }
}
