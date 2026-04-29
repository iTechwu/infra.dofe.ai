import { Module, Global } from '@nestjs/common';
import { RedisModule } from './redis.module';
import { RedisLockService } from './redis-lock.service';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule, RedisModule],
  providers: [RedisLockService],
  exports: [RedisLockService],
})
export class RedisLockModule {}
