import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import * as amqplib from 'amqplib';

import { RABBITMQ_CONNECTION, RabbitmqConnection } from './dto/rabbitmq.dto';

interface MessageHandler {
  (message: any): Promise<void>;
}

interface ConsumerInfo {
  queue: string;
  consumerTag: string;
  handler: MessageHandler;
}

const isProductionEnv = (): boolean => {
  const nodeEnv = process.env.NODE_ENV;
  return (
    nodeEnv === 'prod' ||
    nodeEnv === 'production' ||
    nodeEnv === 'prodap' ||
    nodeEnv === 'produs'
  );
};

const isRabbitmqOptional = (): boolean =>
  process.env.RABBITMQ_OPTIONAL === 'true';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private channel: amqplib.Channel | undefined;
  private consumers: Map<string, ConsumerInfo> = new Map();
  private isConnected = false;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private boundConnection: amqplib.Connection | null = null;

  constructor(
    @Inject(RABBITMQ_CONNECTION)
    private readonly rabbitmqConnection: RabbitmqConnection,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async onModuleInit() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isShuttingDown = false;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.channel = undefined;
    this.boundConnection = null;

    // 统一改为后台连接，避免阻塞 Nest 启动（与 ConfigurationService、ReconciliationService 一致）
    // 根因：ProxyApiModule 等接入后模块初始化顺序变化，RabbitmqService.onModuleInit 若 await 连接，
    // 会在「最后日志：init RabbitmqModule」之后卡住，导致应用无法完成启动
    if (isProductionEnv() && !isRabbitmqOptional()) {
      this.logger.info(
        'RabbitMQ connection will be established in background (non-blocking startup)',
      );
    } else {
      this.logger.warn(
        'RabbitMQ startup is non-blocking because optional mode is enabled',
      );
    }
    void this.initializeConnection();
  }

  get connection() {
    return this.rabbitmqConnection;
  }

  private async initializeConnection(): Promise<boolean> {
    if (this.isShuttingDown || this.isConnecting) {
      return false;
    }

    this.isConnecting = true;

    try {
      const conn = await this.rabbitmqConnection.connect();

      if (conn.connection?.closed) {
        throw new Error('RabbitMQ connection is closed');
      }

      this.setupConnectionEventListeners(conn);
      await this.createChannel(conn);
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // if (isProductionEnv()) {
      //   this.logger.info('RabbitMQ service initialized successfully');
      // } else {
      //   this.logger.warn('RabbitMQ service connected in background');
      // }

      return true;
    } catch (error) {
      this.isConnected = false;
      this.channel = undefined;

      if (isProductionEnv() && !isRabbitmqOptional()) {
        this.logger.error('Failed to initialize RabbitMQ service', {
          error,
        });
      } else {
        this.logger.warn('RabbitMQ is unavailable in current environment', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await this.scheduleReconnect();
      return false;
    } finally {
      this.isConnecting = false;
    }
  }

  private setupConnectionEventListeners(conn: amqplib.Connection): void {
    if (this.boundConnection === conn) {
      return;
    }

    this.boundConnection = conn;

    conn.on('error', (error) => {
      this.logger.error('RabbitMQ connection error', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.handleConnectionClosed();
    });

    conn.on('close', () => {
      this.logger.warn('RabbitMQ connection closed');
      this.handleConnectionClosed();
    });
  }

  private handleConnectionClosed(): void {
    this.isConnected = false;
    this.isConnecting = false;
    this.channel = undefined;
    this.boundConnection = null;

    if (!this.isShuttingDown) {
      void this.scheduleReconnect();
    }
  }

  private async createChannel(conn: amqplib.Connection): Promise<void> {
    if (conn.connection?.closed) {
      throw new Error('Cannot create channel: RabbitMQ connection is closed');
    }

    try {
      if (this.channel) {
        try {
          await this.channel.close();
        } catch {
          // ignore close errors for stale channel
        }
        this.channel = undefined;
      }

      this.channel = await conn.createChannel();

      this.channel.on('error', (error) => {
        this.logger.error('RabbitMQ channel error', {
          error: error instanceof Error ? error.message : String(error),
        });
        this.channel = undefined;
        this.isConnected = false;

        if (!this.isShuttingDown) {
          void this.scheduleReconnect();
        }
      });

      this.channel.on('close', () => {
        if (isProductionEnv()) {
          this.logger.warn('RabbitMQ channel closed');
        }
        this.channel = undefined;
      });

      await this.channel.prefetch(1);

      if (isProductionEnv()) {
        this.logger.info('RabbitMQ channel created successfully');
      }
    } catch (error) {
      this.logger.error('Failed to create RabbitMQ channel', { error });
      this.channel = undefined;
      this.isConnected = false;
      throw error;
    }
  }

  private async scheduleReconnect(): Promise<void> {
    if (
      this.isShuttingDown ||
      this.isConnecting ||
      this.reconnectTimer ||
      this.reconnectAttempts >= this.maxReconnectAttempts
    ) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    this.logger.info(
      `Scheduling RabbitMQ reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`,
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      const connected = await this.initializeConnection();

      if (connected) {
        await this.reestablishConsumers();
      }
    }, delay);
  }

  private async reestablishConsumers(): Promise<void> {
    for (const [queue, consumerInfo] of this.consumers) {
      try {
        await this.consumeMessagesFromRabbitMQ(queue, consumerInfo.handler);
        this.logger.info(`Reestablished consumer for queue: ${queue}`);
      } catch (error) {
        this.logger.error(
          `Failed to reestablish consumer for queue: ${queue}`,
          { error },
        );
      }
    }
  }

  private async ensureChannel(): Promise<amqplib.Channel> {
    const conn = this.rabbitmqConnection.connection;

    if (
      !this.isConnected ||
      !this.channel ||
      !conn ||
      conn.connection?.closed
    ) {
      const connected = await this.initializeConnection();
      if (!connected && !this.channel) {
        throw new Error('RabbitMQ channel is not available');
      }
    }

    if (!this.channel) {
      throw new Error('RabbitMQ channel is not available');
    }

    return this.channel;
  }

  async sendMessageToRabbitMQ(
    queue: string,
    message: any,
    bindKey?: string,
  ): Promise<void> {
    try {
      const channel = await this.ensureChannel();

      await channel.assertQueue(queue, { durable: true });

      const messageWithMetadata = {
        ...message,
        queue,
        bindKey,
        timestamp: new Date().toISOString(),
      };

      const result = channel.publish(
        '',
        queue,
        Buffer.from(JSON.stringify(messageWithMetadata)),
        { persistent: true },
      );

      if (!result) {
        throw new Error('Failed to publish message to queue');
      }

      this.logger.debug('Message sent to RabbitMQ', {
        queue,
      });
    } catch (error) {
      if (!isProductionEnv() || isRabbitmqOptional()) {
        this.logger.warn(
          'Skipped RabbitMQ message publish because optional mode is enabled',
          {
            queue,
            error: error instanceof Error ? error.message : String(error),
            message:
              typeof message === 'object' ? JSON.stringify(message) : message,
          },
        );
        return;
      }

      this.logger.error('Error sending message to RabbitMQ', {
        error,
        queue,
        message:
          typeof message === 'object' ? JSON.stringify(message) : message,
      });
      throw error;
    }
  }

  async consumeMessagesFromRabbitMQ(
    queue: string,
    handleMessage: MessageHandler,
  ): Promise<void> {
    this.consumers.set(queue, {
      queue,
      consumerTag: this.consumers.get(queue)?.consumerTag ?? '',
      handler: handleMessage,
    });

    try {
      const channel = await this.ensureChannel();

      await channel.assertQueue(queue, { durable: true });

      const existingConsumer = this.consumers.get(queue);
      if (existingConsumer?.consumerTag) {
        try {
          await channel.cancel(existingConsumer.consumerTag);
        } catch {
          // ignore stale consumer cancellation errors
        }
      }

      const { consumerTag } = await channel.consume(
        queue,
        (msg) => this.handleIncomingMessage(msg, handleMessage, channel),
        { noAck: false },
      );

      this.consumers.set(queue, {
        queue,
        consumerTag,
        handler: handleMessage,
      });
    } catch (error) {
      if (!isProductionEnv() || isRabbitmqOptional()) {
        this.logger.warn('Deferred RabbitMQ consumer registration', {
          queue,
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }

      this.logger.error('Error setting up consumer', { error, queue });
      throw error;
    }
  }

  private async handleIncomingMessage(
    msg: amqplib.ConsumeMessage | null,
    handleMessage: MessageHandler,
    channel: amqplib.Channel,
  ): Promise<void> {
    if (!msg) {
      this.logger.warn('Received null message');
      return;
    }

    let messageContent: any = null;
    let rabbitQueueId: string | undefined;

    try {
      const messageString = msg.content.toString();
      messageContent = JSON.parse(messageString);
      rabbitQueueId = messageContent?.rabbitQueueId;

      if (!messageContent) {
        channel.ack(msg);
        return;
      }

      await handleMessage(messageContent);
      channel.ack(msg);

      this.logger.debug('Message processed successfully', {
        rabbitQueueId,
      });
    } catch (error) {
      this.logger.error('Error processing message', {
        error,
        rabbitQueueId,
        messageContent: messageContent
          ? JSON.stringify(messageContent)
          : 'null',
      });

      try {
        channel.nack(msg, false, false);
      } catch (updateError) {
        this.logger.error('Error updating queue record or nacking message', {
          updateError,
          rabbitQueueId,
        });
      }
    }
  }

  async healthCheck(): Promise<{
    isConnected: boolean;
    channelReady: boolean;
  }> {
    const connection = this.rabbitmqConnection.connection;

    return {
      isConnected:
        !!connection && !connection.connection?.closed && this.isConnected,
      channelReady: !!this.channel,
    };
  }

  getConsumersInfo(): Array<{ queue: string; consumerTag: string }> {
    return Array.from(this.consumers.values()).map(
      ({ queue, consumerTag }) => ({
        queue,
        consumerTag,
      }),
    );
  }

  async onModuleDestroy() {
    this.logger.debug('Destroying RabbitMQ service');

    this.isShuttingDown = true;
    this.isConnected = false;
    this.isConnecting = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.channel) {
      for (const [queue, consumerInfo] of this.consumers) {
        if (!consumerInfo.consumerTag) {
          continue;
        }

        try {
          await this.channel.cancel(consumerInfo.consumerTag);
          this.logger.debug('Cancelled consumer', {
            queue,
            consumerTag: consumerInfo.consumerTag,
          });
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes('closed')) {
            this.logger.debug('Error cancelling consumer (ignored)', {
              queue,
            });
          }
        }
      }
    }

    this.consumers.clear();

    if (this.channel) {
      try {
        await this.channel.close();
        this.logger.debug('RabbitMQ channel closed');
      } catch (error) {
        if (
          !(error instanceof Error) ||
          (!error.message.includes('closed') &&
            !error.message.includes('Connection closed') &&
            !error.message.includes('IllegalOperationError'))
        ) {
          this.logger.debug('Error closing RabbitMQ channel (ignored)');
        }
      } finally {
        this.channel = undefined;
      }
    }

    await this.rabbitmqConnection.close();
    this.boundConnection = null;

    this.logger.debug('RabbitMQ service destroyed');
  }
}
