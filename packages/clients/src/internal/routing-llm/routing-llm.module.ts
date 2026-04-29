import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RoutingLLMClient } from './routing-llm.client';

@Module({
  imports: [
    HttpModule.register({
      timeout: 120000,
      maxRedirects: 5,
    }),
  ],
  providers: [RoutingLLMClient],
  exports: [RoutingLLMClient],
})
export class RoutingLLMModule {}
