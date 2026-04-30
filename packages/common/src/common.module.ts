import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

/**
 * 通用模块
 * 提供全局可用的通用服务和功能
 */
@Global()
@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class CommonModule {}
