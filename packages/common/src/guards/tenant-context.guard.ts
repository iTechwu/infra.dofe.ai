import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  Optional,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { FastifyRequest } from 'fastify';
import {
  TENANT_CONTEXT_SERVICE_TOKEN,
  ITenantContextService,
  PUBLIC_ENDPOINT_KEY,
  TENANT_SCOPE_KEY,
  CURRENT_TENANT_HEADER,
  DEFAULT_TENANT_ID,
} from './guard-tokens';

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TENANT_CONTEXT_SERVICE_TOKEN)
    @Optional()
    private readonly tenantContextService: ITenantContextService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const isPublic = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_ENDPOINT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const requiresTenantScope = this.reflector.getAllAndOverride<boolean>(
      TENANT_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const skipTenantCheck = (request as any).skipTenantCheck;
    if (skipTenantCheck) {
      const headerTenantId = request.headers[CURRENT_TENANT_HEADER] as string;
      const tenantId = headerTenantId || DEFAULT_TENANT_ID;
      (request as any).tenantId = tenantId;
      this.logger.debug('Using tenant ID for internal service', {
        tenantId,
        fromHeader: !!headerTenantId,
      });
      return true;
    }

    const userId = (request as any).userId;
    if (!userId) {
      this.logger.warn('No userId found in request, skipping tenant context');
      return true;
    }

    const headerTenantId = request.headers[CURRENT_TENANT_HEADER] as string;

    let tenantId: string | null = null;
    if (this.tenantContextService) {
      tenantId = await this.tenantContextService.resolveCurrentTenant(
        userId,
        headerTenantId,
      );
    } else {
      tenantId = headerTenantId || DEFAULT_TENANT_ID;
    }

    (request as any).tenantId = tenantId;

    if (requiresTenantScope && !tenantId) {
      this.logger.warn('Tenant scope required but no tenant ID available', {
        userId,
      });
      throw new ForbiddenException(
        '无法确定当前租户，请先选择租户或确保有租户成员资格',
      );
    }

    if (tenantId && this.tenantContextService) {
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