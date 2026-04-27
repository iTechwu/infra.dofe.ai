import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IpInfoClient } from './ip-info.client';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
  ],
  providers: [IpInfoClient],
  exports: [IpInfoClient],
})
export class IpInfoClientModule {}
