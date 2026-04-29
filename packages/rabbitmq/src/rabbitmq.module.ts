import { Module } from '@nestjs/common';
import * as Rabbitmq from 'amqplib';
import { RABBITMQ_CONNECTION, RabbitmqConnection } from './dto/rabbitmq.dto';
import { RabbitmqService } from './rabbitmq.service';
import { createContextLogger } from '@/utils/logger-standalone.util';

const logger = createContextLogger('RabbitmqModule');
const CONNECT_TIMEOUT_MS = 5000;

@Module({
  providers: [
    {
      provide: RABBITMQ_CONNECTION,
      useFactory: async (): Promise<RabbitmqConnection> => {
        const rabbitmqUrl = process.env.RABBITMQ_URL;
        let connection: Rabbitmq.Connection | null = null;
        let connectPromise: Promise<Rabbitmq.Connection> | null = null;
        logger.info(`init RabbitmqModule rabbitmqUrl=${rabbitmqUrl}`);

        const connect = async (): Promise<Rabbitmq.Connection> => {
          logger.info(`connect RabbitmqModule rabbitmqUrl=${rabbitmqUrl}`);
          if (!rabbitmqUrl) {
            throw new Error('RABBITMQ_URL environment variable is not set');
          }

          if (connection && !connection.connection?.closed) {
            return connection;
          }

          if (connectPromise) {
            return connectPromise;
          }

          logger.info(
            `Attempting to connect to RabbitMQ host---${rabbitmqUrl}`,
          );

          connectPromise = Promise.race([
            Rabbitmq.connect(rabbitmqUrl, {
              heartbeat: 60,
            }),
            new Promise<never>((_, reject) => {
              setTimeout(() => {
                reject(
                  new Error(
                    `RabbitMQ connect timeout after ${CONNECT_TIMEOUT_MS}ms`,
                  ),
                );
              }, CONNECT_TIMEOUT_MS);
            }),
          ])
            .then((conn) => {
              connection = conn;
              // logger.info('RabbitMQ connection established successfully');
              return conn;
            })
            .catch((error) => {
              connection = null;
              logger.error('Failed to connect to RabbitMQ', {
                error: error instanceof Error ? error.message : String(error),
              });
              throw error;
            })
            .finally(() => {
              connectPromise = null;
            });

          return connectPromise;
        };

        return {
          get connection() {
            return connection;
          },
          connect,
          close: async () => {
            if (!connection) {
              return;
            }

            try {
              await connection.close();
              logger.info('RabbitMQ connection closed gracefully');
            } catch (error) {
              if (
                !(error instanceof Error) ||
                (!error.message.includes('closed') &&
                  !error.message.includes('Connection closed') &&
                  !error.message.includes('IllegalOperationError'))
              ) {
                logger.error('Error closing RabbitMQ connection', {
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            } finally {
              connection = null;
            }
          },
        };
      },
    },
    RabbitmqService,
  ],
  exports: [RABBITMQ_CONNECTION, RabbitmqService],
})
export class RabbitmqModule {}
