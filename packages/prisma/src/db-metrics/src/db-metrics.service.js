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
exports.DbMetricsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const prom_client_1 = require("prom-client");
const nestjs_prometheus_1 = require("@willsoto/nestjs-prometheus");
const request_middleware_1 = require("../../../../common/src/middleware/request.middleware");
const enviroment_util_1 = __importDefault(require("../../../../utils/dist/enviroment.util"));
/**
 * Default configuration values
 * 默认配置值
 */
const DEFAULT_CONFIG = {
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
 * Database Metrics Service
 * 数据库指标服务
 *
 * Provides unified metrics collection and logging for database operations.
 * 为数据库操作提供统一的指标收集和日志记录。
 */
let DbMetricsService = class DbMetricsService {
    configService;
    logger;
    queryDuration;
    queryTotal;
    slowQueryTotal;
    txDuration;
    txTotal;
    activeTx;
    config = DEFAULT_CONFIG;
    constructor(configService, logger, queryDuration, queryTotal, slowQueryTotal, txDuration, txTotal, activeTx) {
        this.configService = configService;
        this.logger = logger;
        this.queryDuration = queryDuration;
        this.queryTotal = queryTotal;
        this.slowQueryTotal = slowQueryTotal;
        this.txDuration = txDuration;
        this.txTotal = txTotal;
        this.activeTx = activeTx;
    }
    onModuleInit() {
        const config = this.configService?.get('dbMetrics');
        if (config) {
            this.config = { ...DEFAULT_CONFIG, ...config };
        }
        if (enviroment_util_1.default.isProduction()) {
            this.logger.info('DbMetricsService module initialized', {
                config: this.config,
            });
        }
        else {
            this.logger.debug('DbMetricsService module initialized', {
                config: this.config,
            });
        }
    }
    /**
     * Get current configuration
     * 获取当前配置
     */
    getConfig() {
        return this.config;
    }
    /**
     * Check if metrics collection is enabled
     * 检查指标收集是否启用
     */
    isEnabled() {
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
    recordQueryStart() {
        return {
            startTime: Date.now(),
            traceId: this.getTraceId(),
        };
    }
    /**
     * Record query completion
     * 记录查询完成
     */
    recordQueryEnd(ctx, params, status, args, error) {
        if (!this.config.enabled)
            return;
        const duration = Date.now() - ctx.startTime;
        const durationSec = duration / 1000;
        const { model, action, dbType } = params;
        // Record Prometheus metrics
        this.queryDuration?.observe({ model, action, db_type: dbType, status }, durationSec);
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
        // Log query information
        this.logQuery(ctx.traceId, duration, params, status, args, error, thresholdLevel);
    }
    /**
     * Determine the threshold level based on query duration
     * 根据查询时长确定阈值级别
     */
    getThresholdLevel(duration) {
        const { slowQueryThresholds } = this.config;
        if (duration >= slowQueryThresholds.error)
            return 'error';
        if (duration >= slowQueryThresholds.warn)
            return 'warn';
        if (duration >= slowQueryThresholds.info)
            return 'info';
        return null;
    }
    /**
     * Log query information with appropriate level
     * 以适当的级别记录查询信息
     */
    logQuery(traceId, duration, params, status, args, error, thresholdLevel) {
        const logData = {
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
        // Log based on threshold level
        if (thresholdLevel === 'error') {
            this.logger?.error('Slow Query [CRITICAL]', logData);
        }
        else if (thresholdLevel === 'warn') {
            this.logger?.warn('Slow Query [WARNING]', logData);
        }
        else if (thresholdLevel === 'info') {
            this.logger?.info('Slow Query [INFO]', logData);
        }
        else if (status === 'error') {
            this.logger?.error('Query Error', logData);
        }
        else {
            this.logger?.debug('Query Executed', logData);
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
    recordTransactionStart() {
        this.activeTx?.inc();
        return {
            startTime: Date.now(),
            traceId: this.getTraceId(),
            sqlCount: 0,
            tablesInvolved: new Set(),
        };
    }
    /**
     * Increment SQL count in transaction context
     * 增加事务上下文中的 SQL 计数
     */
    incrementSqlCount(ctx, model) {
        ctx.sqlCount++;
        if (model) {
            ctx.tablesInvolved.add(model);
        }
    }
    /**
     * Record transaction completion
     * 记录事务完成
     */
    recordTransactionEnd(ctx, status, metadata = {}) {
        if (!this.config.enabled)
            return;
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
        const fullMetadata = {
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
    logTransaction(traceId, duration, status, metadata) {
        const logData = {
            traceId,
            duration: `${duration}ms`,
            status,
            ...metadata,
            timestamp: new Date().toISOString(),
        };
        if (status === 'error' || status === 'rollback') {
            this.logger?.error('Transaction Failed', logData);
        }
        else if (duration > this.config.slowQueryThresholds.warn) {
            this.logger?.warn('Slow Transaction', logData);
        }
        else {
            this.logger?.info('Transaction Completed', logData);
        }
    }
    // =========================================================================
    // Utility Methods
    // 工具方法
    // =========================================================================
    /**
     * Get current trace ID from CLS namespace
     * 从 CLS 命名空间获取当前 traceId
     */
    getTraceId() {
        try {
            return request_middleware_1.clsNamespace?.get('traceID') || 'unknown';
        }
        catch {
            return 'unknown';
        }
    }
    /**
     * Create a fallback context when metrics service is not available
     * 当指标服务不可用时创建回退上下文
     */
    static createFallbackQueryContext() {
        return {
            startTime: Date.now(),
            traceId: 'unknown',
        };
    }
    /**
     * Create a fallback transaction context
     * 创建回退事务上下文
     */
    static createFallbackTransactionContext() {
        return {
            startTime: Date.now(),
            traceId: 'unknown',
            sqlCount: 0,
            tablesInvolved: new Set(),
        };
    }
};
exports.DbMetricsService = DbMetricsService;
exports.DbMetricsService = DbMetricsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, nestjs_prometheus_1.InjectMetric)('prisma_query_duration_seconds')),
    __param(3, (0, common_1.Optional)()),
    __param(3, (0, nestjs_prometheus_1.InjectMetric)('prisma_query_total')),
    __param(4, (0, common_1.Optional)()),
    __param(4, (0, nestjs_prometheus_1.InjectMetric)('prisma_slow_query_total')),
    __param(5, (0, common_1.Optional)()),
    __param(5, (0, nestjs_prometheus_1.InjectMetric)('prisma_transaction_duration_seconds')),
    __param(6, (0, common_1.Optional)()),
    __param(6, (0, nestjs_prometheus_1.InjectMetric)('prisma_transaction_total')),
    __param(7, (0, common_1.Optional)()),
    __param(7, (0, nestjs_prometheus_1.InjectMetric)('prisma_active_transactions')),
    __metadata("design:paramtypes", [config_1.ConfigService,
        winston_1.Logger,
        prom_client_1.Histogram,
        prom_client_1.Counter,
        prom_client_1.Counter,
        prom_client_1.Histogram,
        prom_client_1.Counter,
        prom_client_1.Gauge])
], DbMetricsService);
//# sourceMappingURL=db-metrics.service.js.map