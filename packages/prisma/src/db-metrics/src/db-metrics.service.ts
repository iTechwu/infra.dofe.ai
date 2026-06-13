import { Injectable, Inject, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Counter, Histogram, Gauge } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { asyncLocalStorage } from '@dofe/infra-common';
import enviroment from '@dofe/infra-utils/environment.util';

interface RequestDbOperationStats {
  model: string;
  action: string;
  dbType: 'read' | 'write';
  count: number;
  totalDurationMs: number;
  maxDurationMs: number;
  slowCount: number;
  errorCount: number;
}

interface RequestDbSummary {
  totalQueries: number;
  totalDurationMs: number;
  maxDurationMs: number;
  slowQueryCount: number;
  errorCount: number;
  operations: Map<string, RequestDbOperationStats>;
}

/**
 * Slow query threshold levels
 * 慢查询阈值级别
 */
export interface SlowQueryThresholds {
  /**
   * Queries >= info threshold are treated as slow query info events (ms)
   * 达到此阈值的查询将记录为慢查询信息事件
   */
  info: number;

  /**
   * Queries >= warn threshold are treated as slow query warning events (ms)
   * 达到此阈值的查询将记录为慢查询告警事件
   */
  warn: number;

  /**
   * Queries >= critical threshold are treated as critical slow query events (ms)
   * 达到此阈值的查询将记录为严重慢查询事件
   */
  critical: number;

  /**
   * @deprecated Use critical instead. Kept for backward compatibility with old YAML.
   * @deprecated 请使用 critical。保留该字段用于兼容旧 YAML。
   */
  error?: number;
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
 * Default configuration values
 * 默认配置值
 */
const DEFAULT_CONFIG: DbMetricsConfig = {
  enabled: true,
  slowQueryThresholds: {
    info: 100,
    warn: 500,
    critical: 1000,
  },
  logQueryParams: true,
  logQueryResult: false,
  maxParamLogLength: 1000,
};

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
@Injectable()
export class DbMetricsService implements OnModuleInit {
  private config: DbMetricsConfig = DEFAULT_CONFIG;

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional()
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger?: Logger,
    @Optional()
    @InjectMetric('prisma_query_duration_seconds')
    private readonly queryDuration?: Histogram<string>,
    @Optional()
    @InjectMetric('prisma_query_total')
    private readonly queryTotal?: Counter<string>,
    @Optional()
    @InjectMetric('prisma_slow_query_total')
    private readonly slowQueryTotal?: Counter<string>,
    @Optional()
    @InjectMetric('prisma_transaction_duration_seconds')
    private readonly txDuration?: Histogram<string>,
    @Optional()
    @InjectMetric('prisma_transaction_total')
    private readonly txTotal?: Counter<string>,
    @Optional()
    @InjectMetric('prisma_active_transactions')
    private readonly activeTx?: Gauge<string>,
  ) {}

  onModuleInit() {
    const config = this.configService?.get<DbMetricsConfig>('dbMetrics');
    if (config) {
      this.config = this.normalizeConfig(config);
    }
    if (enviroment.isProduction()) {
      this.logger?.info('DbMetricsService module initialized', {
        config: this.config,
      });
    } else {
      this.logger?.debug('DbMetricsService module initialized', {
        config: this.config,
      });
    }
  }

  /**
   * Get current configuration
   * 获取当前配置
   */
  getConfig(): DbMetricsConfig {
    return this.config;
  }

  /**
   * Check if metrics collection is enabled
   * 检查指标收集是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  // =========================================================================
  // Query Metrics Methods
  // 查询指标方法
  // =========================================================================

  /**
   * Start tracking a query
   * 开始跟踪查询
   */
  recordQueryStart(): QueryContext {
    return {
      startTime: Date.now(),
      traceId: this.getTraceId(),
    };
  }

