import { OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
export declare class RedisService implements OnModuleDestroy {
    private readonly configService;
    private readonly redisClient;
    private readonly logger;
    private redisConfigs;
    private lastClosedLogTime;
    private readonly CLOSED_LOG_THROTTLE_MS;
    constructor(configService: ConfigService, redisClient: Redis, logger: Logger);
    /**
     * 检查 Redis 连接是否可用
     */
    private isConnectionAvailable;
    /**
     * 节流日志输出：避免在服务重启时大量打印相同错误
     */
    private shouldLogClosedError;
    onModuleDestroy(): Promise<void>;
    get redis(): Redis;
    getExpireIn(name: string): any;
    getRedisKey(name: string, key: string): string;
    saveDataToList(name: string, key: string, value: any): Promise<void>;
    getListData(name: string, key: string): Promise<any[]>;
    pushDataToList(name: string, key: string, value: any, expireIn?: number): Promise<void>;
    pushDatasToList(name: string, key: string, values: any[], expireIn?: number): Promise<void>;
    saveData(name: string, key: string, value: any, expireIn?: number): Promise<"OK">;
    getData(name: string, key: string): Promise<any>;
    deleteData(name: string, key: string): Promise<number>;
    incrData(name: string, key: string): Promise<number>;
    decrData(name: string, key: string): Promise<number>;
    incrbyData(name: string, key: string, increment: number): Promise<number>;
    decrbyData(name: string, key: string, decrement: number): Promise<number>;
    saveKeyFirstFileId(key: string, fileId: string): Promise<any>;
    getKeyFirstFileId(key: string): Promise<any>;
    saveQiniuUploadAuthKey(key: string): Promise<string>;
    checkQiniuUploadAuthKey(key: string, authToken: string): Promise<boolean>;
    setShortCode(key: string, value: any): Promise<"OK">;
    getShortCode(key: string): Promise<any>;
    saveProviderOauthNonce(name: string, state: string, nonce: any, expiresIn: number): Promise<void>;
    getProviderOauthNonce(name: string, state: string): Promise<any>;
    deleteProviderOauthNonce(name: string, state: string): Promise<void>;
    saveProviderState(provider: string, state: string, expiresIn: number): Promise<void>;
    getProviderState(provider: string, state: string): Promise<any>;
    deleteProviderState(provider: string): Promise<void>;
    set(key: string, value: any, options?: {
        EX: number;
    }): Promise<"OK">;
    /**
     * Set key-value with NX (only if not exists) and EX (expiration) options
     * Returns 'OK' if the key was set, null if the key already exists or on error
     */
    setNX(key: string, value: any, options: {
        EX: number;
    }): Promise<string | null>;
    get(key: string): Promise<any>;
    del(key: string): Promise<number>;
    incr(key: string): Promise<number>;
    incrby(key: string, increment: number): Promise<number>;
    decr(key: string): Promise<number>;
    decrby(key: string, decrement: number): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    ttl(key: string): Promise<number>;
    exists(key: string): Promise<number>;
    /**
     * 根据模式删除键
     * 使用 SCAN 命令迭代匹配键，避免阻塞 Redis
     * @param pattern Redis 键模式 (例如: 'user:*', 'cache:*')
     * @returns 删除的键数量，失败返回 0
     */
    deleteByPattern(pattern: string): Promise<number>;
    /**
     * Execute multiple Redis operations in a pipeline
     * 在管道中执行多个 Redis 操作，减少网络往返
     *
     * @param commands - Array of command functions to execute in pipeline
     * @returns Array of results from each command
     *
     * @example
     * ```typescript
     * const results = await redisService.pipeline([
     *   (pipeline) => pipeline.set('key1', 'value1'),
     *   (pipeline) => pipeline.set('key2', 'value2'),
     *   (pipeline) => pipeline.get('key3'),
     * ]);
     * ```
     */
    pipeline(commands: (pipeline: ReturnType<typeof this.redisClient.pipeline>) => void[]): Promise<unknown[]>;
    /**
     * Pipeline batch save - save multiple key-value pairs with optional TTL
     * 批量保存多个键值对，支持可选的过期时间
     *
     * @param items - Array of { name, key, value, expireIn? } items
     */
    pipelineSave(items: Array<{
        name: string;
        key: string;
        value: unknown;
        expireIn?: number;
    }>): Promise<void>;
    /**
     * Pipeline batch get - get multiple values by keys
     * 批量获取多个键的值
     *
     * @param items - Array of { name, key } items
     * @returns Map of key -> value
     */
    pipelineGet(items: Array<{
        name: string;
        key: string;
    }>): Promise<Map<string, unknown>>;
}
