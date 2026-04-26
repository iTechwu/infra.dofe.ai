import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileStorageServiceModule } from '@dofe/infra-shared-services';
import { UploaderService } from './uploader.service';
import { RedisModule } from '@dofe/infra-redis';
@Module({
  imports: [ConfigModule, RedisModule, FileStorageServiceModule],
  providers: [UploaderService],
  exports: [UploaderService],
})
export class UploaderModule {}