  /**
   * Record query completion
   * 记录查询完成
   */
  recordQueryEnd(
    ctx: QueryContext,
    params: QueryParams,
    status: 'success' | 'error',
    args?: unknown,
    error?: Error,
  ): void {
    if (!this.config.enabled) return;

    const duration = Date.now() - ctx.startTime;
    const durationSec = duration / 1000;
    const { model, action, dbType } = params;

    // Record Prometheus metrics
    this.queryDuration?.observe(
      { model, action, db_type: dbType, status },
      durationSec,
    );
    this.queryTotal?.inc({ model, action, db_type: dbType, status });

    // Determine threshold level and log appropriately
    const thresholdLevel = this.getThresholdLevel(duration);
    if (thresholdLevel) {
      this.slowQueryTotal?.inc({
        model,
        action,
        db_type: dbType,
        threshold_level: thresholdLevel,
      });
    }

    this.recordRequestDbOperation(
      { model, action, dbType },
      duration,
      status,
      thresholdLevel !== null,
    );

    // Log query information
    this.logQuery(
      ctx.traceId,
      duration,
      params,
      status,
      args,
      error,
      thresholdLevel,
    );
  }

  /**
   * Determine the threshold level based on query duration
   * 根据查询时长确定阈值级别
   */
  private getThresholdLevel(
    duration: number,
  ): 'info' | 'warn' | 'critical' | null {
    const { slowQueryThresholds } = this.config;
    if (duration >= slowQueryThresholds.critical) return 'critical';
    if (duration >= slowQueryThresholds.warn) return 'warn';
    if (duration >= slowQueryThresholds.info) return 'info';
    return null;
  }

  /**
   * Log query information with appropriate level
   * 以适当的级别记录查询信息
   */
  private logQuery(
    traceId: string,
    duration: number,
    params: QueryParams,
    status: string,
    args?: unknown,
    error?: Error,
    thresholdLevel?: string | null,
  ): void {
    const logData: Record<string, unknown> = {
      category: 'db',
      traceId,
      duration: `${duration}ms`,
      model: params.model,
      action: params.action,
      dbType: params.dbType,
      status,
      timestamp: new Date().toISOString(),
    };

    if (this.config.logQueryParams && args) {
      const argsStr = JSON.stringify(args);
      logData.params =
        argsStr.length > this.config.maxParamLogLength
          ? argsStr.substring(0, this.config.maxParamLogLength) + '...'
          : argsStr;
    }

    if (error) {
      logData.error = { name: error.name, message: error.message };
    }

    if (status === 'error') {
      this.logger?.error('Query Error', {
        ...logData,
        event: 'query-error',
        slowQueryLevel: thresholdLevel ?? undefined,
      });
      return;
    }

    if (thresholdLevel === 'critical') {
      this.logger?.warn('Slow Query [CRITICAL]', {
        ...logData,
        event: 'slow-query',
        slowQueryLevel: thresholdLevel,
      });
    } else if (thresholdLevel === 'warn') {
      this.logger?.warn('Slow Query [WARNING]', {
        ...logData,
        event: 'slow-query',
        slowQueryLevel: thresholdLevel,
      });
    } else if (thresholdLevel === 'info') {
      this.logger?.info('Slow Query [INFO]', {
        ...logData,
        event: 'slow-query',
        slowQueryLevel: thresholdLevel,
      });
    } else {
      this.logger?.debug('Query Executed', {
        ...logData,
        event: 'query',
      });
    }
  }

  // =========================================================================
  // Transaction Metrics Methods
  // 事务指标方法
  // =========================================================================

  /**
   * Start tracking a transaction
   * 开始跟踪事务
   */
  recordTransactionStart(): TransactionContext {
    this.activeTx?.inc();
    return {
      startTime: Date.now(),
      traceId: this.getTraceId(),
      sqlCount: 0,
      tablesInvolved: new Set<string>(),
    };
  }

  /**
   * Increment SQL count in transaction context
   * 增加事务上下文中的 SQL 计数
   */
  incrementSqlCount(ctx: TransactionContext, model?: string): void {
    ctx.sqlCount++;
    if (model) {
      ctx.tablesInvolved.add(model);
    }
  }

  /**
   * Record transaction completion
   * 记录事务完成
   */
  recordTransactionEnd(
    ctx: TransactionContext,
    status: 'success' | 'error' | 'rollback',
    metadata: TransactionMetadata = {},
  ): void {
    if (!this.config.enabled) return;

    this.activeTx?.dec();
    const duration = Date.now() - ctx.startTime;
    const durationSec = duration / 1000;

    const labels = {
      status,
      retry_count: String(metadata.retryCount || 0),
      isolation_level: metadata.isolationLevel || 'default',
    };

    this.txDuration?.observe(labels, durationSec);
    this.txTotal?.inc(labels);

    // Merge context data with metadata
    const fullMetadata: TransactionMetadata = {
      ...metadata,
      sqlCount: ctx.sqlCount,
      tablesInvolved: Array.from(ctx.tablesInvolved),
    };

    this.logTransaction(ctx.traceId, duration, status, fullMetadata);
  }

