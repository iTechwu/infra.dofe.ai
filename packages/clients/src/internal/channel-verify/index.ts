import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChannelVerifyClient } from './channel-verify.client';

@Module({
  imports: [HttpModule.register({ timeout: 10000 })],
  providers: [ChannelVerifyClient],
  exports: [ChannelVerifyClient],
})
export class ChannelVerifyClientModule {}

// 导出 Client 类供直接使用
export { ChannelVerifyClient } from './channel-verify.client';
export type { ChannelVerifyResult } from './channel-verify.client';
