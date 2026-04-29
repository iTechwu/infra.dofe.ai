import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AnthropicProxyResearchClient } from './anthropic-proxy-research.client';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    HttpModule.register({
      timeout: 120000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  providers: [AnthropicProxyResearchClient],
  exports: [AnthropicProxyResearchClient],
})
export class AnthropicProxyResearchClientModule {}