  /**
   * Log transaction information
   * 记录事务信息
   */
  private logTransaction(
    traceId: string,
    duration: number,
    status: string,
    metadata: TransactionMetadata,
  ): void {
    const logData = {
      traceId,
      duration: `${duration}ms`,
      status,
      ...metadata,
      timestamp: new Date().toISOString(),
    };

    if (status === 'error' || status === 'rollback') {
      this.logger?.error('Transaction Failed', logData);
    } else if (duration > this.config.slowQueryThresholds.warn) {
      this.logger?.warn('Slow Transaction', logData);
    } else {
      this.logger?.info('Transaction Completed', logData);
    }
  }

  // =========================================================================
  // Utility Methods
  // 工具方法
  // =========================================================================

  /**
   * Get current trace ID from async local storage
   */
  private getTraceId(): string {
    try {
      return asyncLocalStorage.getStore()?.traceID || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Record query stats into the current request async context when available.
   * 可用时将查询统计写入当前请求 async context。
   */
  private recordRequestDbOperation(
    params: QueryParams,
    durationMs: number,
    status: 'success' | 'error',
    isSlowQuery: boolean,
  ): void {
    const store = asyncLocalStorage.getStore() as
      | { dbSummary?: RequestDbSummary }
      | undefined;
    if (!store) return;

    const summary =
      store.dbSummary ??
      ({
        totalQueries: 0,
        totalDurationMs: 0,
        maxDurationMs: 0,
        slowQueryCount: 0,
        errorCount: 0,
        operations: new Map<string, RequestDbOperationStats>(),
      } satisfies RequestDbSummary);
    store.dbSummary = summary;

    const key = `${params.dbType}.${params.model}.${params.action}`;
    const operation = summary.operations.get(key) ?? {
      model: params.model,
      action: params.action,
      dbType: params.dbType,
      count: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      slowCount: 0,
      errorCount: 0,
    };

    operation.count += 1;
    operation.totalDurationMs += durationMs;
    operation.maxDurationMs = Math.max(operation.maxDurationMs, durationMs);
    if (isSlowQuery) operation.slowCount += 1;
    if (status === 'error') operation.errorCount += 1;

    summary.totalQueries += 1;
    summary.totalDurationMs += durationMs;
    summary.maxDurationMs = Math.max(summary.maxDurationMs, durationMs);
    if (isSlowQuery) summary.slowQueryCount += 1;
    if (status === 'error') summary.errorCount += 1;
    summary.operations.set(key, operation);
  }

  /**
   * Normalize DB metrics config and support legacy slowQueryThresholds.error.
   * 规范化 DB metrics 配置，并兼容旧的 slowQueryThresholds.error。
   */
  private normalizeConfig(config: DbMetricsConfig): DbMetricsConfig {
    const mergedThresholds = {
      ...DEFAULT_CONFIG.slowQueryThresholds,
      ...config.slowQueryThresholds,
    };

    if (
      config.slowQueryThresholds?.critical === undefined &&
      config.slowQueryThresholds?.error !== undefined
    ) {
      mergedThresholds.critical = config.slowQueryThresholds.error;
    }

    return {
      ...DEFAULT_CONFIG,
      ...config,
      slowQueryThresholds: mergedThresholds,
    };
  }

  /**
   * Create a fallback context when metrics service is not available
   * 当指标服务不可用时创建回退上下文
   */
  static createFallbackQueryContext(): QueryContext {
    return {
      startTime: Date.now(),
      traceId: 'unknown',
    };
  }

  /**
   * Create a fallback transaction context
   * 创建回退事务上下文
   */
  static createFallbackTransactionContext(): TransactionContext {
    return {
      startTime: Date.now(),
      traceId: 'unknown',
      sqlCount: 0,
      tablesInvolved: new Set<string>(),
    };
  }
}
