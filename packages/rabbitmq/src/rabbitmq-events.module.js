"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitmqEventsModule = exports.RABBITMQ_EVENTS_CONNECTION = void 0;
/**
 * RabbitMQ Events Module
 *
 * 独立的 RabbitMQ 连接用于事件驱动系统
 * 使用独立的 vhost: nestjs_to_agentx_events
 * 不影响其他任务队列
 */
const common_1 = require("@nestjs/common");
const Rabbitmq = __importStar(require("amqplib"));
const config_1 = require("@nestjs/config");
const enviroment_util_1 = __importDefault(require("../../utils/dist/enviroment.util"));
const rabbitmq_events_service_1 = require("./rabbitmq-events.service");
// 独立的连接令牌
exports.RABBITMQ_EVENTS_CONNECTION = 'RABBITMQ_EVENTS_CONNECTION';
let RabbitmqEventsModule = class RabbitmqEventsModule {
};
exports.RabbitmqEventsModule = RabbitmqEventsModule;
exports.RabbitmqEventsModule = RabbitmqEventsModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        providers: [
            rabbitmq_events_service_1.RabbitmqEventsService,
            {
                provide: exports.RABBITMQ_EVENTS_CONNECTION,
                useFactory: async () => {
                    const maxRetries = 5;
                    const retryDelay = 3000; // 3 seconds
                    let lastError = null;
                    // 使用独立的 RabbitMQ 连接 URL (独立 vhost)
                    const rabbitmqEventsUrl = process.env.RABBITMQ_EVENTS_URL;
                    for (let attempt = 1; attempt <= maxRetries; attempt++) {
                        try {
                            console.log(`[Events] Attempting to connect to RabbitMQ Events (attempt ${attempt}/${maxRetries})`);
                            const connection = await Rabbitmq.connect(rabbitmqEventsUrl, {
                                heartbeat: 60,
                                reconnect: true,
                                reconnectBackoffStrategy: 'linear',
                                reconnectBackoffTime: 1000,
                            });
                            if (enviroment_util_1.default.isProduction()) {
                                console.log('✅ [Events] RabbitMQ Events connection established successfully');
                            }
                            else {
                                console.log(`✅ [Events] RabbitMQ Events connection established: ${rabbitmqEventsUrl}`);
                            }
                            // 设置连接错误监听
                            connection.on('error', (error) => {
                                console.error('[Events] RabbitMQ Events connection error:', error);
                            });
                            connection.on('close', () => {
                                console.warn('⚠️  [Events] RabbitMQ Events connection closed');
                            });
                            return {
                                connection,
                                close: async () => {
                                    try {
                                        await connection.close();
                                        console.log('✅ [Events] RabbitMQ Events connection closed gracefully');
                                    }
                                    catch (error) {
                                        // 忽略已关闭的连接错误
                                        if (!(error instanceof Error) ||
                                            (!error.message.includes('closed') &&
                                                !error.message.includes('Connection closed') &&
                                                !error.message.includes('IllegalOperationError'))) {
                                            console.error('❌ [Events] Error closing RabbitMQ Events connection:', error);
                                        }
                                    }
                                },
                            };
                        }
                        catch (error) {
                            lastError = error;
                            console.error(`[Events] RabbitMQ Events connection attempt ${attempt}/${maxRetries} failed:`, error);
                            if (attempt < maxRetries) {
                                console.log(`[Events] Retrying in ${retryDelay}ms...`);
                                await new Promise((resolve) => setTimeout(resolve, retryDelay));
                            }
                        }
                    }
                    console.error('[Events] Failed to establish RabbitMQ Events connection after all retries');
                    // 如果连接失败,返回一个 fallback 对象而不是抛出错误
                    // 这样系统可以继续运行,只是事件功能不可用
                    console.warn('⚠️  [Events] RabbitMQ Events service is unavailable, events will not be published');
                    return {
                        connection: null,
                        close: async () => {
                            console.log('[Events] No RabbitMQ Events connection to close');
                        },
                    };
                },
            },
        ],
        exports: [exports.RABBITMQ_EVENTS_CONNECTION, rabbitmq_events_service_1.RabbitmqEventsService],
    })
], RabbitmqEventsModule);
//# sourceMappingURL=rabbitmq-events.module.js.map