import { ForbiddenException } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

// 全局上下文存储
export const tenantContext = new AsyncLocalStorage<{ tenantId: string }>();

/**
 * 获取当前租户 ID
 */
export function getTenantId(): string | null {
  const context = tenantContext.getStore();
  return context?.tenantId || null;
}

/**
 * 设置租户上下文
 */
export function setTenantContext(tenantId: string, callback: () => void) {
  tenantContext.run({ tenantId }, callback);
}

/**
 * 多租户表列表
 */
const MULTI_TENANT_MODELS = [
  'Bot',
  'BotCronJobMeta',
  'BotModelRouting',
  'BotSkill',
  'BotUsageLog',
  'Conversation',
  'Message',
  'PluginInstall',
  'ProviderKey',
  'ModelAvailability',
  'AuditLog',
  'File',
  'Skill',
  'SkillVersion',
  'TenantMember',
  'FallbackChain',
  'GatewayConfigVersion',
];

/**
 * 创建租户隔离扩展（Prisma 7.x）
 * 自动注入 tenantId 过滤，防止跨租户数据访问
 */
export function setupTenantIsolationExtension(prisma: any) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          // 只处理多租户表
          if (!MULTI_TENANT_MODELS.includes(model)) {
            return query(args);
          }

          // 获取当前租户 ID
          const tenantId = getTenantId();

          // 如果没有租户上下文，跳过（例如系统级操作）
          if (!tenantId) {
            return query(args);
          }

          // 读操作：自动注入 tenantId 过滤
          if (
            [
              'findMany',
              'findFirst',
              'findUnique',
              'count',
              'aggregate',
            ].includes(operation)
          ) {
            args.where = {
              ...args.where,
              tenantId,
            };
          }

          // 写操作：自动注入 tenantId
          if (operation === 'create') {
            args.data = {
              ...args.data,
              tenantId,
            };
          }

          if (operation === 'createMany') {
            if (Array.isArray(args.data)) {
              args.data = args.data.map((item: any) => ({
                ...item,
                tenantId,
              }));
            }
          }

          // 更新/删除操作：验证 tenantId
          if (
            ['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(
              operation,
            )
          ) {
            args.where = {
              ...args.where,
              tenantId,
            };
          }

          const result = await query(args);

          // 验证返回结果不包含其他租户数据
          if (result && typeof result === 'object') {
            validateResultTenantId(result, tenantId);
          }

          return result;
        },
      },
    },
  });
}

/**
 * 验证结果中的 tenantId
 */
function validateResultTenantId(result: any, expectedTenantId: string) {
  if (Array.isArray(result)) {
    result.forEach((item) => validateResultTenantId(item, expectedTenantId));
  } else if (result && typeof result === 'object') {
    if (result.tenantId && result.tenantId !== expectedTenantId) {
      throw new ForbiddenException(
        `Data leak detected: result contains data from tenant ${result.tenantId}`,
      );
    }
  }
}
