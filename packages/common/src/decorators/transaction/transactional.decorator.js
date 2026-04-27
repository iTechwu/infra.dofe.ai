"use strict";
/**
 * Transactional Decorator
 * 事务处理装饰器
 *
 * Automatically wraps method execution in a Prisma transaction.
 * Works with the project's read/write separation architecture.
 * Supports optional retry mechanism for deadlock and write conflict errors.
 *
 * 自动将方法执行包装在 Prisma 事务中。
 * 与项目的读写分离架构配合工作。
 * 支持可选的死锁和写冲突错误重试机制。
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class ApiService {
 *   constructor(private readonly prisma: PrismaService) {}
 *
 *   // Basic usage
 *   @Transactional()
 *   async createWithOwner(userId: string, data: CreateInput) {
 *     const data = await this.prisma.write.create({ data });
 *     return data;
 *   }
 *
 *   // With retry enabled
 *   @Transactional({ retry: true, maxRetries: 3 })
 *   async updateCriticalData(id: string, data: UpdateInput) {
 *     // Automatically retries on deadlock or write conflict
 *     return this.prisma.write.data.update({ where: { id }, data });
 *   }
 *
 *   // With custom isolation level
 *   @Transactional({ isolationLevel: 'Serializable', retry: true })
 *   async transferOwnership(fromId: string, toId: string) {
 *     // Critical operation requiring serializable isolation
 *   }
 * }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionalService = void 0;
exports.getTransactionClient = getTransactionClient;
exports.getTransactionContext = getTransactionContext;
exports.Transactional = Transactional;
exports.setTransactionMetricsService = setTransactionMetricsService;
/**
 * Retryable error codes
 * 可重试的错误码
 *
 * These error codes indicate transient failures that can be retried:
 * - P2034: Transaction failed due to write conflict or deadlock (Prisma)
 * - P2028: Transaction API error (Prisma)
 * - 40001: Serialization failure (PostgreSQL)
 * - 40P01: Deadlock detected (PostgreSQL)
 */
const RETRYABLE_ERROR_CODES = new Set([
    'P2034', // Prisma: Write conflict or deadlock
    'P2028', // Prisma: Transaction API error
    '40001', // PostgreSQL: Serialization failure
    '40P01', // PostgreSQL: Deadlock detected
]);
/**
 * Check if an error is retryable
 * 检查错误是否可重试
 */
function isRetryableError(error) {
    if (!error || typeof error !== 'object')
        return false;
    // Check Prisma error code
    const prismaCode = error.code;
    if (prismaCode && RETRYABLE_ERROR_CODES.has(prismaCode)) {
        return true;
    }
    // Check PostgreSQL error code in message
    const message = error.message || '';
    for (const code of RETRYABLE_ERROR_CODES) {
        if (message.includes(code)) {
            return true;
        }
    }
    return false;
}
/**
 * Calculate retry delay with exponential backoff and jitter
 * 使用指数退避和抖动计算重试延迟
 */
function calculateRetryDelay(attempt, baseDelay, backoffMultiplier, maxDelay) {
    const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, maxDelay);
    // Add jitter (0-25% of delay) to prevent thundering herd
    const jitter = cappedDelay * Math.random() * 0.25;
    return Math.floor(cappedDelay + jitter);
}
/**
 * Sleep for specified milliseconds
 * 睡眠指定毫秒数
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Symbol to store transaction client in context
 */
const TRANSACTION_CLIENT = Symbol('TRANSACTION_CLIENT');
/**
 * Symbol to store transaction context for monitoring
 */
const TRANSACTION_CONTEXT = Symbol('TRANSACTION_CONTEXT');
/**
 * Get the current transaction client or undefined if not in a transaction
 * 获取当前事务客户端，如果不在事务中则返回 undefined
 */
function getTransactionClient(context) {
    return context[TRANSACTION_CLIENT];
}
/**
 * Get the current transaction context for monitoring
 * 获取当前事务上下文用于监控
 */
function getTransactionContext(context) {
    return context[TRANSACTION_CONTEXT];
}
/**
 * Set the transaction client in context
 * 在上下文中设置事务客户端
 */
