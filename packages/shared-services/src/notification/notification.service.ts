import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { firstValueFrom } from 'rxjs';

import { RabbitmqService } from '@dofe/infra-rabbitmq';

import { NotificationSendOptions } from './notification.types';

@Injectable()
export class NotificationService {
  constructor(
    private readonly rabbitmq: RabbitmqService,
    private readonly httpService: HttpService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async send(options: NotificationSendOptions): Promise<void> {
    switch (options.channel) {
      case 'email':
        await this.sendEmail(options);
        break;
      case 'webhook':
        await this.sendWebhook(options);
        break;
      default:
        this.logger.warn(`Unknown notification channel: ${options.channel}`);
    }
  }

  private async sendEmail(options: NotificationSendOptions): Promise<void> {
    await this.rabbitmq.sendMessageToRabbitMQ('notification', {
      channel: 'email',
      recipients: options.recipients,
      subject: options.subject,
      content: options.content,
      priority: options.priority ?? 'normal',
      metadata: options.metadata,
    });

    this.logger.info('Email notification queued', {
      recipients: options.recipients,
      subject: options.subject,
    });
  }

  private async sendWebhook(options: NotificationSendOptions): Promise<void> {
    const results = await Promise.allSettled(
      options.recipients.map(async (url) => {
        const response = await firstValueFrom(
          this.httpService.post(url, {
            content: options.content,
            priority: options.priority ?? 'normal',
            metadata: options.metadata,
          }),
        );
        return { url, status: response.status };
      }),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error('Webhook notification failed', {
          error: result.reason?.message,
        });
      }
    }

    this.logger.info('Webhook notifications sent', {
      total: results.length,
      succeeded: results.filter((r) => r.status === 'fulfilled').length,
    });
  }
}
