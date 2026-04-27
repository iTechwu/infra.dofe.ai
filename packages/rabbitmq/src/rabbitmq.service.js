"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitmqService = void 0;
const common_1 = require("@nestjs/common");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const rabbitmq_dto_1 = require("./dto/rabbitmq.dto");
const redis_1 = require("../../redis/src");
const prisma_1 = require("../../prisma/src/prisma");
const enviroment_util_1 = __importDefault(require("../../utils/dist/enviroment.util"));
let RabbitmqService = class RabbitmqService {
    rabbitmqConnection;
    redis;
    prisma;
    logger;
    channel;
    consumers = new Map();
    isConnected = false;
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    reconnectDelay = 5000; // 5 seconds
    reconnectTimer = null;
    constructor(rabbitmqConnection, redis, prisma, logger) {
        this.rabbitmqConnection = rabbitmqConnection;
        this.redis = redis;
        this.prisma = prisma;
        this.logger = logger;
    }
    async onModuleInit() {
        // 重置状态，确保清理旧的重连定时器
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.reconnectAttempts = 0;
        this.isConnected = false;
        this.channel = undefined;
        // 在 watch 模式下，连接可能在 onModuleDestroy 中被关闭
        // 等待连接自动恢复（amqplib 的 reconnect 机制）
        await this.waitForConnectionReady();
        await this.initializeConnection();
    }
    get connection() {
        return this.rabbitmqConnection;
    }
    /**
     * 等待连接就绪（用于 watch 模式下的连接恢复）
     */
    async waitForConnectionReady(maxWaitTime = 10000) {
        if (!this.rabbitmqConnection?.connection) {
            return;
        }
        const conn = this.rabbitmqConnection.connection;
        const startTime = Date.now();
        // 如果连接已关闭，等待自动重连
        while (conn.connection?.closed && Date.now() - startTime < maxWaitTime) {
            this.logger.debug('Waiting for RabbitMQ connection to recover...');
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
        // 如果等待超时，记录警告但不抛出错误（让后续逻辑处理）
        if (conn.connection?.closed) {
            this.logger.warn('RabbitMQ connection still closed after waiting, will attempt to reconnect');
        }
    }
    /**
     * 初始化连接和通道
     */
    async initializeConnection() {
        try {
            if (!this.rabbitmqConnection?.connection) {
                throw new Error('RabbitMQ connection is not available');
            }
            const conn = this.rabbitmqConnection.connection;
            // 检查连接状态
            if (conn.connection?.closed) {
                // 连接已关闭，等待自动重连或触发重连
                this.logger.warn('RabbitMQ connection is closed, will attempt to reconnect');
                // 不立即抛出错误，而是触发重连机制
                await this.scheduleReconnect();
                return;
            }
            // 设置连接事件监听（避免重复设置）
            this.setupConnectionEventListeners();
            // 创建通道
            await this.createChannel();
            this.isConnected = true;
            this.reconnectAttempts = 0;
            if (enviroment_util_1.default.isProduction()) {
                this.logger.info('RabbitMQ service initialized successfully');
            }
            else {
                this.logger.debug('RabbitMQ service initialized successfully');
            }
        }
        catch (error) {
            this.logger.error('Failed to initialize RabbitMQ service', {
                error,
            });
            await this.scheduleReconnect();
        }
    }
    /**
     * 设置连接事件监听器
     */
    setupConnectionEventListeners() {
        if (!this.rabbitmqConnection?.connection)
            return;
        const conn = this.rabbitmqConnection.connection;
        // 移除旧的监听器，避免重复绑定
        conn.removeAllListeners('error');
        conn.removeAllListeners('close');
        conn.on('error', (error) => {
            this.logger.error('RabbitMQ connection error', { error });
            this.isConnected = false;
            this.channel = undefined;
            // 只有在非关闭状态时才触发重连（避免在 onModuleDestroy 时触发）
            if (!conn.connection?.closed) {
                this.scheduleReconnect();
            }
        });
        conn.on('close', () => {
            this.logger.debug('RabbitMQ connection closed');
            this.isConnected = false;
            this.channel = undefined;
            // 只有在非关闭状态时才触发重连（避免在 onModuleDestroy 时触发）
            // 注意：amqplib 的 reconnect 机制会自动处理重连
        });
    }
    /**
     * 创建通道
     */
    async createChannel() {
        if (!this.rabbitmqConnection?.connection) {
            throw new Error('RabbitMQ connection is not available');
        }
        const conn = this.rabbitmqConnection.connection;
        // 检查连接是否已关闭
        if (conn.connection?.closed) {
            throw new Error('Cannot create channel: RabbitMQ connection is closed');
        }
        try {
            // 如果已有通道，先关闭它（防止重复创建）
            if (this.channel) {
                try {
                    await this.channel.close();
                }
                catch (error) {
                    // 忽略关闭错误
                }
                this.channel = undefined;
            }
            this.channel = await conn.createChannel();
            // 设置通道事件监听
            this.channel.on('error', (error) => {
                this.logger.error('RabbitMQ channel error', { error });
                this.channel = undefined;
            });
            this.channel.on('close', () => {
                if (enviroment_util_1.default.isProduction()) {
                    this.logger.warn('RabbitMQ channel closed');
                }
                this.channel = undefined;
            });
            // 设置预取数量
            await this.channel.prefetch(1);
            if (enviroment_util_1.default.isProduction()) {
                this.logger.info('RabbitMQ channel created successfully');
            }
        }
        catch (error) {
            this.logger.error('Failed to create RabbitMQ channel', { error });
            // 如果是连接关闭错误，清理状态
            if (error instanceof Error &&
                (error.message.includes('closed') ||
                    error.message.includes('Connection closed') ||
                    error.message.includes('IllegalOperationError'))) {
                this.channel = undefined;
                this.isConnected = false;
            }
            throw error;
        }
    }
    /**
     * 安排重连
     */
    async scheduleReconnect() {
        if (this.reconnectTimer ||
            this.reconnectAttempts >= this.maxReconnectAttempts) {
            return;
        }
        this.reconnectAttempts++;
        this.logger.info(`Scheduling RabbitMQ reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            await this.initializeConnection();
            // 重新建立所有消费者
            if (this.isConnected) {
                await this.reestablishConsumers();
            }
        }, this.reconnectDelay * this.reconnectAttempts);
    }
    /**
     * 重新建立所有消费者
     */
    async reestablishConsumers() {
        for (const [queue, consumerInfo] of this.consumers) {
            try {
                await this.consumeMessagesFromRabbitMQ(queue, consumerInfo.handler);
                this.logger.info(`Reestablished consumer for queue: ${queue}`);
            }
            catch (error) {
                this.logger.error(`Failed to reestablish consumer for queue: ${queue}`, { error });
            }
        }
    }
    /**
     * 确保通道可用
     */
    async ensureChannel() {
        // 检查连接状态
        if (!this.rabbitmqConnection?.connection ||
            this.rabbitmqConnection.connection.connection?.closed) {
            this.isConnected = false;
            this.channel = undefined;
            throw new Error('RabbitMQ connection is not available or closed');
        }
        // 如果通道不存在且连接正常，创建新通道
        if (!this.channel && this.isConnected) {
            await this.createChannel();
        }
        if (!this.channel) {
            throw new Error('RabbitMQ channel is not available');
        }
        return this.channel;
    }
    /**
     * 发送消息到RabbitMQ
     */
    async sendMessageToRabbitMQ(queue, message, bindKey) {
        try {
            if (!this.isConnected) {
                throw new Error('RabbitMQ connection is not established');
            }
            // 记录队列信息到数据库
            // const queueRabbit = await this.createQueueRecord(queue, message);
            const channel = await this.ensureChannel();
            // 声明队列
            await channel.assertQueue(queue, { durable: true });
            const messageWithMetadata = {
                ...message,
                queue,
                timestamp: new Date().toISOString(),
            };
            // 发布消息
            const result = channel.publish('', queue, Buffer.from(JSON.stringify(messageWithMetadata)), { persistent: true });
            if (!result) {
                throw new Error('Failed to publish message to queue');
            }
            this.logger.debug('Message sent to RabbitMQ', {
                queue,
            });
        }
        catch (error) {
            this.logger.error('Error sending message to RabbitMQ', {
                error,
                queue,
                message: typeof message === 'object' ? JSON.stringify(message) : message,
            });
            throw error;
        }
    }
    /**
     * 消费RabbitMQ消息
     */
    async consumeMessagesFromRabbitMQ(queue, handleMessage) {
        try {
            if (!this.isConnected) {
                this.logger.error('RabbitMQ connection not available for consuming', {
                    queue,
                });
                return;
            }
            // this.logger.info('Setting up consumer for queue', { queue });
            const channel = await this.ensureChannel();
            // 声明队列
            await channel.assertQueue(queue, { durable: true });
            // 消费消息
            const { consumerTag } = await channel.consume(queue, (msg) => this.handleIncomingMessage(msg, handleMessage, channel), { noAck: false });
            // 保存消费者信息
            this.consumers.set(queue, {
                queue,
                consumerTag,
                handler: handleMessage,
            });
            // this.logger.info('Consumer established for queue', {
            //     queue,
            //     consumerTag,
            // });
        }
        catch (error) {
            this.logger.error('Error setting up consumer', { error, queue });
            throw error;
        }
    }
    /**
     * 处理接收到的消息
     */
    async handleIncomingMessage(msg, handleMessage, channel) {
        if (!msg) {
            this.logger.warn('Received null message');
            return;
        }
        let messageContent = null;
        let rabbitQueueId;
        try {
            // 解析消息内容
            const messageString = msg.content.toString();
            messageContent = JSON.parse(messageString);
            rabbitQueueId = messageContent?.rabbitQueueId;
            if (!messageContent) {
                await channel.ack(msg);
                return;
            }
            // 处理消息
            await handleMessage(messageContent);
            // 确认消息
            await channel.ack(msg);
            this.logger.debug('Message processed successfully', {
                rabbitQueueId,
            });
        }
        catch (error) {
            this.logger.error('Error processing message', {
                error,
                rabbitQueueId,
                messageContent: messageContent
                    ? JSON.stringify(messageContent)
                    : 'null',
            });
            try {
                // 拒绝消息，不重新排队
                await channel.nack(msg, false, false);
            }
            catch (updateError) {
                this.logger.error('Error updating queue record or nacking message', {
                    updateError,
                    rabbitQueueId,
                });
            }
        }
    }
    /**
     * 检查连接健康状况
     */
    async healthCheck() {
        return {
            isConnected: this.isConnected && !!this.rabbitmqConnection?.connection,
            channelReady: !!this.channel,
        };
    }
    /**
     * 获取消费者信息
     */
    getConsumersInfo() {
        return Array.from(this.consumers.values()).map(({ queue, consumerTag }) => ({
            queue,
            consumerTag,
        }));
    }
    async onModuleDestroy() {
        this.logger.debug('Destroying RabbitMQ service');
        // 标记正在销毁，防止重连机制触发
        this.isConnected = false;
        // 清除重连定时器
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        // 取消所有消费者
        if (this.channel) {
            for (const [queue, consumerInfo] of this.consumers) {
                try {
                    await this.channel.cancel(consumerInfo.consumerTag);
                    this.logger.debug('Cancelled consumer', {
                        queue,
                        consumerTag: consumerInfo.consumerTag,
                    });
                }
                catch (error) {
                    // 忽略已关闭的通道错误
                    if (!(error instanceof Error) || !error.message.includes('closed')) {
                        this.logger.debug('Error cancelling consumer (ignored)', {
                            queue,
                        });
                    }
                }
            }
        }
        // 清空消费者映射
        this.consumers.clear();
        // 关闭通道（使用 try-catch 处理已关闭的通道）
        if (this.channel) {
            try {
                await this.channel.close();
                this.logger.debug('RabbitMQ channel closed');
            }
            catch (error) {
                // 忽略已关闭的连接/通道错误
                if (!(error instanceof Error) ||
                    (!error.message.includes('closed') &&
                        !error.message.includes('Connection closed') &&
                        !error.message.includes('IllegalOperationError'))) {
                    this.logger.debug('Error closing RabbitMQ channel (ignored)');
                }
            }
            finally {
                this.channel = undefined;
            }
        }
        // 注意：在 watch 模式下，我们不关闭连接本身
        // 因为 amqplib 的连接对象会在模块重新初始化时自动恢复
        // 只有在真正关闭应用时才关闭连接
        // 这里只清理通道和消费者，让连接保持以便快速恢复
        this.logger.debug('RabbitMQ service destroyed (connection kept for watch mode)');
    }
};
exports.RabbitmqService = RabbitmqService;
exports.RabbitmqService = RabbitmqService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(rabbitmq_dto_1.RABBITMQ_CONNECTION)),
    __param(3, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [Object, redis_1.RedisService,
        prisma_1.PrismaService,
        winston_1.Logger])
], RabbitmqService);
//# sourceMappingURL=rabbitmq.service.js.map