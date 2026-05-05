import { Module } from '@nestjs/common';
import { FileCdnClient } from './file-cdn.client';
import { FileStorageServiceModule } from '../file-storage/file-storage.module';
import { RedisModule } from '@dofe/infra-redis';
import { ConfigModule } from '@nestjs/config';
import { CryptModule } from '@dofe/infra-clients';

@Module({
  imports: [ConfigModule, RedisModule, FileStorageServiceModule, CryptModule],
  providers: [FileCdnClient],
  exports: [FileCdnClient],
})
export class FileCdnModule {}
