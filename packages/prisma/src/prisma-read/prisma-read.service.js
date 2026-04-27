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
exports.PrismaReadService = void 0;
const common_1 = require("@nestjs/common");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const bigint_util_1 = __importDefault(require("../../../utils/dist/bigint.util"));
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const db_metrics_service_1 = require("../db-metrics/src/db-metrics.service");
const soft_delete_middleware_1 = require("../middleware/soft-delete.middleware");
const enviroment_util_1 = __importDefault(require("../../../utils/dist/enviroment.util"));
// Re-import PrismaClient from generated location at runtime
// The tsconfig alias @prisma/client -> generated/prisma-client works for types
// but at runtime we need to explicitly require from the generated location
// Use process.cwd() to resolve from the project root (apps/api/)
const { PrismaClient: PrismaClientRuntime } = require(`${process.cwd()}/generated/prisma-client`);
/**
 * Prisma Read Service
 * Prisma 读服务
 *
 * Provides read-only database access with:
 * - Query performance monitoring
 * - Slow query detection with configurable thresholds
 * - Prometheus metrics integration
 * - BigInt serialization support
 *
 * 提供只读数据库访问，包含：
 * - 查询性能监控
 * - 可配置阈值的慢查询检测
 * - Prometheus 指标集成
 * - BigInt 序列化支持
 */
