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
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
const redis_dto_1 = require("./dto/redis.dto");
const uuid_1 = require("uuid");
const config_1 = require("@nestjs/config");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const enviroment_util_1 = __importDefault(require("../../utils/dist/enviroment.util"));
let RedisService = class RedisService {
    configService;
    redisClient;
    logger;
    redisConfigs = {};
    // 日志节流：记录上次打印日志的时间，避免频繁输出相同错误
    lastClosedLogTime = 0;
    CLOSED_LOG_THROTTLE_MS = 5000; // 5秒内只打印一次连接关闭的日志
    constructor(configService, redisClient, logger) {
        this.configService = configService;
        this.redisClient = redisClient;
        this.logger = logger;
        const configs = this.configService.getOrThrow('redis');
        configs.forEach((config) => {
            this.redisConfigs[config.name] = config;
        });
    }
    /**
     * 检查 Redis 连接是否可用
     */
    isConnectionAvailable() {
        if (!this.redisClient) {
            return false;
        }
        const status = this.redisClient.status;
        return status === 'ready' || status === 'connect';
    }
    /**
     * 节流日志输出：避免在服务重启时大量打印相同错误
     */
    shouldLogClosedError() {
        const now = Date.now();
        if (now - this.lastClosedLogTime > this.CLOSED_LOG_THROTTLE_MS) {
            this.lastClosedLogTime = now;
            return true;
        }
        return false;
    }
    async onModuleDestroy() {
        if (this.redisClient) {
            try {
                // 检查连接状态，避免在已关闭的连接上调用 quit()
                if (this.redisClient.status !== 'end' &&
                    this.redisClient.status !== 'close') {
                    await this.redisClient.quit();
                }
            }
            catch (error) {
                // 忽略已关闭的连接错误
                if (!(error instanceof Error) || !error.message.includes('closed')) {
                    if (enviroment_util_1.default.isProduction()) {
                        this.logger.error('Error closing Redis connection', {
                            error,
                        });
                    }
                    else {
                        this.logger.debug('Error closing Redis connection', {
                            error,
                        });
                    }
                }
            }
        }
        if (enviroment_util_1.default.isProduction()) {
            this.logger.info('Redis service destroyed');
        }
        else {
            this.logger.debug('Redis service destroyed');
        }
    }
    get redis() {
        return this.redisClient;
    }
    getExpireIn(name) {
        return this.redisConfigs[name].expireIn ?? -1;
    }
    getRedisKey(name, key) {
        return this.redisConfigs[name].key + key;
    }
    async saveDataToList(name, key, value) {
        const redisKey = this.redisConfigs[name].key + key;
        if (!this.isConnectionAvailable()) {
            return;
        }
        try {
            await this.redis.rpush(redisKey, JSON.stringify(value));
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('closed')) {
                if (this.shouldLogClosedError()) {
                    if (enviroment_util_1.default.isProduction()) {
                        this.logger.warn('Redis connection closed, saveDataToList failed');
                    }
                    else {
                        this.logger.debug('Redis connection closed, saveDataToList failed', { error });
                    }
                }
            }
            else {
                if (enviroment_util_1.default.isProduction()) {
                    this.logger.error('Redis saveDataToList error:', { error });
                }
                else {
                    this.logger.debug('Redis saveDataToList error:', { error });
                }
            }
        }
    }
    async getListData(name, key) {
        const redisKey = this.redisConfigs[name].key + key;
        if (!this.isConnectionAvailable()) {
            return [];
        }
        try {
            const data = await this.redis.lrange(redisKey, 0, -1);
            return data.length > 0 ? data.map((item) => JSON.parse(item)) : [];
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('closed')) {
                if (this.shouldLogClosedError()) {
                    if (enviroment_util_1.default.isProduction()) {
                        this.logger.warn('Redis connection closed, getListData failed');
                    }
                    else {
                        this.logger.debug('Redis connection closed, getListData failed', {
                            error,
                        });
                    }
                }
            }
            else {
                if (enviroment_util_1.default.isProduction()) {
                    this.logger.error('Redis getListData error:', { error });
                }
                else {
                    this.logger.debug('Redis getListData error:', { error });
                }
            }
            return [];
        }
    }
    async pushDataToList(name, key, value, expireIn) {
        const redisKey = this.redisConfigs[name].key + key;
        expireIn = expireIn ?? this.redisConfigs[name].expireIn ?? -1;
        if (!this.isConnectionAvailable()) {
            return;
        }
        try {
            await this.redis.lpush(redisKey, JSON.stringify(value));
            if (expireIn > 0) {
                await this.expire(redisKey, expireIn);
            }
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('closed')) {
                if (this.shouldLogClosedError()) {
                    if (enviroment_util_1.default.isProduction()) {
                        this.logger.warn('Redis connection closed, pushDataToList failed');
                    }
                    else {
                        this.logger.debug('Redis connection closed, pushDataToList failed', { error });
                    }
                }
            }
            else {
                if (enviroment_util_1.default.isProduction()) {
                    this.logger.error('Redis pushDataToList error:', { error });
                }
                else {
                    this.logger.debug('Redis pushDataToList error:', { error });
                }
            }
        }
    }
    async pushDatasToList(name, key, values, expireIn) {
        const redisKey = this.redisConfigs[name].key + key;
        const stringifiedValues = values.map((v) => JSON.stringify(v));
        expireIn = expireIn ?? this.redisConfigs[name].expireIn ?? -1;
        if (!this.isConnectionAvailable()) {
            return;
        }
        try {
            await this.redis.lpush(redisKey, ...stringifiedValues);
            if (expireIn > 0) {
                await this.expire(redisKey, expireIn);
            }
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('closed')) {
                if (this.shouldLogClosedError()) {
                    if (enviroment_util_1.default.isProduction()) {
                        this.logger.warn('Redis connection closed, pushDatasToList failed');
                    }
                    else {
                        this.logger.debug('Redis connection closed, pushDatasToList failed', { error });
                    }
                }
            }
            else {
                if (enviroment_util_1.default.isProduction()) {
                    this.logger.error('Redis pushDatasToList error:', {
                        error,
                    });
                }
                else {
                    this.logger.debug('Redis pushDatasToList error:', {
                        error,
                    });
                }
            }
        }
    }
    async saveData(name, key, value, expireIn) {
        const redisKey = this.redisConfigs[name].key + key;
        expireIn = expireIn ?? this.redisConfigs[name].expireIn ?? -1;
        return await this.set(redisKey, value, { EX: expireIn });
    }
    async getData(name, key) {
        const redisKey = this.redisConfigs[name].key + key;
        return await this.get(redisKey);
    }
    async deleteData(name, key) {
        const redisKey = this.redisConfigs[name].key + key;
        return await this.del(redisKey);
    }
    async incrData(name, key) {
        const redisKey = this.redisConfigs[name].key + key;
        return await this.incr(redisKey);
    }
    async decrData(name, key) {
        const redisKey = this.redisConfigs[name].key + key;
        return await this.decr(redisKey);
    }
    async incrbyData(name, key, increment) {
        const redisKey = this.redisConfigs[name].key + key;
        return await this.incrby(redisKey, increment);
    }
    async decrbyData(name, key, decrement) {
        const redisKey = this.redisConfigs[name].key + key;
        return await this.decrby(redisKey, decrement);
    }
    async saveKeyFirstFileId(key, fileId) {
        return await this.saveData('fileSystemFildId', key, fileId);
    }
    async getKeyFirstFileId(key) {
        return await this.getData('fileSystemFildId', key);
    }
    async saveQiniuUploadAuthKey(key) {
        const traceID = (0, uuid_1.v4)();
        await this.saveData('fileSystemCallbackAuth', key, traceID);
        return traceID;
    }
    async checkQiniuUploadAuthKey(key, authToken) {
        const token = await this.getData('fileSystemCallbackAuth', key);
        if (token === authToken) {
            return true;
        }
        return false;
    }
    async setShortCode(key, value) {
        return await this.saveData('shortCode', key, value);
    }
    async getShortCode(key) {
        return await this.getData('shortCode', key);
    }
    async saveProviderOauthNonce(name, state, nonce, expiresIn) {
        const redisKey = 'dofe:oauth:' + name + ':nonce-' + state;
        await this.set(redisKey, nonce, { EX: expiresIn });
    }
    async getProviderOauthNonce(name, state) {
        const redisKey = 'dofe:oauth:' + name + ':nonce-' + state;
        return await this.get(redisKey);
    }
    async deleteProviderOauthNonce(name, state) {
        const redisKey = 'dofe:oauth:' + name + ':nonce-' + state;
        await this.del(redisKey);
    }
    async saveProviderState(provider, state, expiresIn) {
        const redisKey = 'dofe:oauth:' + provider + ':state';
        await this.set(redisKey, state, { EX: expiresIn });
    }
    async getProviderState(provider, state) {
        const redisKey = 'dofe:oauth:' + provider + ':state';
        return await this.get(redisKey);
    }
    async deleteProviderState(provider) {
        const redisKey = 'dofe:oauth:' + provider + ':state';
        await this.del(redisKey);
    }
    async set(key, value, options) {
        if (!this.redisClient || !this.isConnectionAvailable()) {
            return null;
        }
        try {
            const args = [
                key,
                typeof value === 'number' ? value.toString() : JSON.stringify(value),
            ];
            if (options?.EX && options.EX > 0) {
                return await this.redisClient.set(key, args[1], 'EX', options.EX.toString());
            }
            else {
                return await this.redisClient.set(key, args[1]);
            }
        }
        catch (error) {
            // Redis 连接关闭或其他错误
            if (error instanceof Error && error.message.includes('closed')) {
                if (this.shouldLogClosedError()) {
                    if (enviroment_util_1.default.isProduction()) {
                        this.logger.warn('Redis connection closed, set operation failed');
                    }
                    else {
                        this.logger.debug('Redis connection closed, set operation failed', {
                            error,
                        });
                    }
                }
            }
            else {
                if (enviroment_util_1.default.isProduction()) {
                    this.logger.error('Redis set error:', { error });
                }
                else {
                    this.logger.debug('Redis set error:', { error });
                }
            }
            return null;
        }
    }
    /**
     * Set key-value with NX (only if not exists) and EX (expiration) options
     * Returns 'OK' if the key was set, null if the key already exists or on error
     */
    async setNX(key, value, options) {
        if (!this.redisClient || !this.isConnectionAvailable()) {
            return null;
        }
        try {
            // Use set with NX and EX options for distributed lock pattern
            // ioredis 5.x TypeScript types have strict overloads
            // Cast to any to bypass the strict type checking for NX+EX combination
            const result = await this.redisClient.set(key, typeof value === 'number' ? value.toString() : JSON.stringify(value), 'NX', 'EX', options.EX);
            return result;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('closed')) {
                if (this.shouldLogClosedError()) {
                    if (enviroment_util_1.default.isProduction()) {
                        this.logger.warn('Redis connection closed, setNX operation failed');
                    }
                    else {
                        this.logger.debug('Redis connection closed, setNX operation failed', {
                            error,
                        });
                    }
                }
            }
            else {
                if (enviroment_util_1.default.isProduction()) {
                    this.logger.error('Redis setNX error:', { error });
                }
                else {
                    this.logger.debug('Redis setNX error:', { error });
                }
            }
            return null;
        }
    }
    async get(key) {
        if (!this.redisClient || !this.isConnectionAvailable()) {
            return null;
        }
        try {
            const value = await this.redisClient.get(key);
            if (value === null)
                return null;
            if (typeof value === 'number')
                return value;
            try {
                return JSON.parse(value);
            }
            catch (e) {
                return value;
            }
        }
        catch (error) {
            // Redis 连接关闭或其他错误
            if (error instanceof Error && error.message.includes('closed')) {
                if (this.shouldLogClosedError()) {
                    if (enviroment_util_1.default.isProduction()) {
                        this.logger.warn('Redis connection closed, returning null');
                    }
                    else {
                        this.logger.debug('Redis connection closed, returning null', {
                            error,
                        });
                    }
                }
            }
            else {
                if (enviroment_util_1.default.isProduction()) {
                    this.logger.error('Redis get error:', { error });
                }
                else {
                    this.logger.debug('Redis get error:', { error });
                }
            }
            return null;
        }
    }
    async del(key) {
        if (!this.redisClient || !this.isConnectionAvailable()) {
            return null;
        }
        try {
            return await this.redisClient.del(key);
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('closed')) {
                if (this.shouldLogClosedError()) {
                    if (enviroment_util_1.default.isProduction()) {
                        this.logger.warn('Redis connection closed, del operation failed');
                    }
                    else {
                        this.logger.debug('Redis connection closed, del operation failed', {
                            error,
                        });
                    }
                }
            }
            else {
                if (enviroment_util_1.default.isProduction()) {
                    this.logger.error('Redis del error:', { error });
                }
                else {
                    this.logger.debug('Redis del error:', { error });
                }
            }
            return null;
        }
    }
    async incr(key) {
        if (!this.redisClient || !this.isConnectionAvailable()) {
            return null;
        }
        try {
            return await this.redisClient.incr(key);
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('closed')) {
                if (this.shouldLogClosedError()) {
                    if (enviroment_util_1.default.isProduction()) {
                        this.logger.warn('Redis connection closed, incr operation failed');
                    }
                    else {
                        this.logger.debug('Redis connection closed, incr operation failed', { error });
                    }
                }
            }
            else {
                if (enviroment_util_1.default.isProduction()) {
                    this.logger.error('Redis incr error:', { error });
                }
                else {
                    this.logger.debug('Redis incr error:', { error });
                }
            }
            return null;
        }
    }
    async incrby(key, increment) {
        if (!this.redisClient || !this.isConnectionAvailable()) {
            return null;
        }
        try {
            return await this.redisClient.incrby(key, increment);
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('closed')) {
                if (this.shouldLogClosedError()) {
                    if (enviroment_util_1.default.isProduction()) {
                        this.logger.warn('Redis connection closed, incrby operation failed');
                    }
                    else {
                        this.logger.debug('Redis connection closed, incrby operation failed', { error });
                    }
                }
            }
            else {
                if (enviroment_util_1.default.isProduction()) {
                    this.logger.error('Redis incrby error:', { error });
                }
                else {
                    this.logger.debug('Redis incrby error:', { error });
                }
            }
            return null;
        }
    }
    async decr(key) {
        if (!this.redisClient || !this.isConnectionAvailable()) {
            return null;
        }
        try {
            return await this.redisClient.decr(key);
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('closed')) {
                if (this.shouldLogClosedError()) {
                    if (enviroment_util_1.default.isProduction()) {
                        this.logger.warn('Redis connection closed, decr operation failed');
                    }
                    else {
                        this.logger.debug('Redis connection closed, decr operation failed', { error });
                    }
                }
            }
            else {
                if (enviroment_util_1.default.isProduction()) {
                    this.logger.error('Redis decr error:', { error });
                }
                else {
                    this.logger.debug('Redis decr error:', { error });
                }
            }
            return null;
        }
    }
    async decrby(key, decrement) {
        if (!this.redisClient || !this.isConnectionAvailable()) {
            return null;
        }
        try {
            return await this.redisClient.decrby(key, decrement);
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('closed')) {
                if (this.shouldLogClosedError()) {
                    if (enviroment_util_1.default.isProduction()) {
                        this.logger.warn('Redis connection closed, decrby operation failed');
                    }
                    else {
                        this.logger.debug('Redis connection closed, decrby operation failed', { error });
                    }
                }
            }
            else {
                if (enviroment_util_1.default.isProduction()) {
                    this.logger.error('Redis decrby error:', { error });
                }
                else {
                    this.logger.debug('Redis decrby error:', { error });
                }
            }
            return null;
        }
    }
    async expire(key, seconds) {
        if (!this.redisClient || !this.isConnectionAvailable()) {
            return null;
        }
        try {
            return await this.redisClient.expire(key, seconds);
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('closed')) {
                if (this.shouldLogClosedError()) {
                    if (enviroment_util_1.default.isProduction()) {
                        this.logger.warn('Redis connection closed, expire operation failed');
                    }
                    else {
                        this.logger.debug('Redis connection closed, expire operation failed', { error });
                    }
                }
            }
            else {
                if (enviroment_util_1.default.isProduction()) {
                    this.logger.error('Redis expire error:', { error });
                }
                else {
                    this.logger.debug('Redis expire error:', { error });
                }
            }
            return null;
        }
    }
    async ttl(key) {
        if (!this.redisClient || !this.isConnectionAvailable()) {
            return null;
        }
        try {
            return await this.redisClient.ttl(key);
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('closed')) {
                if (this.shouldLogClosedError()) {
                    if (enviroment_util_1.default.isProduction()) {
                        this.logger.warn('Redis connection closed, ttl operation failed');
                    }
                    else {
                        this.logger.debug('Redis connection closed, ttl operation failed', {
                            error,
                        });
                    }
                }
            }
            else {
                if (enviroment_util_1.default.isProduction()) {
                    this.logger.error('Redis ttl error:', { error });
                }
                else {
                    this.logger.debug('Redis ttl error:', { error });
                }
            }
            return null;
        }
    }
    async exists(key) {
        if (!this.redisClient || !this.isConnectionAvailable()) {
            return null;
        }
        try {
            return await this.redisClient.exists(key);
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('closed')) {
                if (this.shouldLogClosedError()) {
                    if (enviroment_util_1.default.isProduction()) {
                        this.logger.warn('Redis connection closed, exists operation failed');
                    }
                    else {
                        this.logger.debug('Redis connection closed, exists operation failed', { error });
                    }
                }
            }
            else {
                if (enviroment_util_1.default.isProduction()) {
                    this.logger.error('Redis exists error:', { error });
                }
                else {
                    this.logger.debug('Redis exists error:', { error });
                }
            }
            return null;
        }
    }
    /**
     * 根据模式删除键
     * 使用 SCAN 命令迭代匹配键，避免阻塞 Redis
     * @param pattern Redis 键模式 (例如: 'user:*', 'cache:*')
     * @returns 删除的键数量，失败返回 0
     */
    async deleteByPattern(pattern) {
        if (!this.redisClient || !this.isConnectionAvailable()) {
            return 0;
        }
        try {
            let cursor = '0';
            let deletedCount = 0;
            const batchSize = 100; // 每批次处理的键数量
            do {
                // 使用 SCAN 迭代，避免使用 KEYS 命令阻塞 Redis
                const [newCursor, keys] = await this.redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize);
                cursor = newCursor;
                if (keys.length > 0) {
                    // 批量删除匹配的键
                    const deleted = await this.redisClient.del(...keys);
                    deletedCount += deleted;
                }
            } while (cursor !== '0');
            if (deletedCount > 0) {
                this.logger.info(`Deleted ${deletedCount} keys matching pattern: ${pattern}`);
            }
            return deletedCount;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('closed')) {
                if (this.shouldLogClosedError()) {
                    if (enviroment_util_1.default.isProduction()) {
                        this.logger.warn('Redis connection closed, deleteByPattern operation failed');
                    }
                    else {
                        this.logger.debug('Redis connection closed, deleteByPattern operation failed', { error });
                    }
                }
            }
            else {
                if (enviroment_util_1.default.isProduction()) {
                    this.logger.error('Redis deleteByPattern error:', {
                        error,
                        pattern,
                    });
                }
                else {
                    this.logger.debug('Redis deleteByPattern error:', {
                        error,
                        pattern,
                    });
                }
            }
            return 0;
        }
    }
    // ============================================================================
    // Pipeline Operations - 批量操作优化
    // ============================================================================
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
    async pipeline(commands) {
        if (!this.redisClient || !this.isConnectionAvailable()) {
            return [];
        }
        try {
            const pipeline = this.redisClient.pipeline();
            commands(pipeline);
            const results = await pipeline.exec();
            if (!results) {
                return [];
            }
            // ioredis returns [error, result] tuples
            return results.map(([error, result]) => {
                if (error) {
                    this.logger.error('Pipeline command error:', { error });
                    return null;
                }
                return result;
            });
        }
        catch (error) {
            if (enviroment_util_1.default.isProduction()) {
                this.logger.error('Redis pipeline error:', { error });
            }
            else {
                this.logger.debug('Redis pipeline error:', { error });
            }
            return [];
        }
    }
    /**
     * Pipeline batch save - save multiple key-value pairs with optional TTL
     * 批量保存多个键值对，支持可选的过期时间
     *
     * @param items - Array of { name, key, value, expireIn? } items
     */
    async pipelineSave(items) {
        if (!this.redisClient ||
            !this.isConnectionAvailable() ||
            items.length === 0) {
            return;
        }
        try {
            const pipeline = this.redisClient.pipeline();
            for (const item of items) {
                const redisKey = this.redisConfigs[item.name]?.key + item.key;
                const expireIn = item.expireIn ?? this.redisConfigs[item.name]?.expireIn ?? -1;
                const value = typeof item.value === 'number'
                    ? item.value.toString()
                    : JSON.stringify(item.value);
                if (expireIn > 0) {
                    pipeline.set(redisKey, value, 'EX', expireIn);
                }
                else {
                    pipeline.set(redisKey, value);
                }
            }
            await pipeline.exec();
        }
        catch (error) {
            if (enviroment_util_1.default.isProduction()) {
                this.logger.error('Redis pipelineSave error:', { error });
            }
            else {
                this.logger.debug('Redis pipelineSave error:', { error });
            }
        }
    }
    /**
     * Pipeline batch get - get multiple values by keys
     * 批量获取多个键的值
     *
     * @param items - Array of { name, key } items
     * @returns Map of key -> value
     */
    async pipelineGet(items) {
        const result = new Map();
        if (!this.redisClient ||
            !this.isConnectionAvailable() ||
            items.length === 0) {
            return result;
        }
        try {
            const pipeline = this.redisClient.pipeline();
            const keys = [];
            for (const item of items) {
                const redisKey = this.redisConfigs[item.name]?.key + item.key;
                keys.push(`${item.name}:${item.key}`);
                pipeline.get(redisKey);
            }
            const results = await pipeline.exec();
            if (!results) {
                return result;
            }
            results.forEach(([error, value], index) => {
                if (error) {
                    this.logger.debug(`Pipeline get error for key ${keys[index]}:`, {
                        error,
                    });
                    return;
                }
                if (value === null)
                    return;
                try {
                    result.set(keys[index], JSON.parse(value));
                }
                catch {
                    result.set(keys[index], value);
                }
            });
            return result;
        }
        catch (error) {
            if (enviroment_util_1.default.isProduction()) {
                this.logger.error('Redis pipelineGet error:', { error });
            }
            else {
                this.logger.debug('Redis pipelineGet error:', { error });
            }
            return result;
        }
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(redis_dto_1.REDIS_AUTH)),
    __param(2, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        ioredis_1.Redis,
        winston_1.Logger])
], RedisService);
//# sourceMappingURL=redis.service.js.map