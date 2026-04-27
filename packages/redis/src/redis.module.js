"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisModule = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
const redis_dto_1 = require("./dto/redis.dto");
const redis_service_1 = require("./redis.service");
const cache_service_1 = require("./cache.service");
const config_1 = require("@nestjs/config");
const errors_1 = require("@repo/contracts/errors");
const api_exception_1 = require("../../common/src/filter/exception/api.exception");
const enviroment_util_1 = __importDefault(require("../../utils/dist/enviroment.util"));
let RedisModule = class RedisModule {
};
exports.RedisModule = RedisModule;
exports.RedisModule = RedisModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        providers: [
            {
                provide: redis_dto_1.REDIS_AUTH,
                useFactory: async () => {
                    const redisUrl = process.env.REDIS_URL;
                    // console.log( "TECHWU" , redisUrl )
                    if (!redisUrl) {
                        throw (0, api_exception_1.apiError)(errors_1.CommonErrorCode.InvalidRedis);
                    }
                    try {
                        const client = new ioredis_1.default(redisUrl, {
                            retryStrategy(times) {
                                if (times > 10) {
                                    console.error('Redis连接失败', 'Redis reconnect exhausted after 10 retries.');
                                    return null;
                                }
                                return Math.min(times * 150, 3000);
                            },
                        });
                        client.on('connect', () => {
                            if (enviroment_util_1.default.isProduction()) {
                                console.log('Redis client connected');
                            }
                        });
                        client.on('error', (error) => {
                            if (enviroment_util_1.default.isProduction()) {
                                console.error('Error connecting to Redis', error);
                            }
                            else {
                                console.debug('Error connecting to Redis', error);
                            }
                            // throw new ApiException('invalidRedis');
                        });
                        return client;
                    }
                    catch (e) {
                        console.error('Redis error', e);
                        // throw new ApiException('invalidRedis');
                        return null;
                    }
                },
            },
            redis_service_1.RedisService,
            cache_service_1.CacheService,
        ],
        exports: [redis_dto_1.REDIS_AUTH, redis_service_1.RedisService, cache_service_1.CacheService],
        // 导出 Redis 客户端和服务
    })
], RedisModule);
//# sourceMappingURL=redis.module.js.map