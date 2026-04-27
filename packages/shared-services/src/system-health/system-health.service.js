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
exports.SystemHealthService = void 0;
const common_1 = require("@nestjs/common");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const redis_1 = require("../../../redis/src");
const rabbitmq_1 = require("../../../rabbitmq/src");
// eslint-disable-next-line import/no-restricted-paths -- 健康检查服务需要直接访问 Prisma 检查数据库连接状态
const prisma_1 = require("../../../prisma/src/prisma");
let SystemHealthService = class SystemHealthService {
    redis;
    rabbitmq;
    prisma;
    logger;
    constructor(redis, rabbitmq, prisma, logger) {
        this.redis = redis;
        this.rabbitmq = rabbitmq;
        this.prisma = prisma;
        this.logger = logger;
    }
    async checkDiskSpace() {
        const { exec } = require('child_process');
        return new Promise((resolve, reject) => {
            exec('df -h | grep /dev/sda1', (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    return reject(false);
                }
                const regex = /(\d+)%/;
                const matches = stdout.match(regex);
                if (matches && matches.length > 1) {
                    const usage = parseInt(matches[1], 10);
                    resolve(usage < 90); // Assuming less than 90% usage is acceptable
                }
                else {
                    reject(false);
                }
            });
        });
    }
    async checkDatabaseConnection() {
        try {
            // eslint-disable-next-line no-restricted-syntax -- 健康检查需要直接检查数据库连接状态
            if (!this.prisma.write) {
                return false;
            }
            return true;
        }
        catch (e) {
            return false;
        }
    }
    async checkRabbitMQConnection() {
        try {
            if (!this.rabbitmq.connection) {
                return false;
            }
            return true;
        }
        catch (error) {
            return false;
        }
    }
    async checkRedisConnection() {
        try {
            const result = await this.redis.redis.ping();
            return result === 'PONG';
        }
        catch (error) {
            return false;
        }
    }
};
exports.SystemHealthService = SystemHealthService;
exports.SystemHealthService = SystemHealthService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [redis_1.RedisService,
        rabbitmq_1.RabbitmqService,
        prisma_1.PrismaService,
        winston_1.Logger])
], SystemHealthService);
//# sourceMappingURL=system-health.service.js.map