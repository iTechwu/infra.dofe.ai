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
exports.RabbitmqModule = void 0;
const common_1 = require("@nestjs/common");
const Rabbitmq = __importStar(require("amqplib"));
const rabbitmq_dto_1 = require("./dto/rabbitmq.dto");
const rabbitmq_service_1 = require("./rabbitmq.service");
const prisma_1 = require("../../prisma/src/prisma");
const redis_1 = require("../../redis/src");
const config_1 = require("@nestjs/config");
const enviroment_util_1 = __importDefault(require("../../utils/dist/enviroment.util"));
let RabbitmqModule = class RabbitmqModule {
};
exports.RabbitmqModule = RabbitmqModule;
exports.RabbitmqModule = RabbitmqModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_1.PrismaModule, redis_1.RedisModule, config_1.ConfigModule],
        providers: [
            {
                provide: rabbitmq_dto_1.RABBITMQ_CONNECTION,
                useFactory: async () => {
                    const maxRetries = 5;
                    const retryDelay = 3000; // 3 seconds
                    let lastError = null;
                    for (let attempt = 1; attempt <= maxRetries; attempt++) {
                        try {
                            console.log(`Attempting to connect to RabbitMQ (attempt ${attempt}/${maxRetries}): ${process.env.RABBITMQ_URL}`);
                            const connection = await Rabbitmq.connect(process.env.RABBITMQ_URL, {
                                heartbeat: 60,
                                reconnect: true,
                                reconnectBackoffStrategy: 'linear',
                                reconnectBackoffTime: 1000,
                            });
                            if (enviroment_util_1.default.isProduction()) {
                                console.log('RabbitMQ connection established successfully');
                            }
                            // 设置连接错误监听
                            connection.on('error', (error) => {
                                console.error('RabbitMQ connection error:', error);
                            });
                            connection.on('close', () => {
                                if (enviroment_util_1.default.isProduction()) {
                                    console.warn('❌ RabbitMQ connection closed');
                                }
                            });
                            return {
                                connection,
                                close: async () => {
                                    try {
                                        await connection.close();
                                        if (enviroment_util_1.default.isProduction()) {
                                            console.log('✅ RabbitMQ connection closed gracefully');
                                        }
                                    }
                                    catch (error) {
                                        // 忽略已关闭的连接错误
                                        if (!(error instanceof Error) ||
                                            (!error.message.includes('closed') &&
                                                !error.message.includes('Connection closed') &&
                                                !error.message.includes('IllegalOperationError'))) {
                                            console.error('❌ Error closing RabbitMQ connection:', error);
                                        }
                                    }
                                },
                            };
                        }
                        catch (error) {
                            lastError = error;
                            console.error(`RabbitMQ connection attempt ${attempt}/${maxRetries} failed:`, error);
                            if (attempt < maxRetries) {
                                console.log(`Retrying in ${retryDelay}ms...`);
                                await new Promise((resolve) => setTimeout(resolve, retryDelay));
                            }
                        }
                    }
                    console.error('Failed to establish RabbitMQ connection after all retries');
                    throw new Error(`Failed to connect to RabbitMQ after ${maxRetries} attempts. Last error: ${lastError?.message}`);
                },
            },
            rabbitmq_service_1.RabbitmqService,
        ],
        exports: [rabbitmq_dto_1.RABBITMQ_CONNECTION, rabbitmq_service_1.RabbitmqService],
    })
], RabbitmqModule);
//# sourceMappingURL=rabbitmq.module.js.map