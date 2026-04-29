import { Injectable, Inject, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Logger } from 'winston';
import { Counter, Histogram, Gauge } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { isProduction, consoleLogger, LoggerLike } from '../utils';

/**
 * Slow query threshold levels
 */
export interface SlowQueryThresholds {
  info: number;
  warn: number;
  error: number;
}

/**
 * Database metrics configuration
 */
export interface DbMetricsConfig {
  enabled: boolean;
  slowQueryThresholds: SlowQueryThresholds;
  logQueryParams: boolean;
  logQueryResult: boolean;
  maxParamLogLength: number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: DbMetricsConfig = {
  enabled: true,
  slowQueryThresholds: {
    info: 100,
    warn: 500,
    error: 1000,
  },
  logQueryParams: true,
  logQueryResult: false,
  maxParamLogLength: 1000,
};

/**
 * Query context for tracking
 */
export interface QueryContext {
  startTime: number;
  traceId: string;
}

/**
 * Query parameters for metrics
 */
export interface QueryParams {
  model: string;
  action: string;
  dbType: 'read' | 'write';
}

/**
 * Transaction context for tracking
 */
export interface TransactionContext {
  startTime: number;
  traceId: string;
  sqlCount: number;
  tablesInvolved: Set<string>;
}

/**
 * Transaction metadata for logging
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
 */
@Injectable()
export class DbMetricsService implements OnModuleInit {
  private config: DbMetricsConfig = DEFAULT_CONFIG;
  private readonly logger: LoggerLike;

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional() @Inject('WINSTON_LOGGER') winstonLogger?: Logger,
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
  ) {
    this.logger = winstonLogger ?? consoleLogger;
  }

  onModuleInit() {
    const config = this.configService?.get<DbMetricsConfig>('dbMetrics');
    if (config) {
      this.config = { ...DEFAULT_CONFIG, ...config };
    }
    if (isProduction()) {
      this.logger.info('DbMetricsService module initialized', { config: this.config });
    } else {
      this.logger.debug('DbMetricsService module initialized', { config: this.config });
    }
  }

  getConfig(): DbMetricsConfig {
    return this.config;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  recordQueryStart(): QueryContext {
    return {
      startTime: Date.now(),
      traceId: this.getTraceId(),
    };
  }

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

    this.queryDuration?.observe({ model, action, db_type: dbType, status }, durationSec);
    this.queryTotal?.inc({ model, action, db_type: dbType, status });

    const thresholdLevel = this.getThresholdLevel(duration);
    if (thresholdLevel) {
      this.slowQueryTotal?.inc({
        model,
        action,
        db_type: dbType,
        threshold_level: thresholdLevel,
      });
    }

    this.logQuery(ctx.traceId, duration, params, status, args, error, thresholdLevel);
  }

  private getThresholdLevel(duration: number): 'info' | 'warn' | 'error' | null {
    const { slowQueryThresholds } = this.config;
    if (duration >= slowQueryThresholds.error) return 'error';
    if (duration >= slowQueryThresholds.warn) return 'warn';
    if (duration >= slowQueryThresholds.info) return 'info';
    return null;
  }

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

    if (thresholdLevel === 'error') {
      this.logger.error('Slow Query [CRITICAL]', logData);
    } else if (thresholdLevel === 'warn') {
      this.logger.warn('Slow Query [WARNING]', logData);
    } else if (thresholdLevel === 'info') {
      this.logger.info('Slow Query [INFO]', logData);
    } else if (status === 'error') {
      this.logger.error('Query Error', logData);
    } else {
      this.logger.debug('Query Executed', logData);
    }
  }

  recordTransactionStart(): TransactionContext {
    this.activeTx?.inc();
    return {
      startTime: Date.now(),
      traceId: this.getTraceId(),
      sqlCount: 0,
      tablesInvolved: new Set<string>(),
    };
  }

  incrementSqlCount(ctx: TransactionContext, model?: string): void {
    ctx.sqlCount++;
    if (model) {
      ctx.tablesInvolved.add(model);
    }
  }

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

    const fullMetadata: TransactionMetadata = {
      ...metadata,
      sqlCount: ctx.sqlCount,
      tablesInvolved: Array.from(ctx.tablesInvolved),
    };

    this.logTransaction(ctx.traceId, duration, status, fullMetadata);
  }

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
      this.logger.error('Transaction Failed', logData);
    } else if (duration > this.config.slowQueryThresholds.warn) {
      this.logger.warn('Slow Transaction', logData);
    } else {
      this.logger.info('Transaction Completed', logData);
    }
  }

  private getTraceId(): string {
    return 'unknown';
  }

  static createFallbackQueryContext(): QueryContext {
    return {
      startTime: Date.now(),
      traceId: 'unknown',
    };
  }

  static createFallbackTransactionContext(): TransactionContext {
    return {
      startTime: Date.now(),
      traceId: 'unknown',
      sqlCount: 0,
      tablesInvolved: new Set<string>(),
    };
  }
}