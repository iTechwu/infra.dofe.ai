"use strict";
/**
 * Transaction Context
 * 事务上下文管理
 *
 * 使用 AsyncLocalStorage 在调用链中传递事务客户端
 * 让 db 服务层能够自动感知当前是否在事务中
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactionClient = getTransactionClient;
exports.runInTransactionContext = runInTransactionContext;
exports.isInTransaction = isInTransaction;
const async_hooks_1 = require("async_hooks");
/**
 * Transaction context storage
 * 事务上下文存储
 */
const transactionContext = new async_hooks_1.AsyncLocalStorage();
/**
 * Get current transaction client if in a transaction
 * 获取当前事务客户端（如果在事务中）
 *
 * @returns Transaction client or undefined
 */
function getTransactionClient() {
    return transactionContext.getStore();
}
/**
 * Run callback with transaction context
 * 在事务上下文中运行回调
 *
 * @param tx - Transaction client
 * @param callback - Callback function
 * @returns Result of callback
 */
async function runInTransactionContext(tx, callback) {
    return transactionContext.run(tx, callback);
}
/**
 * Check if currently in a transaction
 * 检查当前是否在事务中
 *
 * @returns True if in transaction
 */
function isInTransaction() {
    return transactionContext.getStore() !== undefined;
}
//# sourceMappingURL=transaction-context.js.map