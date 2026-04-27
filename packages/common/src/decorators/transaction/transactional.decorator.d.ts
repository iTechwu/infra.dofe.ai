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
import { PrismaClient, Prisma } from '@prisma/client';
/**
 * Transaction isolation levels
 * 事务隔离级别
 */
export type TransactionIsolationLevel = Prisma.TransactionIsolationLevel;
/**
 * Transaction options
 * 事务选项
 */
export interface TransactionOptions {
    /**
     * Maximum wait time to acquire a transaction lock (ms)
     * 获取事务锁的最大等待时间（毫秒）
     * @default 5000
     */
    maxWait?: number;
    /**
     * Maximum transaction execution time (ms)
     * 事务执行的最大时间（毫秒）
     * @default 30000
     */
    timeout?: number;
    /**
     * Transaction isolation level
     * 事务隔离级别
     */
    isolationLevel?: TransactionIsolationLevel;
    /**
     * Enable retry mechanism for transient failures
     * 启用瞬态失败的重试机制
     * @default false
     */
    retry?: boolean;
    /**
     * Maximum number of retry attempts
     * 最大重试次数
     * @default 3
     */
    maxRetries?: number;
    /**
     * Base delay between retries in milliseconds
     * 重试之间的基础延迟（毫秒）
     * @default 100
     */
    retryDelay?: number;
    /**
     * Exponential backoff multiplier
     * 指数退避倍数
     * @default 2
     */
    retryBackoffMultiplier?: number;
    /**
     * Maximum retry delay in milliseconds
     * 最大重试延迟（毫秒）
     * @default 5000
     */
    maxRetryDelay?: number;
}
/**
 * Transaction result for monitoring
 * 用于监控的事务结果
 */
export interface TransactionResult {
    success: boolean;
    duration: number;
    retryCount: number;
    error?: Error;
    methodName: string;
}
/**
 * Transaction context for monitoring
 * 用于监控的事务上下文
 */
export interface TransactionContextData {
    startTime: number;
    methodName: string;
    retryCount: number;
    sqlCount: number;
    tablesInvolved: Set<string>;
}
/**
 * Get the current transaction client or undefined if not in a transaction
 * 获取当前事务客户端，如果不在事务中则返回 undefined
 */
export declare function getTransactionClient(context: object): PrismaClient | undefined;
/**
 * Get the current transaction context for monitoring
 * 获取当前事务上下文用于监控
 */
export declare function getTransactionContext(context: object): TransactionContextData | undefined;
/**
 * Transactional decorator
 * 事务装饰器
 *
 * Wraps the decorated method in a Prisma transaction.
 * The service class must have a `prisma` property with a `write` client.
 *
 * @param options - Transaction options
 */
export declare function Transactional(options?: TransactionOptions): (target: object, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * DbMetricsService interface for loose coupling
 * 松耦合的 DbMetricsService 接口
 */
interface DbMetricsServiceInterface {
    recordTransactionStart(): {
        startTime: number;
        traceId: string;
    };
    recordTransactionEnd(ctx: {
        startTime: number;
        traceId: string;
    }, status: 'success' | 'error' | 'rollback', metadata?: {
        retryCount?: number;
        methodName?: string;
        errorType?: string;
        errorMessage?: string;
    }): void;
    isEnabled(): boolean;
}
/**
 * Set the metrics service getter
 * 设置指标服务获取器
 *
 * 应该在应用启动时调用，例如在 AppModule 的 onModuleInit 中
 */
export declare function setTransactionMetricsService(getter: () => DbMetricsServiceInterface | undefined): void;
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
export declare abstract class TransactionalService {
    protected readonly prisma: {
        write: PrismaClient;
        read: PrismaClient;
    };
    constructor(prisma: {
        write: PrismaClient;
        read: PrismaClient;
    });
    /**
     * Get the write client (transaction-aware)
     * 获取写客户端（事务感知）
     *
     * Returns the transaction client if currently in a transaction,
     * otherwise returns the regular write client.
     */
    protected getWriteClient(): PrismaClient;
    /**
     * Get the read client
     * 获取读客户端
     *
     * Always returns the read client (transactions are for writes only).
     */
    protected getReadClient(): PrismaClient;
    /**
     * Get current transaction context for monitoring
     * 获取当前事务上下文用于监控
     */
    protected getTransactionContext(): TransactionContextData | undefined;
    /**
     * Record a table access in the current transaction
     * 在当前事务中记录表访问
     */
    protected recordTableAccess(tableName: string): void;
    /**
     * Execute a callback within a transaction
     * 在事务中执行回调
     *
     * @param callback - The callback to execute
     * @param options - Transaction options
     */
    protected runInTransaction<T>(callback: (tx: PrismaClient) => Promise<T>, options?: TransactionOptions): Promise<T>;
}
export {};
