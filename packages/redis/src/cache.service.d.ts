import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Logger } from 'winston';
export declare class CacheService implements OnModuleDestroy {
    private readonly configService;
    private readonly logger;
    private readonly redis;
    constructor(configService: ConfigService, logger: Logger);
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any, ttl?: number): Promise<void>;
    delete(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    getByPattern(pattern: string): Promise<string[]>;
    getClient(): Redis;
    onModuleDestroy(): void;
}
