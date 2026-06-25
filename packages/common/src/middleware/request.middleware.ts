import {
  Inject,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { IncomingMessage, ServerResponse } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

import { getReqMainInfo } from '@dofe/infra-utils';
import * as parser from 'accept-language-parser';
import ipUtil from '@dofe/infra-utils/ip.util';
import environment from '@dofe/infra-utils/environment.util';

// Trace ID 请求头名称
export const TRACE_ID_HEADER = 'x-trace-id';

export interface RequestDbOperationStats {
  model: string;
  action: string;
  dbType: 'read' | 'write';
  count: number;
  totalDurationMs: number;
  maxDurationMs: number;
  slowCount: number;
  errorCount: number;
}

export interface RequestDbSummary {
  totalQueries: number;
  totalDurationMs: number;
  maxDurationMs: number;
  slowQueryCount: number;
  errorCount: number;
  operations: Map<string, RequestDbOperationStats>;
}

export interface RequestContext {
  traceID: string;
  dbSummary?: RequestDbSummary;
}

export const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/** @deprecated Use asyncLocalStorage instead */
export const clsNamespace = {
  run: (fn: () => void) => asyncLocalStorage.run({ traceID: '' }, fn),
  set: (key: string, value: any) => {
    const store = asyncLocalStorage.getStore();
    if (store) (store as any)[key] = value;
  },
  get: (key: string) => asyncLocalStorage.getStore()?.[key as keyof RequestContext],
};

/**
 * 获取或生成 Trace ID
 * 优先从请求头获取 (支持分布式追踪)，否则生成新的 UUID
 */
function getOrCreateTraceId(req: IncomingMessage | FastifyRequest): string {
  const headerTraceId = req.headers[TRACE_ID_HEADER];
  if (headerTraceId && typeof headerTraceId === 'string') {
    return headerTraceId;
  }
  return uuidv4();
}

function createRequestDbSummary(): RequestDbSummary {
  return {
    totalQueries: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    slowQueryCount: 0,
    errorCount: 0,
    operations: new Map<string, RequestDbOperationStats>(),
  };
}

export interface RecordRequestDbOperationParams {
  model: string;
  action: string;
  dbType: 'read' | 'write';
  durationMs: number;
  status: 'success' | 'error';
  isSlowQuery: boolean;
}

export function recordRequestDbOperation(
  params: RecordRequestDbOperationParams,
): void {
  const store = asyncLocalStorage.getStore();
  if (!store) return;

  const summary = store.dbSummary ?? createRequestDbSummary();
  store.dbSummary = summary;

  const key = `${params.dbType}.${params.model}.${params.action}`;
  const operation = summary.operations.get(key) ?? {
    model: params.model,
    action: params.action,
    dbType: params.dbType,
    count: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    slowCount: 0,
    errorCount: 0,
  };

  operation.count += 1;
  operation.totalDurationMs += params.durationMs;
  operation.maxDurationMs = Math.max(operation.maxDurationMs, params.durationMs);
  if (params.isSlowQuery) operation.slowCount += 1;
  if (params.status === 'error') operation.errorCount += 1;

  summary.totalQueries += 1;
  summary.totalDurationMs += params.durationMs;
  summary.maxDurationMs = Math.max(summary.maxDurationMs, params.durationMs);
  if (params.isSlowQuery) summary.slowQueryCount += 1;
  if (params.status === 'error') summary.errorCount += 1;
  summary.operations.set(key, operation);
}

function getRequestDbSummaryLogData(
  summary: RequestDbSummary | undefined,
): Record<string, unknown> | null {
  if (!summary || summary.totalQueries === 0) return null;

  const operations = Array.from(summary.operations.values())
    .map((operation) => ({
      ...operation,
      averageDurationMs: Number(
        (operation.totalDurationMs / operation.count).toFixed(2),
      ),
    }))
    .sort((a, b) => b.totalDurationMs - a.totalDurationMs);

  return {
    category: 'db',
    event: 'request-db-summary',
    totalQueries: summary.totalQueries,
    totalDurationMs: summary.totalDurationMs,
    maxDurationMs: summary.maxDurationMs,
    slowQueryCount: summary.slowQueryCount,
    errorCount: summary.errorCount,
    operations,
  };
}

/**
 * RequestMiddleware
 *
 * 重要说明：在 Fastify 适配器下，NestMiddleware 的 use 方法接收的参数类型
 * 实际上是原生的 Node.js 对象（IncomingMessage 和 ServerResponse），
 * 而不是 Fastify 的封装对象（FastifyRequest 和 FastifyReply）。
 *
 * 这是因为：
 * 1. NestJS 中间件接口设计为接收原生对象，以保持与不同 HTTP 框架的兼容性
 * 2. Fastify 适配器通过 middie 包处理中间件，传递的是原生对象
 * 3. 虽然类型声明可以使用 FastifyRequest/FastifyReply，但运行时实际是原生对象
 *
 * 解决方案：
 * - 使用泛型参数明确指定类型：NestMiddleware<IncomingMessage, ServerResponse>
 * - 或者保持 any 类型，在运行时通过类型断言访问 Fastify 特有的属性
 */
@Injectable()
export default class RequestMiddleware implements NestMiddleware<
  IncomingMessage,
  ServerResponse
> {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async use(req: IncomingMessage, res: ServerResponse, next: () => void) {
    // 获取或生成 Trace ID (支持分布式追踪)
    const traceId = getOrCreateTraceId(req);

    // 添加到请求对象 (便于 Controller/Service 访问)
    // 注意：在中间件中，req 是原生 IncomingMessage
    // 但在 Controller 中，可以通过 context.switchToHttp().getRequest<FastifyRequest>() 获取 FastifyRequest
    (req as any).traceId = traceId;

    // 添加到响应头 (使用原生 Node.js API)
    res.setHeader(TRACE_ID_HEADER, traceId);

    // 解析语言
    const acceptLanguage = req.headers['accept-language'] || '';
    const languages = parser.parse(acceptLanguage);
    let primaryLanguage = languages[0]?.code || 'en';
    if (!['zh-CN', 'en'].includes(primaryLanguage)) {
      primaryLanguage = 'en';
    }
    (req as any).locale = primaryLanguage;

    // 提取 IP 地址
    // 注意：ipUtil.extractIp 期望 FastifyRequest，但中间件中接收的是 IncomingMessage
    // 这里使用类型断言，因为 IncomingMessage 和 FastifyRequest 在 headers 属性上兼容
    const realIp = ipUtil.extractIp(req as any);
    (req as any).realIp = realIp;

    asyncLocalStorage.run(
      { traceID: traceId, dbSummary: createRequestDbSummary() },
      () => {
        const store = asyncLocalStorage.getStore();

        res.once('finish', () => {
          const dbSummary = getRequestDbSummaryLogData(store?.dbSummary);
          if (dbSummary) {
            this.logger.info('Request DB Summary', {
              traceId,
              method: req.method,
              url: req.url,
              statusCode: res.statusCode,
              ...dbSummary,
            });
          }
        });

        next();
        // 记录日志 (包含 traceId)
        // 注意：getReqMainInfo 期望 FastifyRequest/FastifyReply，但中间件中是原生对象
        // 使用类型断言以兼容现有函数
        if (environment.isProduction()) {
          this.logger.info('RequestMiddleware', {
            traceId,
            ...getReqMainInfo(req as any, res as any),
          });
        }
      },
    );
  }
}
