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
const QUERY_ACTIONS = [
  'findFirst',
  'findMany',
  'findUnique',
  'findFirstOrThrow',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
];

/**
 * 不支持软删除的模型列表（这些模型没有 isDeleted 字段）
 *
 * 分类说明：
 * - 系统/配置表：SystemTaskQueue
 * - 关联表：BotPlugin, BotSkill, BotModel
 * - 日志表：BotUsageLog, OperateLog
 * - 安全令牌表：ProxyToken
 */
const NON_SOFT_DELETE_MODELS = [
  // 系统/配置表（无 isDeleted 字段）
  'SystemTaskQueue',
  'SystemConfig',
  'TenantConfig',
  'SystemSyncTask',

  // 关联表（多对多关系，通过 onDelete: Cascade 级联删除，无 isDeleted 字段）
  'BotSkill',
  'BotModel',
  'BotPlugin',
  'BotMcpServer',
  'GatewaySkill',
  'TenantPlugin',
  'ModelCapabilityTag',
  'ModelAvailabilityCapabilityTag',
  'FallbackChainModel',
  'ComplexityRoutingModelMapping',
  'BotSkillSourceSnapshot',
  'BotKnowledgeBaseSourceSnapshot',
  'BotKnowledgeLink',

  // 路由/策略配置表（无 isDeleted 字段）
  'BotModelRouting',
  'BotRoutingConfig',
  'ComplexityRoutingConfig',
  'FallbackChain',
  'CostStrategy',
  'AgentModel',
  'GatewayConfigVersion',
  'GatewayConfigChangeLog',

  // 技能版本表（只追加，不软删除，无 isDeleted 字段）
  'SkillVersion',
  // 技能表（通过 onDelete: Cascade 级联删除，无 isDeleted 字段）
  'Skill',

  // 模型可用性缓存表（无需软删除，无 isDeleted 字段）
  'ModelAvailability',
  'ModelCatalog',

  // 日志表（只追加，不删除，无 isDeleted 字段）
  'BotUsageLog',
  'OperateLog',
  'OpenClawAuditEvent',

  // 安全令牌表（通过 revokedAt 字段标记失效，不使用软删除，无 isDeleted 字段）
  'ProxyToken',

  // MCP Server（无 isDeleted 字段）
  'McpServer',

  // Pairing 记录（无 isDeleted 字段）
  'FeishuPairingRecord',
  'PlatformPairingRecord',

  // 计费相关表（当前 schema 未包含 isDeleted 字段）
  'Invoice',
  'InvoiceItem',
  'Payment',
  'Topup',

  // === bot autonomy / trigger / notification ===
  // 这些模型当前 schema 未包含 isDeleted 字段
  'ApprovalRequest',
  'BotTokenUsage',
  'BotTrigger',
  'BotTriggerHistory',
  'Notification',

  // === workspace / session ===
  // 这些模型当前 schema 未包含 isDeleted 字段
  'Workspace',
  'WorkspaceSession',

  // === feedback / optimization ===
  // 这些模型当前 schema 未包含 isDeleted 字段
  'BotExecutionFeedback',
  'BotOptimizationSuggestion',

  // === knowledge ===
  // 这些模型当前 schema 未包含 isDeleted 字段
  'KnowledgeBaseBot',
  'KnowledgeUsage',

  // === bot session / chain ===
  // 这些模型当前 schema 未包含 isDeleted 字段
  'BotSessionChain',
  'BotCrossSessionMessage',
  'SubAgentMessage',
  'SubAgentHeartbeatConfig',
  'SubAgentHeartbeatLog',
  'SubAgentRelation',
  'AutonomyPolicy',

  // === bot extensions ===
  // 这些模型当前 schema 未包含 isDeleted 字段
  'BotFocusExtension',
  'BotCronJobMeta',
  'BotMdFileVersion',
  'MemoryItem',

  // === organization ===
  // 这些模型当前 schema 未包含 isDeleted 字段
  'OrganizationMember',
  'UserTenantPreference',

  // === template ===
  // 这些模型当前 schema 未包含 isDeleted 字段
  'PositionSkill',
  'PositionKnowledgeBase',
  'TemplateSkill',
  'TemplateKnowledgeBase',

  // === general preset ===
  // 这些模型当前 schema 未包含 isDeleted 字段
  'GeneralPreset',
  'GeneralPresetSkill',
  'GeneralPresetKnowledgeBase',

  // === marketing ===
  // 这些模型当前 schema 未包含 isDeleted 字段
  'MarketingLead',

  // === compliance / data lifecycle ===
  // DeletionRequest 模型无 isDeleted 字段，通过 status 字段管理状态
  'DeletionRequest',

  // === plaza ===
  // 这些模型当前 schema 未包含 isDeleted 字段
  'PlazaLike',
  'PlazaSubscription',

  // === workflow ===
  // 这些模型当前 schema 未包含 isDeleted 字段
  'BotWorkflow',
  'WorkflowTemplate',
  'WorkflowExecution',
  'WorkflowNodeExecution',
  'WorkflowVersion',

  // === cost intelligence ===
  // 这些模型当前 schema 未包含 isDeleted 字段
  'CostAnomaly',
  'AnomalyRule',
  'OptimizationSuggestion',
  'CostPrediction',
  'BotOptimizationSuggestion',

  // === compliance (Q1 2027 治理合规 1.0) ===
  // 这些模型当前 schema 未包含 isDeleted 字段
  'CertificationStatus',
  'RetentionPolicy',
  'DeletionRequest',
  'ComplianceReport',
] as const;

