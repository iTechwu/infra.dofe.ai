/**
 * Health Check Client Module
 *
 * 职责：提供本地服务健康检查功能
 */
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HealthCheckClient } from './health-check.client';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 0,
    }),
  ],
  providers: [HealthCheckClient],
  exports: [HealthCheckClient],
})
export class HealthCheckClientModule {}
