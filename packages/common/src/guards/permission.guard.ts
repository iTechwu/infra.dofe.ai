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
  PERMISSION_SERVICE_TOKEN,
  IPermissionService,
  PUBLIC_ENDPOINT_KEY,
  REQUIRE_PERMISSIONS_KEY,
} from './guard-tokens';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PERMISSION_SERVICE_TOKEN)
    @Optional()
    private readonly permissionService: IPermissionService,
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

    const isInternalService = (request as any).isInternalService;
    if (isInternalService) {
      this.logger.info('Skipping permission check for internal service', {
        service: (request as any).internalServiceName,
        tenantId: (request as any).tenantId,
      });
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const userId = (request as any).userId;
    const isSystemAdmin = (request as any).isAdmin;
    const tenantId = (request as any).tenantId;

    if (!userId) {
      this.logger.warn('No valid authentication found, denying access');
      return false;
    }

    this.logger.debug('Checking permissions', {
      userId,
      tenantId,
      isSystemAdmin,
      requiredPermissions,
    });

    let hasPermission = true;
    if (this.permissionService) {
      hasPermission = await this.permissionService.hasAllPermissions({
        userId,
        tenantId,
        permissions: requiredPermissions,
        isSystemAdmin,
      });
    }

    if (!hasPermission) {
      this.logger.warn('Permission check failed', {
        userId,
        tenantId,
        isSystemAdmin,
        requiredPermissions,
      });
      throw new ForbiddenException('Insufficient permissions');
    }

    this.logger.debug('Permission check passed', {
      userId,
      tenantId,
      requiredPermissions,
    });

    return true;
  }
}