function setTransactionClient(context, client) {
    context[TRANSACTION_CLIENT] = client;
}
/**
 * Set the transaction context for monitoring
 * 设置事务上下文用于监控
 */
function setTransactionContext(context, txContext) {
    context[TRANSACTION_CONTEXT] =
        txContext;
}
/**
 * Clear the transaction client from context
 * 从上下文中清除事务客户端
 */
function clearTransactionClient(context) {
    delete context[TRANSACTION_CLIENT];
}
/**
 * Clear the transaction context from context
 * 从上下文中清除事务上下文
 */
function clearTransactionContext(context) {
    delete context[TRANSACTION_CONTEXT];
}
/**
 * Default transaction options
 * 默认事务选项
 */
const DEFAULT_OPTIONS = {
    maxWait: 5000,
    timeout: 30000,
    isolationLevel: undefined,
    retry: false,
    maxRetries: 3,
    retryDelay: 100,
    retryBackoffMultiplier: 2,
    maxRetryDelay: 5000,
};
/**
 * Transactional decorator
 * 事务装饰器
 *
 * Wraps the decorated method in a Prisma transaction.
 * The service class must have a `prisma` property with a `write` client.
 *
 * @param options - Transaction options
 */
function Transactional(options = {}) {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        const methodName = `${target.constructor.name}.${propertyKey}`;
        descriptor.value = async function (...args) {
            // Check if already in a transaction
            const existingClient = getTransactionClient(this);
            if (existingClient) {
                // Already in a transaction, just execute the method
                // Increment SQL count in parent transaction context
                const parentContext = getTransactionContext(this);
                if (parentContext) {
                    parentContext.sqlCount++;
                }
                return originalMethod.apply(this, args);
            }
            // Get the Prisma service
            const prismaService = this
                .prisma;
            if (!prismaService?.write) {
                throw new Error(`@Transactional decorator requires a 'prisma' property with a 'write' client on ${target.constructor.name}`);
            }
            const writeClient = prismaService.write;
            // Execute with retry logic
            return executeWithRetry(this, writeClient, originalMethod, args, methodName, mergedOptions);
        };
        return descriptor;
    };
}
/**
 * Execute transaction with retry logic
 * 使用重试逻辑执行事务
 */
async function executeWithRetry(context, writeClient, originalMethod, args, methodName, options) {
    let lastError;
    let retryCount = 0;
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
        try {
            const result = await executeTransaction(context, writeClient, originalMethod, args, methodName, options, retryCount);
            return result;
        }
        catch (error) {
            lastError = error;
            // Check if we should retry
            if (options.retry &&
                attempt < options.maxRetries &&
                isRetryableError(error)) {
                retryCount++;
                const delay = calculateRetryDelay(attempt, options.retryDelay, options.retryBackoffMultiplier, options.maxRetryDelay);
                // Log retry attempt
                console.warn(`Transaction ${methodName} failed with retryable error, ` +
                    `retrying in ${delay}ms (attempt ${retryCount}/${options.maxRetries})`, { error: error.message });
                await sleep(delay);
                continue;
            }
            // Not retryable or max retries exceeded
            throw error;
        }
    }
    // Should not reach here, but just in case
    throw lastError || new Error('Transaction failed after max retries');
}
/**
 * Execute a single transaction attempt
 * 执行单次事务尝试
 */
async function executeTransaction(context, writeClient, originalMethod, args, methodName, options, retryCount) {
    const startTime = Date.now();
    // 获取 DbMetricsService 上下文（如果可用）
    const metricsService = metricsServiceGetter?.();
    const metricsCtx = metricsService?.recordTransactionStart();
    // Create transaction context for monitoring
    const txContext = {
        startTime,
        methodName,
        retryCount,
        sqlCount: 0,
        tablesInvolved: new Set(),
    };
    try {
        const result = await writeClient.$transaction(async (tx) => {
            // Store the transaction client and context
            setTransactionClient(context, tx);
            setTransactionContext(context, txContext);
            try {
                return await originalMethod.apply(context, args);
            }
            finally {
                // Clear the transaction client and context
                clearTransactionClient(context);
                clearTransactionContext(context);
            }
        }, {
            maxWait: options.maxWait,
            timeout: options.timeout,
            isolationLevel: options.isolationLevel || undefined,
        });
        // Log successful transaction
        const duration = Date.now() - startTime;
        logTransactionComplete(methodName, duration, retryCount, true, undefined, metricsCtx);
        return result;
    }
    catch (error) {
        // Log failed transaction
        const duration = Date.now() - startTime;
        logTransactionComplete(methodName, duration, retryCount, false, error, metricsCtx);
        throw error;
    }
}
/**
 * Transaction metrics service holder
 * 事务指标服务持有者
 *
 * 用于延迟获取 DbMetricsService，避免循环依赖
 */
