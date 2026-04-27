import { Logger } from 'winston';
import { RedisService } from "../../../redis/src";
import { RabbitmqService } from "../../../rabbitmq/src";
import { PrismaService } from "../../../prisma/src/prisma";
export declare class SystemHealthService {
    private readonly redis;
    private readonly rabbitmq;
    private readonly prisma;
    private readonly logger;
    constructor(redis: RedisService, rabbitmq: RabbitmqService, prisma: PrismaService, logger: Logger);
    checkDiskSpace(): Promise<boolean>;
    checkDatabaseConnection(): Promise<boolean>;
    checkRabbitMQConnection(): Promise<boolean>;
    checkRedisConnection(): Promise<boolean>;
}
