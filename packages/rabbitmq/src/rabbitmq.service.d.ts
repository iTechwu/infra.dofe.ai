import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Logger } from 'winston';
import { RabbitmqConnection } from './dto/rabbitmq.dto';
import { RedisService } from "../../redis/src";
import { PrismaService } from "../../prisma/src/prisma";
interface MessageHandler {
    (message: any): Promise<void>;
}
export declare class RabbitmqService implements OnModuleInit, OnModuleDestroy {
    private readonly rabbitmqConnection;
    private readonly redis;
    private readonly prisma;
    private readonly logger;
    private channel;
    private consumers;
    private isConnected;
    private reconnectAttempts;
    private readonly maxReconnectAttempts;
    private readonly reconnectDelay;
    private reconnectTimer;
    constructor(rabbitmqConnection: RabbitmqConnection, redis: RedisService, prisma: PrismaService, logger: Logger);
    onModuleInit(): Promise<void>;
    get connection(): RabbitmqConnection;
    /**
     * 等待连接就绪（用于 watch 模式下的连接恢复）
     */
    private waitForConnectionReady;
    /**
     * 初始化连接和通道
     */
    private initializeConnection;
    /**
     * 设置连接事件监听器
     */
    private setupConnectionEventListeners;
    /**
     * 创建通道
     */
    private createChannel;
    /**
     * 安排重连
     */
    private scheduleReconnect;
    /**
     * 重新建立所有消费者
     */
    private reestablishConsumers;
    /**
     * 确保通道可用
     */
    private ensureChannel;
    /**
     * 发送消息到RabbitMQ
     */
    sendMessageToRabbitMQ(queue: string, message: any, bindKey?: string): Promise<void>;
    /**
     * 消费RabbitMQ消息
     */
    consumeMessagesFromRabbitMQ(queue: string, handleMessage: MessageHandler): Promise<void>;
    /**
     * 处理接收到的消息
     */
    private handleIncomingMessage;
    /**
     * 检查连接健康状况
     */
    healthCheck(): Promise<{
        isConnected: boolean;
        channelReady: boolean;
    }>;
    /**
     * 获取消费者信息
     */
    getConsumersInfo(): Array<{
        queue: string;
        consumerTag: string;
    }>;
    onModuleDestroy(): Promise<void>;
}
export {};
