import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
import { Counter, Histogram, Gauge } from 'prom-client';
/**
 * Slow query threshold levels
 * 慢查询阈值级别
 */
export interface SlowQueryThresholds {
    /**
     * Queries >= info threshold will be logged at INFO level (ms)
     * 达到此阈值的查询将以 INFO 级别记录
     */
    info: number;
    /**
     * Queries >= warn threshold will be logged at WARN level (ms)
     * 达到此阈值的查询将以 WARN 级别记录
     */
    warn: number;
    /**
     * Queries >= error threshold will be logged at ERROR level (ms)
     * 达到此阈值的查询将以 ERROR 级别记录
     */
    error: number;
}
/**
 * Database metrics configuration
 * 数据库指标配置
 */
export interface DbMetricsConfig {
    /**
     * Enable or disable metrics collection
     * 启用或禁用指标收集
     */
    enabled: boolean;
    /**
     * Slow query thresholds
     * 慢查询阈值
     */
    slowQueryThresholds: SlowQueryThresholds;
    /**
     * Whether to log query parameters
     * 是否记录查询参数
     */
    logQueryParams: boolean;
    /**
     * Whether to log query results
     * 是否记录查询结果
     */
    logQueryResult: boolean;
    /**
     * Maximum length of parameters to log
     * 记录参数的最大长度
     */
    maxParamLogLength: number;
}
/**
 * Query context for tracking
 * 查询跟踪上下文
 */
export interface QueryContext {
    startTime: number;
    traceId: string;
}
/**
 * Query parameters for metrics
 * 查询指标参数
 */
export interface QueryParams {
    model: string;
    action: string;
    dbType: 'read' | 'write';
}
/**
 * Transaction context for tracking
 * 事务跟踪上下文
 */
export interface TransactionContext {
    startTime: number;
    traceId: string;
    sqlCount: number;
    tablesInvolved: Set<string>;
}
/**
 * Transaction metadata for logging
 * 事务日志元数据
 */
export interface TransactionMetadata {
    retryCount?: number;
    isolationLevel?: string;
    sqlCount?: number;
    tablesInvolved?: string[];
    lockWaitTime?: number;
    errorType?: string;
    errorMessage?: string;
    methodName?: string;
}
/**
 * Database Metrics Service
 * 数据库指标服务
 *
 * Provides unified metrics collection and logging for database operations.
 * 为数据库操作提供统一的指标收集和日志记录。
 */
export declare class DbMetricsService implements OnModuleInit {
    private readonly configService?;
    private readonly logger?;
    private readonly queryDuration?;
    private readonly queryTotal?;
    private readonly slowQueryTotal?;
    private readonly txDuration?;
    private readonly txTotal?;
    private readonly activeTx?;
    private config;
    constructor(configService?: ConfigService, logger?: Logger, queryDuration?: Histogram<string>, queryTotal?: Counter<string>, slowQueryTotal?: Counter<string>, txDuration?: Histogram<string>, txTotal?: Counter<string>, activeTx?: Gauge<string>);
    onModuleInit(): void;
    /**
     * Get current configuration
     * 获取当前配置
     */
    getConfig(): DbMetricsConfig;
    /**
     * Check if metrics collection is enabled
     * 检查指标收集是否启用
     */
    isEnabled(): boolean;
    /**
     * Start tracking a query
     * 开始跟踪查询
     */
    recordQueryStart(): QueryContext;
    /**
     * Record query completion
     * 记录查询完成
     */
    recordQueryEnd(ctx: QueryContext, params: QueryParams, status: 'success' | 'error', args?: unknown, error?: Error): void;
    /**
     * Determine the threshold level based on query duration
     * 根据查询时长确定阈值级别
     */
    private getThresholdLevel;
    /**
     * Log query information with appropriate level
     * 以适当的级别记录查询信息
     */
    private logQuery;
    /**
     * Start tracking a transaction
     * 开始跟踪事务
     */
    recordTransactionStart(): TransactionContext;
    /**
     * Increment SQL count in transaction context
     * 增加事务上下文中的 SQL 计数
     */
    incrementSqlCount(ctx: TransactionContext, model?: string): void;
    /**
     * Record transaction completion
     * 记录事务完成
     */
    recordTransactionEnd(ctx: TransactionContext, status: 'success' | 'error' | 'rollback', metadata?: TransactionMetadata): void;
    /**
     * Log transaction information
     * 记录事务信息
     */
    private logTransaction;
    /**
     * Get current trace ID from CLS namespace
     * 从 CLS 命名空间获取当前 traceId
     */
    private getTraceId;
    /**
     * Create a fallback context when metrics service is not available
     * 当指标服务不可用时创建回退上下文
     */
    static createFallbackQueryContext(): QueryContext;
    /**
     * Create a fallback transaction context
     * 创建回退事务上下文
     */
    static createFallbackTransactionContext(): TransactionContext;
}
