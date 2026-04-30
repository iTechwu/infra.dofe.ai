import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Optional,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError, of } from 'rxjs';
import { FastifyRequest } from 'fastify';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import {
  AUDIT_LOG_KEY,
  AuditLogOptions,
} from '../../decorators/audit-log.decorator';
import { OperateLogService } from '@app/db';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    @Optional()
    @Inject(OperateLogService)
    private readonly operateLogService?: OperateLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditOptions = this.reflector.getAllAndOverride<AuditLogOptions>(
      AUDIT_LOG_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!auditOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const { user, tenantId } = this.extractContext(request);

    if (!user?.id) {
      this.logger.warn('[AuditLog] No user context, skipping audit log');
      return next.handle();
    }

    const startTime = Date.now();
    const targetId = this.extractValue(request, auditOptions.targetIdPath);
    const targetName = this.extractValue(request, auditOptions.targetNamePath);

    return next.handle().pipe(
      tap(async (response) => {
        await this.recordLog({
          auditOptions,
          userId: user.id,
          tenantId: tenantId || null,
          targetId,
          targetName,
          request,
          result: 'success',
          afterData: response,
        });

        this.logger.info('[AuditLog] Operation completed', {
          operateType: auditOptions.operateType,
          target: auditOptions.target,
          targetId,
          userId: user.id,
          tenantId,
          duration: Date.now() - startTime,
        });
      }),
      catchError(async (error: Error) => {
        await this.recordLog({
          auditOptions,
          userId: user.id,
          tenantId: tenantId || null,
          targetId,
          targetName,
          request,
          result: 'failure',
          errorMessage: error.message,
        });

        this.logger.error('[AuditLog] Operation failed', {
          operateType: auditOptions.operateType,
          target: auditOptions.target,
          targetId,
          userId: user.id,
          tenantId,
          error: error.message,
          duration: Date.now() - startTime,
        });

        throw error;
      }),
    );
  }

  private extractContext(request: FastifyRequest): {
    user?: { id: string };
    tenantId?: string;
  } {
    // 从 request 中提取用户和租户信息
    // 这些信息通常由认证中间件注入
    const user = (request as any).user;
    const tenantId = (request as any).tenantId;
    return { user, tenantId };
  }

  private extractValue(
    request: FastifyRequest,
    path?: string,
  ): string | undefined {
    if (!path) return undefined;

    const parts = path.split('.');
    let value: any = request;

    for (const part of parts) {
      if (value === undefined || value === null) return undefined;
      value = value[part];
    }

    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') return value;
    return String(value);
  }

  private async recordLog(params: {
    auditOptions: AuditLogOptions;
    userId: string;
    tenantId: string | null;
    targetId?: string;
    targetName?: string;
    request: FastifyRequest;
    result: string;
    beforeData?: unknown;
    afterData?: unknown;
    errorMessage?: string;
  }): Promise<void> {
    if (!this.operateLogService) {
      this.logger.warn('[AuditLog] OperateLogService not available');
      return;
    }

    try {
      const data: any = {
        operateType: params.auditOptions.operateType,
        target: params.auditOptions.target,
        targetId: params.targetId,
        targetName: params.targetName,
        detail: params.auditOptions.description
          ? { description: params.auditOptions.description }
          : undefined,
        beforeData: params.beforeData,
        afterData: params.afterData,
        ipAddress: params.request.ip,
        userAgent: params.request.headers['user-agent'],
        traceId: (params.request as any).traceId,
        result: params.result,
        errorMessage: params.errorMessage,
      };

      if (params.tenantId) {
        data.tenant = { connect: { id: params.tenantId } };
      }

      data.user = { connect: { id: params.userId } };

      await this.operateLogService.create(data);
    } catch (error) {
      this.logger.error('[AuditLog] Failed to record audit log', {
        error: (error as Error).message,
      });
    }
  }
}
