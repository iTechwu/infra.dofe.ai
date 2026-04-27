/**
 * Unit of Work Service
 * 工作单元服务 - 统一管理跨服务事务
 *
 * 职责：
 * 1. 提供统一的事务管理接口
 * 2. 支持跨多个 db 服务的事务操作
 * 3. 自动处理事务的提交和回滚
 * 4. 支持嵌套事务检测
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class SignService {
 *   constructor(
 *     private readonly uow: UnitOfWorkService,
 *     private readonly userService: UserService,
 *   ) {}
 *
 *   async createAccount(data: CreateAccountDto) {
 *     return await this.uow.execute(async () => {
 *       // 在事务中调用服务层方法，服务层会自动使用事务客户端
 *       const user = await this.userService.createUser(data);
 *       return { user };
 *     });
 *   }
 * }
 * ```
 */
import { PrismaService } from "../../prisma/src/prisma";
/**
 * Transaction options
 * 事务选项
 */
export interface TransactionOptions {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
}
/**
 * Unit of Work Service
 * 工作单元服务
 */
export declare class UnitOfWorkService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    /**
     * Execute a callback within a transaction
     * 在事务中执行回调
     *
     * 使用 AsyncLocalStorage 在调用链中传递事务客户端
     * db 服务层会自动检测并使用事务客户端
     *
     * @param callback - Callback function (no need to pass tx parameter)
     * @param options - Transaction options
     * @returns Result of the callback
     */
    execute<T>(callback: () => Promise<T>, options?: TransactionOptions): Promise<T>;
    /**
     * Execute with retry on deadlock/conflict
     * 在死锁/冲突时重试执行
     *
     * Uses exponential backoff with jitter to prevent thundering herd
     * 使用带抖动的指数退避来防止惊群效应
     *
     * @param callback - Callback function
     * @param options - Transaction options with retry config
     * @returns Result of the callback
     */
    executeWithRetry<T>(callback: () => Promise<T>, options?: TransactionOptions & {
        maxRetries?: number;
        retryDelay?: number;
    }): Promise<T>;
    /**
     * Check if error is retryable
     * 检查错误是否可重试
     */
    private isRetryableError;
    /**
     * Sleep for specified milliseconds
     * 睡眠指定毫秒数
     */
    private sleep;
}
