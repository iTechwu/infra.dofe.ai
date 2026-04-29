import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Logger } from 'winston';
import { bigintUtil, isProduction, consoleLogger, LoggerLike } from '../utils';
import {
  DbMetricsService,
  QueryContext,
} from '../db-metrics/db-metrics.service';
import {
  isSoftDeleteModel,
  hasExplicitIsDeleted,
  QUERY_ACTIONS,
} from '../middleware/soft-delete.middleware';

// Dynamic require for PrismaClient from generated location
// This bypasses webpack's module resolution and allows runtime resolution
const dynamicRequire = typeof __non_webpack_require__ !== 'undefined'
  ? __non_webpack_require__
  : (typeof require !== 'undefined' ? require : (m: string) => eval('require')(m));

const { PrismaClient: PrismaClientRuntime } = dynamicRequire(
  `${process.cwd()}/generated/prisma-client`,
);

/**
 * Prisma Write Service
 */
@Injectable()
export class PrismaWriteService implements OnModuleInit, OnModuleDestroy {
  private basePrisma: PrismaClient;
  private extendedPrisma: PrismaClient | null = null;
  private prisma: PrismaClient;
  private initialized = false;
  private readonly logger: LoggerLike;

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject('WINSTON_LOGGER') winstonLogger?: Logger,
    @Optional() private readonly dbMetrics?: DbMetricsService,
  ) {
    this.logger = winstonLogger ?? consoleLogger;
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const poolConfig = {
      connectionString,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 300000,
      max: 20,
    };

    const adapter = new PrismaPg(poolConfig);
    this.basePrisma = new PrismaClientRuntime({ adapter });
    this.prisma = this.basePrisma;

    this.logger.info('[PrismaWriteService] Prisma client created (base client, will extend after connect)');
  }

  private setupExtensions(basePrisma: PrismaClient): PrismaClient {
    const dbMetrics = this.dbMetrics;
    const fallbackLog = this.fallbackLog.bind(this);
    const nonSoftDeleteModels: string[] =
      this.configService.get('prisma.nonSoftDeleteModels') ?? [];

    return basePrisma.$extends({
      query: {
        $allOperations({ operation, model, args, query }) {
          let processedArgs = args;
          if (
            isSoftDeleteModel(model, nonSoftDeleteModels) &&
            QUERY_ACTIONS.includes(operation)
          ) {
            const newArgs = { ...args };
            if (!newArgs.where) {
              newArgs.where = {};
            }

            if (!hasExplicitIsDeleted(newArgs.where)) {
              newArgs.where = {
                ...newArgs.where,
                isDeleted: false,
              };
            }
            processedArgs = newArgs;
          }

          const ctx: QueryContext = dbMetrics?.recordQueryStart() ?? {
            startTime: Date.now(),
            traceId: 'unknown',
          };

          const result = query(processedArgs);

          return result
            .then((res) => {
              const serialized = bigintUtil.serialize(res);
              if (dbMetrics) {
                dbMetrics.recordQueryEnd(
                  ctx,
                  {
                    model: model || 'unknown',
                    action: operation,
                    dbType: 'write',
                  },
                  'success',
                  processedArgs,
                );
              } else {
                fallbackLog(
                  ctx.startTime,
                  { model, action: operation, args: processedArgs },
                  'success',
                );
              }
              return serialized;
            })
            .catch((error) => {
              if (dbMetrics) {
                dbMetrics.recordQueryEnd(
                  ctx,
                  {
                    model: model || 'unknown',
                    action: operation,
                    dbType: 'write',
                  },
                  'error',
                  processedArgs,
                  error as Error,
                );
              } else {
                fallbackLog(
                  ctx.startTime,
                  { model, action: operation, args: processedArgs },
                  'error',
                  error as Error,
                );
              }
              throw error;
            });
        },
      },
    }) as any;
  }

  private fallbackLog(
    startTime: number,
    params: { model?: string; action: string; args?: unknown },
    status: 'success' | 'error',
    error?: Error,
  ): void {
    const duration = Date.now() - startTime;
    const logData = {
      message: 'WriteDB Query 执行信息',
      detail: {
        耗时: `${duration}ms`,
        时间: new Date().toISOString(),
        操作: `${params.model}.${params.action}`,
        参数: JSON.stringify(params.args),
        状态: status,
      },
    };

    if (status === 'error' && error) {
      this.logger.error({
        ...logData,
        error: { name: error.name, message: error.message },
      });
    } else if (duration > 1000) {
      this.logger.warn({
        message: 'WriteDB Query 性能警告',
        detail: {
          操作: `${params.model}.${params.action}`,
          耗时: `${duration}ms`,
          提示: '此操作的执行时间超过了1000ms，请考虑优化',
        },
      });
    } else {
      this.logger.info(logData);
    }
  }

  private validatePrismaClient(client: unknown, clientType: string): boolean {
    if (!client) {
      this.logger.warn(`[PrismaWriteService] ${clientType} client is null/undefined`);
      return false;
    }

    const prisma = client as Record<string, unknown>;
    const criticalModels: string[] =
      this.configService.get('prisma.criticalModels') ?? [];

    const missingModels: string[] = [];
    for (const model of criticalModels) {
      const modelDelegate = prisma[model];
      if (!modelDelegate) {
        missingModels.push(model);
        continue;
      }

      const delegate = modelDelegate as Record<string, unknown>;
      if (typeof delegate.findMany !== 'function') {
        missingModels.push(`${model}.findMany`);
      }
    }

    if (missingModels.length > 0) {
      this.logger.warn(
        `[PrismaWriteService] ${clientType} client missing models/methods: ${missingModels.join(', ')}`,
      );
      return false;
    }

    return true;
  }

  get client(): PrismaClient {
    return this.extendedPrisma || this.prisma;
  }

  get isReady(): boolean {
    return this.initialized;
  }

  async onModuleInit() {
    await this.basePrisma.$connect();
    this.logger.info('[PrismaWriteService] Database connected');

    try {
      const extended = this.setupExtensions(this.basePrisma);

      if (this.validatePrismaClient(extended, 'extended')) {
        this.extendedPrisma = extended;
        this.prisma = extended;
        this.logger.info('[PrismaWriteService] Using extended Prisma client with all models');
      } else {
        if (this.validatePrismaClient(this.basePrisma, 'base')) {
          this.prisma = this.basePrisma;
          this.logger.warn('[PrismaWriteService] Extended client missing models, using base client');
        } else {
          this.logger.error('[PrismaWriteService] Both clients missing models after connect!');
          this.prisma = this.basePrisma;
        }
      }
    } catch (error) {
      this.logger.error('[PrismaWriteService] Failed to setup extensions', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.prisma = this.basePrisma;
    }

    this.initialized = true;

    if (isProduction()) {
      this.logger.info('PrismaWriteService initialized');
    }
  }

  async onModuleDestroy() {
    try {
      await this.prisma.$disconnect();
    } catch (error) {
      this.logger.warn('Error disconnecting Prisma client', { error });
    }
    if (isProduction()) {
      this.logger.info('PrismaWriteService disconnected from database');
    }
  }
}