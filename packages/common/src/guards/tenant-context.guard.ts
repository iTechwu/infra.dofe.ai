import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { FastifyRequest } from 'fastify';
import { TenantContextService } from '@app/tenant-management/tenant-context';
import {
  CURRENT_TENANT_HEADER,
  TENANT_SCOPE_KEY,
  PUBLIC_ENDPOINT_KEY,
  DEFAULT_TENANT_ID,
} from '@dofe/infra-contracts';

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContextService: TenantContextService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // 检查是否是公共端点
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_ENDPOINT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    // 检查是否需要租户范围
    const requiresTenantScope = this.reflector.getAllAndOverride<boolean>(
      TENANT_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果是内部服务且跳过租户检查，直接使用 header 中的租户 ID
    const skipTenantCheck = (request as any).skipTenantCheck;
    if (skipTenantCheck) {
      const headerTenantId = request.headers[CURRENT_TENANT_HEADER] as string;
      // 如果 header 中有租户 ID，使用它；否则使用默认租户
      const tenantId = headerTenantId || DEFAULT_TENANT_ID;
      (request as any).tenantId = tenantId;
      this.logger.debug('Using tenant ID for internal service', {
        tenantId,
        service: (request as any).internalServiceName,
        fromHeader: !!headerTenantId,
      });
      // 不进行其他租户验证
      return true;
    }

    const userId = (request as any).userId;
    if (!userId) {
      this.logger.warn('No userId found in request, skipping tenant context');
      return true;
    }

    // 从 header 获取租户 ID
    const headerTenantId = request.headers[CURRENT_TENANT_HEADER] as string;

    // 解析当前租户
    const tenantId = await this.tenantContextService.resolveCurrentTenant(
      userId,
      headerTenantId,
    );

    // 设置租户上下文到 request
    (request as any).tenantId = tenantId;

    // 如果需要租户范围但没有租户 ID，抛出明确的错误
    if (requiresTenantScope && !tenantId) {
      this.logger.warn('Tenant scope required but no tenant ID available', {
        userId,
      });
      throw new ForbiddenException(
        '无法确定当前租户，请先选择租户或确保有租户成员资格',
      );
    }

    // 如果有租户 ID，获取租户成员信息
    if (tenantId) {
      const tenantMember = await this.tenantContextService.getTenantMember(
        userId,
        tenantId,
      );
      (request as any).tenantMember = tenantMember;
    }

    this.logger.debug('Tenant context resolved', {
      userId,
      tenantId,
      requiresTenantScope,
    });

    return true;
  }
}
