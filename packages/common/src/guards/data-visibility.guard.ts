import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { FastifyRequest } from 'fastify';
import { OrganizationPermissionService } from '@app/tenant-management/organization-permission';
import { DATA_VISIBILITY_KEY } from '@/common/decorators/data-visibility';
import type { ResourceType, DataScope } from '@repo/types';

/**
 * 数据可见性 Guard
 *
 * 根据用户角色自动解析数据可见范围，并注入到 request.dataScope 中
 * 供后续 Service 层使用
 */
@Injectable()
export class DataVisibilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: OrganizationPermissionService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // 获取资源类型
    const resourceType = this.reflector.getAllAndOverride<ResourceType>(
      DATA_VISIBILITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有设置资源类型，不需要处理可见性
    if (!resourceType) {
      return true;
    }

    // 获取用户信息
    const userId = (request as any).userId;
    const tenantId = (request as any).tenantId;
    const isAdmin = (request as any).isAdmin;

    // 如果没有用户信息（公共端点），跳过可见性注入
    if (!userId || !tenantId) {
      this.logger.debug(
        'No user context, skipping data visibility resolution',
        {
          resourceType,
        },
      );
      return true;
    }

    // 解析数据可见范围
    const dataScope = await this.permissionService.resolveDataScope({
      userId,
      tenantId,
      resourceType,
      isSystemAdmin: isAdmin,
    });

    // 注入到请求上下文
    (request as any).dataScope = dataScope;

    this.logger.debug('Data visibility resolved', {
      userId,
      tenantId,
      resourceType,
      scopeType: dataScope.type,
      departmentCount: dataScope.departmentIds?.length ?? 0,
      teamCount: dataScope.teamIds?.length ?? 0,
    });

    return true;
  }
}