let PrismaReadService = class PrismaReadService {
    logger;
    dbMetrics;
    basePrisma;
    extendedPrisma = null;
    prisma;
    pool;
    initialized = false;
    constructor(logger, dbMetrics) {
        this.logger = logger;
        this.dbMetrics = dbMetrics;
        // Prisma 7.x: 使用 @prisma/adapter-pg 驱动适配器
        // 对于读写分离，优先使用 READ_DATABASE_URL
        const connectionString = process.env.READ_DATABASE_URL || process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL or READ_DATABASE_URL environment variable is not set');
        }
        // 创建 pg 连接池
        this.pool = new pg_1.Pool({
            connectionString,
            // 连接池配置，与 Prisma 6 保持一致
            connectionTimeoutMillis: 5000,
            idleTimeoutMillis: 300000, // 5分钟
            max: 10, // 最大连接数
        });
        // 创建 Prisma 适配器 - 直接传入 Pool 实例
        const adapter = new adapter_pg_1.PrismaPg(this.pool);
        // 使用适配器创建 PrismaClient
        // Use runtime PrismaClient from generated location
        this.basePrisma = new PrismaClientRuntime({ adapter });
        // Prisma 7.3 + @prisma/adapter-pg: $extends 在连接前可能丢失模型委托
        // 先使用 base 客户端，在 onModuleInit 中再尝试扩展
        this.prisma = this.basePrisma;
        this.logger.info('[PrismaReadService] Prisma client created (base client, will extend after connect)');
    }
    /**
     * Setup Prisma extensions for query monitoring and soft delete
     * Prisma 7.x: 使用 $extends 替代 $use
     * 设置 Prisma 扩展用于查询监控和软删除
     *
     * 注意：将软删除和监控合并到一个 $extends 调用中，避免双层扩展导致的模型委托丢失问题
     */
    setupExtensions(basePrisma) {
        // 保存引用以便在回调中使用
        const dbMetrics = this.dbMetrics;
        const fallbackLog = this.fallbackLog.bind(this);
        // 合并软删除和监控扩展为一个 $extends 调用
        return basePrisma.$extends({
            query: {
                $allOperations({ operation, model, args, query }) {
                    // 1. 处理软删除逻辑
                    let processedArgs = args;
                    if ((0, soft_delete_middleware_1.isSoftDeleteModel)(model) && soft_delete_middleware_1.QUERY_ACTIONS.includes(operation)) {
                        const newArgs = { ...args };
                        if (!newArgs.where) {
                            newArgs.where = {};
                        }
                        // 只有在未显式指定 isDeleted 时才自动添加
                        if (!(0, soft_delete_middleware_1.hasExplicitIsDeleted)(newArgs.where)) {
                            newArgs.where = {
                                ...newArgs.where,
                                isDeleted: false,
                            };
                        }
                        processedArgs = newArgs;
                    }
                    // 2. 执行查询并监控性能
                    // Start tracking
                    const ctx = dbMetrics?.recordQueryStart() ?? {
                        startTime: Date.now(),
                        traceId: 'unknown',
                    };
                    // 执行查询并处理结果
                    const result = query(processedArgs);
                    // 处理 Promise 结果
                    if (result instanceof Promise) {
                        return result
                            .then((res) => {
                            const serialized = bigint_util_1.default.serialize(res);
                            if (dbMetrics) {
                                dbMetrics.recordQueryEnd(ctx, {
                                    model: model || 'unknown',
                                    action: operation,
                                    dbType: 'read',
                                }, 'success', processedArgs);
                            }
                            else {
                                fallbackLog(ctx.startTime, { model, action: operation, args: processedArgs }, 'success');
                            }
                            return serialized;
                        })
                            .catch((error) => {
                            // Record error
                            if (dbMetrics) {
                                dbMetrics.recordQueryEnd(ctx, {
                                    model: model || 'unknown',
                                    action: operation,
                                    dbType: 'read',
                                }, 'error', processedArgs, error);
                            }
                            else {
                                fallbackLog(ctx.startTime, { model, action: operation, args: processedArgs }, 'error', error);
                            }
                            throw error;
                        });
                    }
                    // 同步结果处理
                    try {
                        const serialized = bigint_util_1.default.serialize(result);
                        if (dbMetrics) {
                            dbMetrics.recordQueryEnd(ctx, {
                                model: model || 'unknown',
                                action: operation,
                                dbType: 'read',
                            }, 'success', processedArgs);
                        }
                        else {
                            fallbackLog(ctx.startTime, { model, action: operation, args: processedArgs }, 'success');
                        }
                        return serialized;
                    }
                    catch (error) {
                        if (dbMetrics) {
                            dbMetrics.recordQueryEnd(ctx, {
                                model: model || 'unknown',
                                action: operation,
                                dbType: 'read',
                            }, 'error', processedArgs, error);
                        }
                        else {
                            fallbackLog(ctx.startTime, { model, action: operation, args: processedArgs }, 'error', error);
                        }
                        throw error;
                    }
                },
            },
        });
    }
    /**
     * Fallback logging when DbMetricsService is not injected
     * 当 DbMetricsService 未注入时的回退日志记录
     */
    fallbackLog(startTime, params, status, error) {
        const duration = Date.now() - startTime;
        const logData = {
            message: 'ReadDB Query 执行信息',
            detail: {
                耗时: `${duration}ms`,
                时间: new Date().toISOString(),
                操作: `${params.model}.${params.action}`,
                参数: JSON.stringify(params.args),
                状态: status,
            },
        };
        if (status === 'error' && error) {
            this.logger.error({
                ...logData,
                error: { name: error.name, message: error.message },
            });
        }
        else if (duration > 1000) {
            this.logger.warn({
                message: 'ReadDB Query 性能警告',
                detail: {
                    操作: `${params.model}.${params.action}`,
                    耗时: `${duration}ms`,
                    提示: '此操作的执行时间超过了1000ms，请考虑优化',
                },
            });
        }
        else {
            this.logger.info(logData);
        }
    }
    /**
     * Validate that Prisma client has all required model delegates
     * 验证 Prisma 客户端是否具有所有必需的模型委托
     */
    validatePrismaClient(client, clientType) {
        if (!client) {
            this.logger.warn(`[PrismaReadService] ${clientType} client is null/undefined`);
            return false;
        }
        const prisma = client;
        // 检查关键模型是否存在
        const criticalModels = [
            'gatewayModelCatalog',
            'providerKey',
            'gatewayUser',
            'userInfo',
        ];
        const missingModels = [];
        for (const model of criticalModels) {
            const modelDelegate = prisma[model];
            if (!modelDelegate) {
                missingModels.push(model);
                continue;
            }
            // 检查关键方法是否存在
            const delegate = modelDelegate;
            if (typeof delegate.findMany !== 'function') {
                missingModels.push(`${model}.findMany`);
            }
        }
        if (missingModels.length > 0) {
            this.logger.warn(`[PrismaReadService] ${clientType} client missing models/methods: ${missingModels.join(', ')}`);
            return false;
        }
        return true;
    }
    /**
     * Get the Prisma client instance
     * 获取 Prisma 客户端实例
     */
    get client() {
        // 如果已初始化且有扩展客户端，优先使用扩展客户端
        // 否则返回 base 客户端
        return this.extendedPrisma || this.prisma;
    }
    /**
     * Check if the Prisma client is ready
     * 检查 Prisma 客户端是否就绪
     */
    get isReady() {
        return this.initialized;
    }
    async onModuleInit() {
        // 先连接数据库
        await this.basePrisma.$connect();
        this.logger.info('[PrismaReadService] Database connected');
        // 连接后再尝试扩展
        // Prisma 7.3: 在 $connect 后模型委托才可用
        try {
            const extended = this.setupExtensions(this.basePrisma);
            // 验证扩展客户端
            if (this.validatePrismaClient(extended, 'extended')) {
                this.extendedPrisma = extended;
                this.prisma = extended;
                this.logger.info('[PrismaReadService] Using extended Prisma client with all models');
            }
            else {
                // 扩展失败，检查 base 客户端是否有效
                if (this.validatePrismaClient(this.basePrisma, 'base')) {
                    this.prisma = this.basePrisma;
                    this.logger.warn('[PrismaReadService] Extended client missing models, using base client');
                }
                else {
                    this.logger.error('[PrismaReadService] Both clients missing models after connect!');
                    this.prisma = this.basePrisma;
                }
            }
        }
        catch (error) {
            this.logger.error('[PrismaReadService] Failed to setup extensions', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            this.prisma = this.basePrisma;
        }
        this.initialized = true;
        if (enviroment_util_1.default.isProduction()) {
            this.logger.info('PrismaReadService initialized');
        }
    }
    async onModuleDestroy() {
        try {
            await this.prisma.$disconnect();
        }
        catch (error) {
            this.logger.warn('Error disconnecting Prisma client', { error });
        }
        // 检查 pool 是否已经关闭，避免重复调用 end()
        if (this.pool && !this.pool.ended) {
            try {
                await this.pool.end();
            }
            catch (error) {
                this.logger.warn('Error closing database pool', { error });
            }
        }
        if (enviroment_util_1.default.isProduction()) {
            this.logger.info('PrismaReadService disconnected from database');
        }
    }
};
exports.PrismaReadService = PrismaReadService;
exports.PrismaReadService = PrismaReadService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [winston_1.Logger,
        db_metrics_service_1.DbMetricsService])
], PrismaReadService);
//# sourceMappingURL=prisma-read.service.js.map