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
import {
  TENANT_CONTEXT_SERVICE_TOKEN,
  ITenantContextService,
} from './tokens';
import {
  CURRENT_TENANT_HEADER,
  TENANT_SCOPE_KEY,
  PUBLIC_ENDPOINT_KEY,
} from '@dofe/infra-contracts';

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TENANT_CONTEXT_SERVICE_TOKEN)
    private readonly tenantContextService: ITenantContextService,
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
    const skipTenantCheck = request.skipTenantCheck;
    if (skipTenantCheck) {
      const tenantId = request.headers[CURRENT_TENANT_HEADER] as string | undefined;
      if (!tenantId) {
        this.logger.warn('Internal service request missing tenant context', {
          service: request.internalServiceName,
        });
        throw new ForbiddenException(
          'Internal service requests must include the current tenant header',
        );
      }

      request.tenantId = tenantId;
      this.logger.debug('Using tenant ID for internal service', {
        tenantId,
        service: request.internalServiceName,
      });
      // 不进行其他租户验证
      return true;
    }

    const userId = request.userId;
    if (!userId) {
      // 没有用户身份。对租户范围路由而言这必定是配置错误：认证守卫必须先于本守卫执行
      // 并写入 request.userId。此处必须显式失败，而不是静默 return —— 静默 return 会让
      // request.tenantId 保持未设置，最终在控制器层抛出误导性的 400（"No tenant
      // context available"）。典型案例：`@Auth() + @UseGuards(TenantContextGuard)` 因
      // 装饰器求值顺序导致本守卫抢在 AuthGuard 之前运行（agents 账单接口曾因此故障）。
      if (requiresTenantScope) {
        this.logger.warn(
          'Tenant-scoped route reached without a resolved user identity; auth guard likely executed after tenant-context guard',
          { requiresTenantScope },
        );
        throw new ForbiddenException(
          '无法确定当前租户：缺少用户身份，请检查认证守卫是否先于租户上下文守卫执行',
        );
      }
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
    request.tenantId = tenantId;

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
      request.tenantMember = tenantMember;
    }

    this.logger.debug('Tenant context resolved', {
      userId,
      tenantId,
      requiresTenantScope,
    });

    return true;
  }
}
