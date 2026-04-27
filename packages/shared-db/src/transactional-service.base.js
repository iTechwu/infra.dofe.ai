"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionalServiceBase = void 0;
const transaction_context_1 = require("./transaction-context");
const transactional_decorator_1 = require("../../common/src/decorators/transaction/transactional.decorator");
/**
 * Base class for transactional services
 * 事务感知服务基类
 */
class TransactionalServiceBase {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
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
    getWriteClient() {
        // 1. 优先检查 AsyncLocalStorage（UnitOfWorkService）
        const asyncTxClient = (0, transaction_context_1.getTransactionClient)();
        if (asyncTxClient) {
            return asyncTxClient;
        }
        // 2. 检查 Symbol（@Transactional 装饰器）
        const symbolTxClient = (0, transactional_decorator_1.getTransactionClient)(this);
        if (symbolTxClient) {
            return symbolTxClient;
        }
        // 3. 检查 prisma 是否已初始化
        if (!this.prisma) {
            throw new Error('PrismaService not initialized. Ensure the module is properly imported.');
        }
        // 4. 使用常规写客户端
        return this.prisma.write;
    }
    /**
     * Get a valid client with model access
     * 获取一个可访问模型的有效客户端
     *
     * This is a fallback method that ensures we always return a usable client.
     * Use only when getReadClient/getWriteClient returns a client with missing models.
     */
    getValidClient() {
        // 尝试写客户端
        const write = this.prisma.write;
        if (write && write.gatewayModelCatalog?.findMany) {
            return write;
        }
        // 尝试读客户端
        const read = this.prisma.read;
        if (read && read.gatewayModelCatalog?.findMany) {
            return read;
        }
        // 如果都失败，返回写客户端（让错误自然抛出以便调试）
        return write || read;
    }
    /**
     * Get read client
     * 获取读客户端
     *
     * Note: In transaction, read operations should also use write client
     * to ensure consistency (read-after-write)
     */
    getReadClient() {
        // 如果在事务中，使用事务客户端以确保读取一致性
        // 如果不在事务中，使用读客户端
        // 1. 优先检查 AsyncLocalStorage（UnitOfWorkService）
        const asyncTxClient = (0, transaction_context_1.getTransactionClient)();
        if (asyncTxClient) {
            return asyncTxClient;
        }
        // 2. 检查 Symbol（@Transactional 装饰器）
        const symbolTxClient = (0, transactional_decorator_1.getTransactionClient)(this);
        if (symbolTxClient) {
            return symbolTxClient;
        }
        // 3. 检查 prisma 是否已初始化
        if (!this.prisma) {
            throw new Error('PrismaService not initialized. Ensure the module is properly imported.');
        }
        // 4. 获取读客户端和写客户端
        const read = this.prisma.read;
        const write = this.prisma.write;
        // 5. 检查读客户端是否有效（有模型委托）
        if (read && this.hasModelDelegates(read)) {
            return read;
        }
        // 6. 读客户端无效，检查写客户端
        if (write && this.hasModelDelegates(write)) {
            return write;
        }
        // 7. 两个客户端都没有有效的模型委托
        // 这表明 Prisma 客户端初始化失败
        const readStatus = read ? 'exists but missing models' : 'undefined';
        const writeStatus = write ? 'exists but missing models' : 'undefined';
        throw new Error(`Prisma client initialization failed. Read client: ${readStatus}, Write client: ${writeStatus}. ` +
            `This usually happens when Prisma $extends loses model delegates. ` +
            `Check PrismaReadService and PrismaWriteService initialization logs for details.`);
    }
    /**
     * Check if a Prisma client has model delegates
     * 检查 Prisma 客户端是否有模型委托
     */
    hasModelDelegates(client) {
        if (!client)
            return false;
        const prisma = client;
        // 只需要检查一个模型即可判断客户端是否有效
        const gatewayModelCatalog = prisma.gatewayModelCatalog;
        if (!gatewayModelCatalog)
            return false;
        const delegate = gatewayModelCatalog;
        return typeof delegate.findMany === 'function';
    }
    /**
     * Check if currently in a transaction
     * 检查当前是否在事务中
     */
    isInTransaction() {
        // 检查 AsyncLocalStorage
        if ((0, transaction_context_1.isInTransaction)()) {
            return true;
        }
        // 检查 Symbol
        if ((0, transactional_decorator_1.getTransactionClient)(this)) {
            return true;
        }
        return false;
    }
}
exports.TransactionalServiceBase = TransactionalServiceBase;
//# sourceMappingURL=transactional-service.base.js.map