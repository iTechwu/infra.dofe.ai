import {
  SetMetadata,
  createParamDecorator,
  ExecutionContext,
  applyDecorators,
  UseGuards,
} from '@nestjs/common';
import type { ResourceType, DataScope } from '@repo/types';
import { Permission, REQUIRE_PERMISSIONS_KEY } from '@repo/constants';
import { AuthGuard } from '@/common/guards';
import { TenantContextGuard } from '@/common/guards/tenant-context.guard';
import { PermissionGuard } from '@/common/guards/permission.guard';
import { DataVisibilityGuard } from '@/common/guards/data-visibility.guard';

/**
 * 数据可见性元数据键
 */
export const DATA_VISIBILITY_KEY = 'data_visibility_resource_type';

/**
 * 数据可见性装饰器
 *
 * 标记端点需要注入数据可见性范围，自动根据用户角色解析 DataScope
 *
 * @param resourceType 资源类型
 *
 * @example
 * ```typescript
 * @DataVisibility('bot')
 * async listBots(@ReqDataScope() scope: DataScope) {
 *   // scope 已自动注入
 *   return this.botService.list({ ...scope });
 * }
 * ```
 */
export const DataVisibility = (resourceType: ResourceType) =>
  applyDecorators(
    SetMetadata(DATA_VISIBILITY_KEY, resourceType),
    UseGuards(AuthGuard, TenantContextGuard, DataVisibilityGuard),
  );

/**
 * 数据可见性参数装饰器
 *
 * 从请求中提取已解析的数据可见性范围
 *
 * @example
 * ```typescript
 * async list(@ReqDataScope() scope: DataScope) {
 *   // scope.type: 'tenant' | 'department_tree' | 'department' | 'team' | 'user'
 *   // scope.departmentIds, scope.teamIds, scope.userId 根据类型不同而不同
 * }
 * ```
 */
export const ReqDataScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DataScope | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.dataScope;
  },
);

/**
 * 组织权限 API 装饰器
 *
 * 组合认证、租户上下文、权限检查和数据可见性注入
 * 适用于需要基于组织架构进行数据隔离的 API
 *
 * @param permissions 需要的权限
 * @param resourceType 资源类型（用于数据可见性）
 *
 * @example
 * ```typescript
 * @OrganizationApi(PERMISSION.BOT_READ, 'bot')
 * async listBots(@ReqDataScope() scope: DataScope) {
 *   return this.botService.list(scope);
 * }
 * ```
 */
export const OrganizationApi = (
  permissions: Permission | Permission[],
  resourceType: ResourceType,
) =>
  applyDecorators(
    SetMetadata(
      REQUIRE_PERMISSIONS_KEY,
      Array.isArray(permissions) ? permissions : [permissions],
    ),
    SetMetadata(DATA_VISIBILITY_KEY, resourceType),
    UseGuards(
      AuthGuard,
      TenantContextGuard,
      PermissionGuard,
      DataVisibilityGuard,
    ),
  );

/**
 * 安全资源装饰器
 *
 * 组合权限检查和数据可见性注入
 * 等同于设计文档中的 SecureResource
 *
 * @param permissions 需要的权限
 * @param resourceType 资源类型（用于数据可见性）
 *
 * @example
 * ```typescript
 * @SecureResource(['bot:delete'], 'bot')
 * async deleteBot(@ReqDataScope() scope: DataScope) {
 *   // 先检查权限，再检查数据归属
 *   return this.botService.delete(scope);
 * }
 * ```
 */
export const SecureResource = OrganizationApi;
