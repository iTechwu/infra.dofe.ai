import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AIProviderClient } from './ai-provider.client';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  providers: [AIProviderClient],
  exports: [AIProviderClient],
})
export class AIProviderClientModule {}
