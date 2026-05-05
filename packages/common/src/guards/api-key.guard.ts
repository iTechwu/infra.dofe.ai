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
import { ALLOW_API_KEY_KEY } from '../decorators/api-key/api-key.decorator';

const API_KEY_HEADER = 'x-api-key' as const;
const SERVICE_NAME_HEADER = 'x-service-name' as const;

/**
 * API Key 守卫
 * 允许使用有效的 API Key 跳过部分验证（如用户认证、租户验证等）
 *
 * 安全特性：
 * 1. API Key 必须预定义在环境变量中
 * 2. 记录所有 API Key 调用日志
 * 3. 支持可选的租户强制验证
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly validApiKeys: Set<string>;
  private readonly enabled: boolean;

  constructor(
    private readonly reflector: Reflector,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    // 从环境变量加载 API Key（支持多个，逗号分隔）
    const apiKeyString =
      process.env.INTERNAL_API_KEYS || process.env.INTERNAL_API_KEY || '';
    this.validApiKeys = new Set(
      apiKeyString
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    );

    this.enabled = this.validApiKeys.size > 0;

    this.logger.info('ApiKeyGuard initialized', {
      keyCount: this.validApiKeys.size,
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 如果没有配置 API Key，跳过此守卫
    if (!this.enabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // 检查当前处理方法是否允许 API Key 访问
    const allowApiKey = this.reflector.getAllAndOverride<boolean>(
      ALLOW_API_KEY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!allowApiKey) {
      return true; // 不允许 API Key，继续其他验证
    }

    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      return true; // 无 API Key，继续正常验证流程
    }

    // 验证 API Key
    if (!this.validateApiKey(apiKey, request)) {
      return false;
    }

    // 设置内部服务标识
    this.setInternalServiceContext(request, apiKey);

    this.logger.info('API key authenticated successfully', {
      service: request.headers[SERVICE_NAME_HEADER] || 'unknown',
      ip: request.ip,
      tenantId: request.headers['x-current-tenant'] || 'none',
    });

    return true;
  }

  /**
   * 从请求中提取 API Key
   * 支持从 header 或 query 参数获取
   */
  private extractApiKey(request: FastifyRequest): string | undefined {
    // 优先从 header 获取
    const headerApiKey = request.headers[API_KEY_HEADER] as string;
    if (headerApiKey) {
      return headerApiKey;
    }

    // 从 query 参数获取（不推荐，仅用于某些特殊场景）
    const queryApiKey = (request.query as any)?.api_key as string;
    if (queryApiKey) {
      return queryApiKey;
    }

    return undefined;
  }

  /**
   * 验证 API Key
   */
  private validateApiKey(apiKey: string, request: FastifyRequest): boolean {
    // 检查 API Key 是否有效
    if (!this.validApiKeys.has(apiKey)) {
      this.logger.error('Invalid API key used', {
        apiKey: this.maskApiKey(apiKey),
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        service: request.headers[SERVICE_NAME_HEADER],
        path: request.url,
      });
      return false;
    }

    return true;
  }

  /**
   * 设置内部服务上下文
   */
  private setInternalServiceContext(
    request: FastifyRequest,
    apiKey: string,
  ): void {
    // 标记为内部服务
    (request as any).isInternalService = true;

    // 设置服务名称
    const serviceName = request.headers[SERVICE_NAME_HEADER] as string;
    (request as any).internalServiceName = serviceName || 'unknown';

    // 设置 API Key 标识（用于审计）
    (request as any).apiKeyId = this.getKeyId(apiKey);

    // 跳过租户验证（但仍需解析租户用于数据隔离）
    (request as any).skipTenantCheck = true;

    // 强制要求租户 Header（防止跨租户访问）
    const headerTenantId = request.headers['x-current-tenant'] as string;
    if (process.env.INTERNAL_API_REQUIRE_TENANT === 'true' && !headerTenantId) {
      this.logger.warn('API key used without required tenant header', {
        service: serviceName,
        path: request.url,
      });
      throw new Error('Tenant header (x-current-tenant) is required');
    }
  }

  /**
   * 遮蔽 API Key 用于日志记录
   */
  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '****';
    }
    return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
  }

  /**
   * 获取 API Key 标识符（用于区分不同的 Key）
   */
  private getKeyId(apiKey: string): string {
    return this.maskApiKey(apiKey);
  }
}
