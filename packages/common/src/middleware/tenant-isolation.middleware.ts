import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * 租户隔离中间件
 * 强制所有请求携带 tenantId，并注入到请求上下文
 */
@Injectable()
export class TenantIsolationMiddleware implements NestMiddleware {
  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    // 从 JWT 或请求头获取 tenantId
    const tenantId = this.extractTenantId(req);

    if (!tenantId) {
      throw new UnauthorizedException('Missing tenantId in request context');
    }

    // 验证用户是否属于该租户
    const user = (req as any).user;
    if (user && !this.userBelongsToTenant(user, tenantId)) {
      throw new UnauthorizedException('Access denied to this tenant');
    }

    // 注入 tenantId 到请求对象
    (req as any).tenantId = tenantId;

    next();
  }

  private extractTenantId(req: FastifyRequest): string | null {
    // 1. 从请求头获取
    const headerTenantId = req.headers['x-tenant-id'] as string;
    if (headerTenantId) return headerTenantId;

    // 2. 从 JWT 用户信息获取
    const user = (req as any).user;
    if (user?.currentTenantId) return user.currentTenantId;

    return null;
  }

  private userBelongsToTenant(user: any, tenantId: string): boolean {
    // 检查用户是否属于该租户
    return (
      user.tenants?.includes(tenantId) || user.currentTenantId === tenantId
    );
  }
}
