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
import { ALLOW_API_KEY_KEY } from './guard-tokens';

const API_KEY_HEADER = 'x-api-key' as const;
const SERVICE_NAME_HEADER = 'x-service-name' as const;

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly validApiKeys: Set<string>;
  private readonly enabled: boolean;

  constructor(
    private readonly reflector: Reflector,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
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
    if (!this.enabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const allowApiKey = this.reflector.getAllAndOverride<boolean>(
      ALLOW_API_KEY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!allowApiKey) {
      return true;
    }

    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      return true;
    }

    if (!this.validateApiKey(apiKey, request)) {
      return false;
    }

    this.setInternalServiceContext(request, apiKey);

    this.logger.info('API key authenticated successfully', {
      service: request.headers[SERVICE_NAME_HEADER] || 'unknown',
      ip: request.ip,
      tenantId: request.headers['x-current-tenant'] || 'none',
    });

    return true;
  }

  private extractApiKey(request: FastifyRequest): string | undefined {
    const headerApiKey = request.headers[API_KEY_HEADER] as string;
    if (headerApiKey) {
      return headerApiKey;
    }

    const queryApiKey = (request.query as any)?.api_key as string;
    if (queryApiKey) {
      return queryApiKey;
    }

    return undefined;
  }

  private validateApiKey(apiKey: string, request: FastifyRequest): boolean {
    if (!this.validApiKeys.has(apiKey)) {
      this.logger.error('Invalid API key used', {
        apiKey: this.maskApiKey(apiKey),
        ip: request.ip,
        path: request.url,
      });
      return false;
    }

    return true;
  }

  private setInternalServiceContext(
    request: FastifyRequest,
    apiKey: string,
  ): void {
    (request as any).isInternalService = true;

    const serviceName = request.headers[SERVICE_NAME_HEADER] as string;
    (request as any).internalServiceName = serviceName || 'unknown';

    (request as any).apiKeyId = this.maskApiKey(apiKey);

    (request as any).skipTenantCheck = true;

    const headerTenantId = request.headers['x-current-tenant'] as string;
    if (process.env.INTERNAL_API_REQUIRE_TENANT === 'true' && !headerTenantId) {
      this.logger.warn('API key used without required tenant header', {
        service: serviceName,
        path: request.url,
      });
      throw new Error('Tenant header (x-current-tenant) is required');
    }
  }

  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '****';
    }
    return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
  }
}