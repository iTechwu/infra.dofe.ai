/**
 * IP Info Service Module
 *
 * 职责：提供 IP 信息查询服务
 *
 * 架构：
 * - 位于 infra/shared-services（基础设施层）
 * - 依赖 CountryCodeModule（domain 层）- 允许 infra 依赖 domain
 * - 使用 HttpModule 进行外部 API 调用
 */
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '@dofe/infra-redis';
import { CountryCodeModule } from '@dofe/infra-shared-db';
import { IpInfoClient } from './ip-info.client';
import { IpInfoService } from './ip-info.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    RedisModule,
    CountryCodeModule,
  ],
  providers: [IpInfoClient, IpInfoService],
  exports: [IpInfoService],
})
export class IpInfoModule {}
