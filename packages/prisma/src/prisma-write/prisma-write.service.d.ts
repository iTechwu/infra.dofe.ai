import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Logger } from 'winston';
import type { PrismaClient } from '@prisma/client';
import { DbMetricsService } from '../db-metrics/src/db-metrics.service';
/**
 * Prisma Write Service
 * Prisma 写服务
 *
 * Provides write database access with:
 * - Query performance monitoring
 * - Slow query detection with configurable thresholds
 * - Prometheus metrics integration
 * - BigInt serialization support
 *
 * 提供写数据库访问，包含：
 * - 查询性能监控
 * - 可配置阈值的慢查询检测
 * - Prometheus 指标集成
 * - BigInt 序列化支持
 */
export declare class PrismaWriteService implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    private readonly dbMetrics?;
    private basePrisma;
    private extendedPrisma;
    private prisma;
    private pool;
    private initialized;
    constructor(logger: Logger, dbMetrics?: DbMetricsService);
    /**
     * Setup Prisma extensions for query monitoring and soft delete
     * Prisma 7.x: 使用 $extends 替代 $use
     * 设置 Prisma 扩展用于查询监控和软删除
     *
     * 注意：将软删除和监控合并到一个 $extends 调用中，避免双层扩展导致的模型委托丢失问题
     */
    private setupExtensions;
    /**
     * Fallback logging when DbMetricsService is not injected
     * 当 DbMetricsService 未注入时的回退日志记录
     */
    private fallbackLog;
    /**
     * Validate that Prisma client has all required model delegates
     * 验证 Prisma 客户端是否具有所有必需的模型委托
     */
    private validatePrismaClient;
    /**
     * Get the Prisma client instance
     * 获取 Prisma 客户端实例
     */
    get client(): PrismaClient;
    /**
     * Check if the Prisma client is ready
     * 检查 Prisma 客户端是否就绪
     */
    get isReady(): boolean;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
