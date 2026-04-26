/**
 * Email Service Module
 *
 * 职责：提供邮件发送的业务逻辑服务
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { RedisModule } from '@dofe/infra-redis';
import { RabbitmqModule } from '@dofe/infra-rabbitmq';
import { VerifyModule } from '@dofe/infra-clients';
import { EmailService } from './email.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    RedisModule,
    RabbitmqModule,
    VerifyModule,
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailServiceModule {}
