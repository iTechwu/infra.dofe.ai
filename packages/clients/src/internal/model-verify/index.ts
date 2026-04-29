import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ModelVerifyClient } from './model-verify.client';

@Module({
  imports: [HttpModule.register({ timeout: 15000 })],
  providers: [ModelVerifyClient],
  exports: [ModelVerifyClient],
})
export class ModelVerifyClientModule {}

// 导出 Client 类供直接使用
export { ModelVerifyClient, ModelInfo } from './model-verify.client';
