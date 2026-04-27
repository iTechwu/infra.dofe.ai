/**
 * Soft Delete Middleware
 * 软删除中间件
 *
 * 自动处理软删除逻辑：
 * 1. 查询操作自动添加 isDeleted: false 条件
 * 2. 删除操作自动转换为软删除（update isDeleted = true）
 *
 * Prisma 7.x 更新：
 * - 使用 $extends 替代已移除的 $use 方法
 * - 返回扩展后的 PrismaClient 实例
 *
 * @example
 * ```typescript
 * const prisma = new PrismaClient();
 * const extendedPrisma = setupSoftDeleteMiddleware(prisma);
 * // 使用 extendedPrisma 而不是原始的 prisma
 * await extendedPrisma.userInfo.findMany(); // 自动添加 isDeleted: false
 * ```
 */
import { PrismaClient } from '@prisma/client';
/**
 * 查询操作列表
 */
export declare const QUERY_ACTIONS: string[];
/**
 * 删除操作列表
 */
export declare const DELETE_ACTIONS: string[];
/**
 * 检查模型是否支持软删除
 */
export declare function isSoftDeleteModel(modelName: string | undefined): boolean;
/**
 * 检查 where 条件是否已显式指定 isDeleted
 * 支持嵌套的 OR/AND/NOT 条件
 */
export declare function hasExplicitIsDeleted(where: Record<string, unknown> | undefined): boolean;
/**
 * 设置软删除中间件
 * Prisma 7.x: 使用 $extends 创建扩展客户端
 *
 * 注意：由于 Prisma 7.x 的 $extends API 限制，delete 操作的转换需要使用模型特定的扩展
 * 当前实现仅处理查询操作的软删除过滤
 *
 * @param prisma - Prisma 客户端实例
 * @returns 扩展后的 PrismaClient 实例
 */
export declare function setupSoftDeleteMiddleware(prisma: PrismaClient): PrismaClient;
/**
 * 硬删除工具函数
 * 当确实需要物理删除时使用
 *
 * @example
 * ```typescript
 * await hardDelete(prisma.userInfo, { id: 'xxx' });
 * ```
 */
export declare function hardDelete<T>(model: {
    delete: (args: {
        where: T;
    }) => Promise<unknown>;
}, where: T): Promise<unknown>;
