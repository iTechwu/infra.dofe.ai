/**
 * SMS Service Module
 *
 * 职责：提供短信发送的业务逻辑服务
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { RedisModule } from '@dofe/infra-redis';
import { RabbitmqModule } from '@dofe/infra-rabbitmq';
import { VerifyModule } from '@dofe/infra-clients';
import { SmsService } from './sms.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    RedisModule,
    RabbitmqModule,
    VerifyModule,
  ],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsServiceModule {}
