import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ExchangeRateClient } from './exchange-rate.client';

@Module({
  imports: [HttpModule.register({ timeout: 10000 })],
  providers: [ExchangeRateClient],
  exports: [ExchangeRateClient],
})
export class ExchangeRateModule {}
