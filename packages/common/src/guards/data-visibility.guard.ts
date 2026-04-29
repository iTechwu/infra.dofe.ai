import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { FastifyRequest } from 'fastify';
import {
  PERMISSION_SERVICE_TOKEN,
  IPermissionService,
  DATA_VISIBILITY_KEY,
} from './guard-tokens';

@Injectable()
export class DataVisibilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PERMISSION_SERVICE_TOKEN)
    @Optional()
    private readonly permissionService: IPermissionService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const resourceType = this.reflector.getAllAndOverride<string>(
      DATA_VISIBILITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!resourceType) {
      return true;
    }

    const userId = (request as any).userId;
    const tenantId = (request as any).tenantId;
    const isAdmin = (request as any).isAdmin;

    if (!userId || !tenantId) {
      this.logger.debug(
        'No user context, skipping data visibility resolution',
        {
          resourceType,
        },
      );
      return true;
    }

    let dataScope: any = { type: 'all' };
    if (this.permissionService) {
      dataScope = await this.permissionService.resolveDataScope({
        userId,
        tenantId,
        resourceType,
        isSystemAdmin: isAdmin,
      });
    }

    (request as any).dataScope = dataScope;

    this.logger.debug('Data visibility resolved', {
      userId,
      tenantId,
      resourceType,
      scopeType: dataScope.type,
    });

    return true;
  }
}