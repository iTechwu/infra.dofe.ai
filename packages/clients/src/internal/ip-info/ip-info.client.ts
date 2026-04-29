/**
 * IP Info Client
 *
 * 职责：仅负责与 ipinfo.io API 通信
 * - 调用 ipinfo.io API 获取 IP 地理位置信息
 * - 不访问数据库
 * - 不包含业务逻辑
 */
import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { firstValueFrom } from 'rxjs';
import { getKeysConfig } from '@/config/configuration';
import { IpInfoResponse } from './dto/ip-info.dto';
import type { IpInfoKeysConfig } from '@/config/validation';
import { FeatureNotConfiguredError } from '@/config/features';

@Injectable()
export class IpInfoClient {
  private readonly config: IpInfoKeysConfig | undefined;

  constructor(
    private readonly httpService: HttpService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.config = getKeysConfig()?.ipinfo as IpInfoKeysConfig | undefined;
    if (!this.config) {
      this.logger.warn('IP Info config not found in keys/config.json, feature disabled');
    }
  }

  /**
   * 获取 IP 地理位置信息
   * @param ip IP 地址
   * @returns IP 信息
   */
  async getIpInfo(ip: string): Promise<IpInfoResponse> {
    if (!this.config) {
      throw new FeatureNotConfiguredError('ipinfo', 'keys.ipinfo');
    }
    const url = `${this.config.url}/${ip}?token=${this.config.token}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<IpInfoResponse>(url, {
          timeout: 10000,
        }),
      );

      this.logger.debug(`IP info fetched for ${ip}`, {
        country: response.data.country,
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch IP info for ${ip}`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
