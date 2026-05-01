import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RabbitmqModule } from '@dofe/infra-rabbitmq';
import { NotificationService } from './notification.service';

@Module({
  imports: [HttpModule, RabbitmqModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
