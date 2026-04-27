/**
 * RabbitMQ Events Service
 *
 * 使用独立的 RabbitMQ 连接发布事件
 * 不影响其他任务队列
 */
import { OnModuleDestroy } from '@nestjs/common';
import type { Logger } from 'winston';
import { type RabbitmqEventsConnection } from './rabbitmq-events.module';
export declare class RabbitmqEventsService implements OnModuleDestroy {
    private readonly rabbitmqConnection;
    private readonly logger;
    private channel;
    private isInitialized;
    constructor(rabbitmqConnection: RabbitmqEventsConnection, logger: Logger);
    /**
     * 初始化 Channel
     */
    private initializeChannel;
    /**
     * 确保 Channel 已初始化
     */
    private ensureChannel;
    /**
     * 发送消息到 RabbitMQ 队列
     */
    sendMessageToQueue<T = any>(queue: string, message: T): Promise<boolean>;
    /**
     * 发布消息到 Exchange
     */
    publishToExchange<T = any>(exchange: string, routingKey: string, message: T, exchangeType?: 'direct' | 'topic' | 'fanout' | 'headers'): Promise<boolean>;
    /**
     * 模块销毁时关闭连接
     */
    onModuleDestroy(): Promise<void>;
    /**
     * 获取连接状态
     */
    isConnected(): boolean;
}
