import { Module, Global } from '@nestjs/common';
import { RedisModule } from './redis.module';
import { TenantRedisService } from './tenant-redis.service';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule, RedisModule],
  providers: [TenantRedisService],
  exports: [TenantRedisService],
})
export class TenantRedisModule {}
