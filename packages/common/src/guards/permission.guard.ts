import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { FastifyRequest } from 'fastify';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OrganizationPermissionService } from '@app/tenant-management/organization-permission';
import {
  REQUIRE_PERMISSIONS_KEY,
  PUBLIC_ENDPOINT_KEY,
  Permission,
} from '@repo/constants';
import { JwtConfig } from '@/config/validation';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: OrganizationPermissionService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  /**
   * 从 Authorization header 中提取并验证 JWT token
   */
  private async extractUserFromToken(request: FastifyRequest): Promise<{
    userId: string;
    isAdmin: boolean;
  } | null> {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    try {
      const jwtConfig = this.configService.getOrThrow<JwtConfig>('jwt');
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtConfig.secret,
      });

      if (payload?.isAnonymity) {
        return null;
      }

      return {
        userId: payload?.sub,
        isAdmin: payload?.isAdmin || false,
      };
    } catch (error) {
      return null;
    }
  }

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

    // 如果是内部服务，跳过权限检查
    const isInternalService = (request as any).isInternalService;
    if (isInternalService) {
      this.logger.info('Skipping permission check for internal service', {
        service: (request as any).internalServiceName,
        tenantId: (request as any).tenantId,
      });
      return true;
    }

    // 获取需要的权限
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有权限要求，直接放行
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    let userId = (request as any).userId;
    let isSystemAdmin = (request as any).isAdmin;
    const tenantId = (request as any).tenantId;

    // 如果 userId 不存在（没有经过 AuthGuard），尝试从 JWT token 中解析
    if (!userId) {
      const user = await this.extractUserFromToken(request);
      if (!user || !user.userId) {
        this.logger.warn('No valid authentication found, denying access');
        throw new UnauthorizedException('Authentication required');
      }
      userId = user.userId;
      isSystemAdmin = user.isAdmin;

      // 将用户信息设置到 request 中，供后续使用
      (request as any).userId = userId;
      (request as any).isAdmin = isSystemAdmin;
    }

    // 检查权限
    this.logger.debug('Checking permissions', {
      userId,
      tenantId,
      isSystemAdmin,
      requiredPermissions,
    });

    const hasPermission = await this.permissionService.hasAllPermissions({
      userId,
      tenantId,
      permissions: requiredPermissions,
      isSystemAdmin,
    });

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