let metricsServiceGetter = null;
/**
 * Set the metrics service getter
 * 设置指标服务获取器
 *
 * 应该在应用启动时调用，例如在 AppModule 的 onModuleInit 中
 */
function setTransactionMetricsService(getter) {
    metricsServiceGetter = getter;
}
/**
 * Log transaction completion with DbMetricsService integration
 * 使用 DbMetricsService 集成记录事务完成
 */
function logTransactionComplete(methodName, duration, retryCount, success, error, metricsCtx) {
    // 使用 DbMetricsService 记录指标（如果可用）
    const metricsService = metricsServiceGetter?.();
    if (metricsService && metricsCtx) {
        metricsService.recordTransactionEnd(metricsCtx, success ? 'success' : 'error', {
            retryCount,
            methodName,
            errorType: error?.name,
            errorMessage: error?.message,
        });
        return; // DbMetricsService 会处理日志
    }
    // 回退到 console（仅在 DbMetricsService 不可用时）
    // 生产环境应该配置 DbMetricsService
    if (process.env.NODE_ENV === 'dev' || !success || duration > 1000) {
        const logData = {
            methodName,
            duration: `${duration}ms`,
            retryCount,
            success,
            timestamp: new Date().toISOString(),
        };
        if (success) {
            if (duration > 1000) {
                console.warn('Slow Transaction', logData);
            }
            // dev 环境下记录所有事务，生产环境只记录慢事务
        }
        else {
            console.error('Transaction Failed', {
                ...logData,
                error: error ? { name: error.name, message: error.message } : undefined,
            });
        }
    }
}
/**
 * TransactionalService mixin
 * 事务服务 Mixin
 *
 * Provides helper methods for transaction-aware services.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class ApiService extends TransactionalService {
 *   constructor(prisma: PrismaService) {
 *     super(prisma);
 *   }
 *
 *   async create(data: CreateInput) {
 *     // Uses transaction client if in a transaction, otherwise uses write client
 *     return this.getWriteClient().create({ data });
 *   }
 * }
 * ```
 */
class TransactionalService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Get the write client (transaction-aware)
     * 获取写客户端（事务感知）
     *
     * Returns the transaction client if currently in a transaction,
     * otherwise returns the regular write client.
     */
    getWriteClient() {
        const txClient = getTransactionClient(this);
        return txClient ?? this.prisma.write;
    }
    /**
     * Get the read client
     * 获取读客户端
     *
     * Always returns the read client (transactions are for writes only).
     */
    getReadClient() {
        return this.prisma.read;
    }
    /**
     * Get current transaction context for monitoring
     * 获取当前事务上下文用于监控
     */
    getTransactionContext() {
        return getTransactionContext(this);
    }
    /**
     * Record a table access in the current transaction
     * 在当前事务中记录表访问
     */
    recordTableAccess(tableName) {
        const txContext = getTransactionContext(this);
        if (txContext) {
            txContext.sqlCount++;
            txContext.tablesInvolved.add(tableName);
        }
    }
    /**
     * Execute a callback within a transaction
     * 在事务中执行回调
     *
     * @param callback - The callback to execute
     * @param options - Transaction options
     */
    async runInTransaction(callback, options = {}) {
        const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
        return this.prisma.write.$transaction(async (tx) => {
            setTransactionClient(this, tx);
            try {
                return await callback(tx);
            }
            finally {
                clearTransactionClient(this);
            }
        }, {
            maxWait: mergedOptions.maxWait,
            timeout: mergedOptions.timeout,
            isolationLevel: mergedOptions.isolationLevel || undefined,
        });
    }
}
exports.TransactionalService = TransactionalService;
//# sourceMappingURL=transactional.decorator.js.map