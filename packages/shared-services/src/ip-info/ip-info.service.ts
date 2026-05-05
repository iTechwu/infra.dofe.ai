/**
 * IP Info Service
 *
 * 职责：提供 IP 信息查询服务
 * - IP 地址信息查询（通过 IpInfoClient）
 * - 国家/地区查询
 * - 大洲查询（依赖 CountryCodeService）
 * - 时区查询
 * - 缓存管理
 * - 业务逻辑处理（默认值、特殊地区处理等）
 *
 * 架构：
 * - 使用 IpInfoClient 进行 HTTP 调用（符合架构规范）
 * - 依赖 CountryCodeService（domain 层），因此放置在 infra/shared-services
 */
import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@dofe/infra-redis';
import ipUtil, { MinimalIpRequest } from '@dofe/infra-utils/ip.util';
import validateUtil from '@dofe/infra-utils/validate.util';
import { PardxApp } from '@dofe/infra-common';
import { IpInfoConfig } from '@dofe/infra-common';
import enviromentUtil from '@dofe/infra-utils/environment.util';
import { CountryCodeService } from '@dofe/infra-shared-db';
import { IpInfoClient } from './ip-info.client';

@Injectable()
export class IpInfoService {
  private ipInfoConfig: IpInfoConfig;
  protected ipinfoRedisKey = 'ipinfo';

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly countryCodeService: CountryCodeService,
    private readonly ipInfoClient: IpInfoClient,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.ipInfoConfig = config.getOrThrow<IpInfoConfig>('ipinfo');
  }

  /**
   * 从请求中提取 IP 地址
   */
  extractIp(req: MinimalIpRequest): string {
    return ipUtil.extractIp(req);
  }

  /**
   * 获取 IP 信息
   *
   * 业务逻辑：
   * 1. CN 环境返回默认值
   * 2. 本地 IP 返回默认值
   * 3. 检查 Redis 缓存
   * 4. 调用 ipinfo.io API（通过 IpInfoClient）
   * 5. CN IP 替换为 SG（业务需求）
   * 6. 失败时返回默认值
   */
  async getIpInfo(ip: string): Promise<Partial<PardxApp.IPInfo>> {
    // 1. CN 环境默认值
    if (enviromentUtil.getBaseZone() === 'cn') {
      return this.getDefaultIpInfo(ip, 'CN', 'Beijing', 'Asia/Shanghai');
    }

    // 2. 本地 IP 默认值
    if (validateUtil.isBlank(ip) || ip === '127.0.0.1') {
      return this.getDefaultIpInfo(ip, 'SG', 'Singapore', 'Asia/Singapore');
    }

    // 3. 检查缓存
    const cached = await this.redis.getData(this.ipinfoRedisKey, ip);
    if (cached) {
      this.logger.debug('[IpInfoService] Cache hit', { ip });
      return cached;
    }

    // 4. 调用 API（通过 Client）
    try {
      const apiResponse = await this.ipInfoClient.fetchIpInfo(
        ip,
        this.ipInfoConfig.token,
        this.ipInfoConfig.url,
      );

      let ipInfoData: PardxApp.IPInfo = {
        ip: apiResponse.ip,
        country: apiResponse.country,
        region: apiResponse.region,
        city: apiResponse.city,
        loc: apiResponse.loc,
        timezone: apiResponse.timezone,
        org: apiResponse.org,
      };

      this.logger.info('[IpInfoService] IP info fetched', { ipInfoData });

      // 5. 缓存结果
      await this.redis.saveData(this.ipinfoRedisKey, ip, ipInfoData);

      // 6. CN IP 替换为 SG（业务需求）
      if (ipInfoData.country === 'CN') {
        ipInfoData = this.getDefaultIpInfo(
          ip,
          'SG',
          'Singapore',
          'Asia/Singapore',
        );
      }

      return ipInfoData;
    } catch (error: unknown) {
      // 7. 失败时返回默认值
      this.logger.error('[IpInfoService] Failed to fetch IP info', {
        ip,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getDefaultIpInfo(ip, 'SG', 'Singapore', 'Asia/Singapore');
    }
  }

  /**
   * 获取 IP 所属国家
   */
  async getIpCountry(ip: string): Promise<string> {
    const ipInfo = await this.getIpInfo(ip);
    return ipInfo.country ?? 'SG';
  }

  /**
   * 获取 IP 所属大洲
   */
  async getContinent(ip: string): Promise<string> {
    const countryCode = await this.getIpCountry(ip);
    const relations = await this.countryCodeService.loadRelations();

    for (const [continent, countries] of Object.entries(relations)) {
      if ((countries as string[]).includes(countryCode)) {
        return continent;
      }
    }

    this.logger.error('[IpInfoService] Failed to fetch IP continent', {
      ip,
      countryCode,
    });
    return enviromentUtil.getBaseZone();
  }

  /**
   * 获取 IP 时区
   */
  async getTimeZone(ip: string): Promise<string> {
    const ipInfo = await this.getIpInfo(ip);
    return ipInfo.timezone ?? 'Asia/Singapore';
  }

  /**
   * 生成默认 IP 信息
   */
  private getDefaultIpInfo(
    ip: string,
    country: string,
    city: string,
    timezone: string,
  ): PardxApp.IPInfo {
    return {
      ip,
      country,
      region: city,
      city,
      loc: country === 'CN' ? '39.9042,116.4074' : '1.2897,103.8501',
      timezone,
    };
  }
}
