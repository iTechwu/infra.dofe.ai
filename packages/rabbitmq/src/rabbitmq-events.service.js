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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitmqEventsService = void 0;
/**
 * RabbitMQ Events Service
 *
 * 使用独立的 RabbitMQ 连接发布事件
 * 不影响其他任务队列
 */
const common_1 = require("@nestjs/common");
const nest_winston_1 = require("nest-winston");
const rabbitmq_events_module_1 = require("./rabbitmq-events.module");
let RabbitmqEventsService = class RabbitmqEventsService {
    rabbitmqConnection;
    logger;
    channel = null;
    isInitialized = false;
    constructor(rabbitmqConnection, logger) {
        this.rabbitmqConnection = rabbitmqConnection;
        this.logger = logger;
        this.initializeChannel();
    }
    /**
     * 初始化 Channel
     */
    async initializeChannel() {
        if (this.isInitialized || !this.rabbitmqConnection.connection) {
            return;
        }
        try {
            this.channel = await this.rabbitmqConnection.connection.createChannel();
            this.isInitialized = true;
            this.logger.info('[Events] RabbitMQ Events channel initialized');
        }
        catch (error) {
            this.logger.error('[Events] Failed to initialize RabbitMQ Events channel', { error });
        }
    }
    /**
     * 确保 Channel 已初始化
     */
    async ensureChannel() {
        if (!this.channel && !this.isInitialized) {
            await this.initializeChannel();
        }
        return this.channel;
    }
    /**
     * 发送消息到 RabbitMQ 队列
     */
    async sendMessageToQueue(queue, message) {
        const channel = await this.ensureChannel();
        if (!channel) {
            this.logger.warn('[Events] RabbitMQ Events channel not available, message not sent', { queue });
            return false;
        }
        try {
            // 确保队列存在
            await channel.assertQueue(queue, {
                durable: true, // 队列持久化
            });
            // 发送消息
            const sent = channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
                persistent: true, // 消息持久化
                contentType: 'application/json',
            });
            if (sent) {
                this.logger.debug('[Events] Message sent to queue', {
                    queue,
                    messageType: typeof message,
                });
            }
            else {
                this.logger.warn('[Events] Failed to send message to queue', {
                    queue,
                });
            }
            return sent;
        }
        catch (error) {
            this.logger.error('[Events] Error sending message to queue', {
                error,
                queue,
            });
            return false;
        }
    }
    /**
     * 发布消息到 Exchange
     */
    async publishToExchange(exchange, routingKey, message, exchangeType = 'topic') {
        const channel = await this.ensureChannel();
        if (!channel) {
            this.logger.warn('[Events] RabbitMQ Events channel not available, message not published', { exchange, routingKey });
            return false;
        }
        try {
            // 确保 Exchange 存在
            await channel.assertExchange(exchange, exchangeType, {
                durable: true,
            });
            // 发布消息
            const published = channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)), {
                persistent: true,
                contentType: 'application/json',
            });
            if (published) {
                this.logger.debug('[Events] Message published to exchange', {
                    exchange,
                    routingKey,
                    messageType: typeof message,
                });
            }
            else {
                this.logger.warn('[Events] Failed to publish message to exchange', {
                    exchange,
                    routingKey,
                });
            }
            return published;
        }
        catch (error) {
            this.logger.error('[Events] Error publishing message to exchange', {
                error,
                exchange,
                routingKey,
            });
            return false;
        }
    }
    /**
     * 模块销毁时关闭连接
     */
    async onModuleDestroy() {
        try {
            if (this.channel) {
                await this.channel.close();
                this.logger.info('[Events] RabbitMQ Events channel closed');
            }
            await this.rabbitmqConnection.close();
            this.logger.info('[Events] RabbitMQ Events connection closed');
        }
        catch (error) {
            this.logger.error('[Events] Error closing RabbitMQ Events connection', {
                error,
            });
        }
    }
    /**
     * 获取连接状态
     */
    isConnected() {
        return this.isInitialized && this.channel !== null;
    }
};
exports.RabbitmqEventsService = RabbitmqEventsService;
exports.RabbitmqEventsService = RabbitmqEventsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(rabbitmq_events_module_1.RABBITMQ_EVENTS_CONNECTION)),
    __param(1, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [Object, Function])
], RabbitmqEventsService);
//# sourceMappingURL=rabbitmq-events.service.js.map