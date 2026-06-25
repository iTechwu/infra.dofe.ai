/**
 * RabbitMQ Events Module
 *
 * 独立的 RabbitMQ 连接用于事件驱动系统
 * 使用独立的 vhost: nestjs_to_agentx_events
 * 不影响其他任务队列
 */
import { Module } from '@nestjs/common';
import * as Rabbitmq from 'amqplib';
import { ConfigModule } from '@nestjs/config';
import environment from '@dofe/infra-utils/environment.util';
import { RabbitmqEventsService } from './rabbitmq-events.service';
import {
  RABBITMQ_EVENTS_CONNECTION,
  type RabbitmqEventsConnection,
} from './rabbitmq-events.constants';

export { RABBITMQ_EVENTS_CONNECTION, RabbitmqEventsConnection };

function logEvents(level: 'error' | 'warn' | 'log', message: string, meta?: unknown) {
  if (level === 'warn') {
    console.warn(message, meta);
    return;
  }
  if (level === 'error') {
    console.error(message, meta);
    return;
  }
  console.log(message, meta);
}

@Module({
  imports: [ConfigModule],
  providers: [
    RabbitmqEventsService,
    {
      provide: RABBITMQ_EVENTS_CONNECTION,
      useFactory: async (): Promise<RabbitmqEventsConnection> => {
        const maxRetries = 5;
        const retryDelay = 3000; // 3 seconds
        let lastError: Error | null = null;

        // 使用独立的 RabbitMQ 连接 URL (独立 vhost)
        const rabbitmqEventsUrl = process.env.RABBITMQ_EVENTS_URL!;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            logEvents(
              'log',
              `[Events] Attempting to connect to RabbitMQ Events (attempt ${attempt}/${maxRetries})`,
            );

            const urlWithHeartbeat = rabbitmqEventsUrl.includes('?')
              ? `${rabbitmqEventsUrl}&heartbeat=60`
              : `${rabbitmqEventsUrl}?heartbeat=60`;

            const connection = await Rabbitmq.connect(urlWithHeartbeat, {
              recovery: true,
            });

            if (environment.isProduction()) {
              logEvents(
                'log',
                '✅ [Events] RabbitMQ Events connection established successfully',
              );
            } else {
              logEvents(
                'log',
                `✅ [Events] RabbitMQ Events connection established: ${rabbitmqEventsUrl}`,
              );
            }

            // 设置连接错误监听
            connection.on('error', (error) => {
              console.error(
                '[Events] RabbitMQ Events connection error:',
                error,
              );
            });

            connection.on('close', () => {
              logEvents('warn', '⚠️  [Events] RabbitMQ Events connection closed');
            });

            return {
              connection: connection as any,
              close: async () => {
                try {
                  await connection.close();
                  logEvents(
                    'log',
                    '✅ [Events] RabbitMQ Events connection closed gracefully',
                  );
                } catch (error) {
                  // 忽略已关闭的连接错误
                  if (
                    !(error instanceof Error) ||
                    (!error.message.includes('closed') &&
                      !error.message.includes('Connection closed') &&
                      !error.message.includes('IllegalOperationError'))
                  ) {
                    logEvents(
                      'error',
                      '❌ [Events] Error closing RabbitMQ Events connection:',
                      error,
                    );
                  }
                }
              },
            };
          } catch (error) {
            lastError = error as Error;
            logEvents(
              'error',
              `[Events] RabbitMQ Events connection attempt ${attempt}/${maxRetries} failed:`,
              error,
            );

            if (attempt < maxRetries) {
              logEvents('log', `[Events] Retrying in ${retryDelay}ms...`);
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
          }
        }

        logEvents(
          'error',
          '[Events] Failed to establish RabbitMQ Events connection after all retries',
        );

        // 如果连接失败,返回一个 fallback 对象而不是抛出错误
        // 这样系统可以继续运行,只是事件功能不可用
        logEvents(
          'warn',
          '⚠️  [Events] RabbitMQ Events service is unavailable, events will not be published',
        );

        return {
          connection: null as any,
          close: async () => {
            logEvents('log', '[Events] No RabbitMQ Events connection to close');
          },
        };
      },
    },
  ],
  exports: [RABBITMQ_EVENTS_CONNECTION, RabbitmqEventsService],
})
export class RabbitmqEventsModule {}
