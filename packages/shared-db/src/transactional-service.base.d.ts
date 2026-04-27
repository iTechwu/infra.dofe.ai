/**
 * Transactional Service Base
 * 事务感知服务基类
 *
 * 所有 db 服务层应该继承此基类，以支持事务上下文
 * 自动检测是否在事务中，如果在事务中则使用事务客户端，否则使用常规客户端
 *
 * 支持两种事务方式：
 * 1. @Transactional 装饰器（使用 Symbol 存储，适合单个服务内部事务）
 * 2. UnitOfWorkService（使用 AsyncLocalStorage，适合跨服务事务）
 *
 * 两种方式可以协同工作，服务层会自动检测并使用正确的事务客户端
 */
import { PrismaClient } from '@prisma/client';
import { PrismaService } from "../../prisma/src/prisma";
/**
 * Base class for transactional services
 * 事务感知服务基类
 */
export declare abstract class TransactionalServiceBase {
    protected readonly prisma: PrismaService;
    constructor(prisma: PrismaService);
    /**
     * Get write client (transaction-aware)
     * 获取写客户端（事务感知）
     *
     * 优先使用 AsyncLocalStorage 中的事务客户端（UnitOfWorkService）
     * 其次使用 Symbol 中的事务客户端（@Transactional 装饰器）
     * 最后使用常规写客户端
     *
     * Returns transaction client if in a transaction,
     * otherwise returns regular write client.
     */
    protected getWriteClient(): PrismaClient;
    /**
     * Get a valid client with model access
     * 获取一个可访问模型的有效客户端
     *
     * This is a fallback method that ensures we always return a usable client.
     * Use only when getReadClient/getWriteClient returns a client with missing models.
     */
    protected getValidClient(): PrismaClient;
    /**
     * Get read client
     * 获取读客户端
     *
     * Note: In transaction, read operations should also use write client
     * to ensure consistency (read-after-write)
     */
    protected getReadClient(): PrismaClient;
    /**
     * Check if a Prisma client has model delegates
     * 检查 Prisma 客户端是否有模型委托
     */
    private hasModelDelegates;
    /**
     * Check if currently in a transaction
     * 检查当前是否在事务中
     */
    protected isInTransaction(): boolean;
}
