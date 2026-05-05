import {
  SetMetadata,
  createParamDecorator,
  ExecutionContext,
  applyDecorators,
  UseGuards,
} from '@nestjs/common';
import {
  PUBLIC_ENDPOINT_KEY,
  TENANT_SCOPE_KEY,
  REQUIRE_PERMISSIONS_KEY,
  Permission,
} from '@dofe/infra-contracts';
import { AuthGuard } from '../../guards/auth.guard';
import { TenantContextGuard } from '../../guards/tenant-context.guard';
import { PermissionGuard } from '../../guards/permission.guard';

/**
 * 公共端点装饰器 - 标记不需要认证的端点
 */
export const Public = () => SetMetadata(PUBLIC_ENDPOINT_KEY, true);

/**
 * 租户范围装饰器 - 标记需要租户上下文的端点
 */
export const TenantScope = () => SetMetadata(TENANT_SCOPE_KEY, true);

/**
 * 要求权限装饰器 - 标记需要特定权限的端点
 *
 * @example
 * ```typescript
 * @RequirePermissions(PERMISSION.GATEWAY_READ)
 * async listGateways() { ... }
 *
 * @RequirePermissions([PERMISSION.BOT_CREATE, PERMISSION.BOT_UPDATE])
 * async createOrUpdateBot() { ... }
 * ```
 */
export const RequirePermissions = (permissions: Permission | Permission[]) =>
  SetMetadata(
    REQUIRE_PERMISSIONS_KEY,
    Array.isArray(permissions) ? permissions : [permissions],
  );

/**
 * 租户 API 装饰器 - 组合认证、租户上下文和权限检查
 * 应用于需要租户上下文和权限检查的 API 端点
 *
 * @param permissions 需要的权限
 *
 * @example
 * ```typescript
 * @TenantApi(PERMISSION.GATEWAY_READ)
 * async listGateways() { ... }
 * ```
 */
export const TenantApi = (permissions: Permission | Permission[]) =>
  applyDecorators(
    TenantScope(),
    RequirePermissions(permissions),
    UseGuards(AuthGuard, TenantContextGuard, PermissionGuard),
  );

/**
 * 当前租户参数装饰器 - 从请求中提取当前租户 ID
 *
 * @example
 * ```typescript
 * async list(@CurrentTenant() tenantId: string) { ... }
 * ```
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantId;
  },
);

/**
 * 当前租户成员参数装饰器 - 从请求中提取当前租户成员信息
 *
 * @example
 * ```typescript
 * async getInfo(@CurrentTenantMember() member: TenantMember) { ... }
 * ```
 */
export const CurrentTenantMember = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantMember;
  },
);

/**
 * 团队上下文信息
 */
export interface TeamContext {
  /** 当前租户/团队 ID */
  tenantId: string;
}

/**
 * 当前团队参数装饰器 - 从请求中提取团队上下文
 * 别名装饰器，与 @CurrentTenant() 提供相同的租户上下文，但语义更偏向"团队"
 *
 * @example
 * ```typescript
 * async list(@TeamInfo() teamInfo: TeamContext) { ... }
 * ```
 */
export const TeamInfo = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TeamContext => {
    const request = ctx.switchToHttp().getRequest();
    return {
      tenantId: request.tenantId,
    };
  },
);

/**
 * 从请求中提取团队 ID
 *
 * @example
 * ```typescript
 * const teamId = getTeamId(req);
 * ```
 */
export function getTeamId(request: { tenantId?: string }): string {
  return (request as any).tenantId;
}