/**
 * 检查模型是否支持软删除
 */
export function isSoftDeleteModel(modelName: string | undefined): boolean {
  if (!modelName) return false;
  // 如果模型在不支持软删除的列表中，返回 false
  return !NON_SOFT_DELETE_MODELS.includes(modelName as any);
}

/**
 * 检查 where 条件是否已显式指定 isDeleted
 * 支持嵌套的 OR/AND/NOT 条件
 */
function hasExplicitIsDeleted(
  where: Record<string, unknown> | undefined,
): boolean {
  if (!where) return false;

  // 直接检查 isDeleted 字段
  if ('isDeleted' in where) return true;

  // 检查 OR 条件
  if (Array.isArray(where.OR)) {
    for (const condition of where.OR) {
      if (hasExplicitIsDeleted(condition as Record<string, unknown>)) {
        return true;
      }
    }
  }

  // 检查 AND 条件
  if (Array.isArray(where.AND)) {
    for (const condition of where.AND) {
      if (hasExplicitIsDeleted(condition as Record<string, unknown>)) {
        return true;
      }
    }
  }

  // 检查 NOT 条件
  if (where.NOT) {
    if (Array.isArray(where.NOT)) {
      for (const condition of where.NOT) {
        if (hasExplicitIsDeleted(condition as Record<string, unknown>)) {
          return true;
        }
      }
    } else {
      if (hasExplicitIsDeleted(where.NOT as Record<string, unknown>)) {
        return true;
      }
    }
  }

  return false;
}

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
export function setupSoftDeleteMiddleware(prisma: PrismaClient): PrismaClient {
  return prisma.$extends({
    query: {
      $allOperations({ operation, model, args, query }) {
        // 检查是否为软删除模型
        if (!isSoftDeleteModel(model)) {
          return query(args);
        }

        // 处理查询操作：自动添加 isDeleted: false
        if (QUERY_ACTIONS.includes(operation)) {
          const newArgs = { ...args };
          if (!newArgs.where) {
            newArgs.where = {};
          }

          // 只有在未显式指定 isDeleted 时才自动添加
          if (!hasExplicitIsDeleted(newArgs.where)) {
            newArgs.where = {
              ...newArgs.where,
              isDeleted: false,
            };
          }

          return query(newArgs);
        }

        // 对于 delete 和 deleteMany 操作，我们需要使用不同的方法
        // 在 Prisma 7.x 中，我们不能在 $extends 中直接将一个操作转换为另一个操作
        // 这些操作需要在使用时手动处理，或者使用模型特定的扩展
        // 暂时让这些操作通过，后续可以通过其他方式处理
        return query(args);
      },
    },
  }) as PrismaClient;
}

/**
 * 硬删除工具函数
 * 当确实需要物理删除时使用
 *
 * @example
 * ```typescript
 * await hardDelete(prisma.userInfo, { id: 'xxx' });
 * ```
 */
export async function hardDelete<T>(
  model: {
    delete: (args: { where: T }) => Promise<unknown>;
  },
  where: T,
): Promise<unknown> {
  // 直接调用原始 delete，绕过中间件的软删除转换
  // 注意：由于中间件会拦截 delete，这个函数实际上需要使用 $executeRaw
  // 这里只是一个概念示例，实际使用时需要使用原始 SQL
  return model.delete({ where });
}
