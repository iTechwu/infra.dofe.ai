/**
 * 飞书客户端模块
 */
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FeishuClientService } from './feishu-client.service';
import { FeishuOAuthClient } from './feishu-oauth.client';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  providers: [FeishuClientService, FeishuOAuthClient],
  exports: [FeishuClientService, FeishuOAuthClient],
})
export class FeishuClientModule {}
