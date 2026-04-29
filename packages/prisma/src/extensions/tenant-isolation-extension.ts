import { ForbiddenException } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export const tenantContext = new AsyncLocalStorage<{ tenantId: string }>();

export function getTenantId(): string | null {
  const context = tenantContext.getStore();
  return context?.tenantId || null;
}

export function setTenantContext(tenantId: string, callback: () => void) {
  tenantContext.run({ tenantId }, callback);
}

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

export function setupTenantIsolationExtension(prisma: any) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          if (!MULTI_TENANT_MODELS.includes(model)) {
            return query(args);
          }

          const tenantId = getTenantId();

          if (!tenantId) {
            return query(args);
          }

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

          if (result && typeof result === 'object') {
            validateResultTenantId(result, tenantId);
          }

          return result;
        },
      },
    },
  });
}

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
