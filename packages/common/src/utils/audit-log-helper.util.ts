/**
 * Audit Log Helper
 *
 * 提供审计日志创建时的辅助功能，包括签名生成和敏感数据脱敏
 *
 * 使用方式：
 * 1. 在调用 OperateLogService.create() 前，使用 prepareAuditLogWithSignature() 准备数据
 * 2. 签名会自动添加到数据中
 * 3. 敏感数据会自动脱敏
 */
import type { Prisma } from '@prisma/client';
import {
  generateAuditSignature,
  type AuditSignaturePayload,
} from './audit-signature.util';
import { maskSensitiveData } from '@dofe/infra-utils';
import { auditConfig } from '../config/env-config.service';

/** Audit log create data — uses loose typing since the Prisma schema may evolve */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuditLogData = Record<string, any>;

/**
 * 从 Prisma 创建输入中提取签名载荷
 */
function extractSignaturePayload(
  data: AuditLogData,
): AuditSignaturePayload {
  return {
    userId: extractUserId(data),
    operateType: data.operateType as string,
    target: data.target as string,
    targetId: extractTargetId(data),
    targetName: (data as any).targetName ?? null,
    createdAt: (data as any).createdAt ?? new Date(),
    tenantId: extractTenantId(data),
    result: data.result ?? 'success',
  };
}

/**
 * 从 Prisma 关联数据中提取用户 ID
 */
function extractUserId(data: AuditLogData): string {
  if (data.user?.connect?.id) {
    return data.user.connect.id;
  }
  throw new Error('OperateLog must have user.connect.id');
}

/**
 * 从 Prisma 关联数据中提取目标 ID
 */
function extractTargetId(data: AuditLogData): string | null {
  return (data as any).targetId ?? null;
}

/**
 * 从 Prisma 关联数据中提取租户 ID
 */
function extractTenantId(data: AuditLogData): string | null {
  if (data.tenant?.connect?.id) {
    return data.tenant.connect.id;
  }
  return null;
}

/**
 * 脱敏审计日志中的敏感字段
 */
function maskDetailFields(
  detail: Prisma.InputJsonValue | undefined,
): Prisma.InputJsonValue | undefined {
  if (!detail || typeof detail !== 'object') {
    return detail;
  }

  // 可通过环境变量关闭脱敏（不建议生产环境关闭）
  if (auditConfig.maskEnabled === false) {
    return detail;
  }

  // 对 detail 对象进行脱敏处理
  return maskSensitiveData(
    detail as Record<string, unknown>,
  ) as Prisma.InputJsonValue;
}

/**
 * 为审计日志数据添加签名并脱敏敏感数据
 *
 * @param data Prisma 创建输入数据
 * @returns 带签名且脱敏后的数据
 *
 * @example
 * ```typescript
 * const data = prepareAuditLogWithSignature({
 *   user: { connect: { id: userId } },
 *   operateType: 'CREATE',
 *   target: 'BOT',
 *   targetId: botId,
 *   detail: { apiKey: 'sk-xxxx' }, // 会被脱敏为 { apiKey: 'sk-***' }
 * });
 *
 * await operateLogService.create(data);
 * ```
 */
export function prepareAuditLogWithSignature<T extends AuditLogData>(
  data: T,
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = extractSignaturePayload(data as any);
  const signature = generateAuditSignature(payload);

  // 脱敏 detail 字段中的敏感数据
  const maskedDetail = maskDetailFields(data.detail as Prisma.InputJsonValue);

  return {
    ...data,
    detail: maskedDetail,
    signature,
  };
}

/**
 * 验证审计日志记录的签名
 *
 * @param log 审计日志记录
 * @returns 验证是否通过
 */
export function verifyAuditLogSignature(
  log: {
    operateType?: unknown;
    target?: unknown;
    targetId?: unknown;
    targetName?: unknown;
    tenant?: any;
    result?: unknown;
    userId: string;
    signature?: string | null;
    createdAt: Date | string;
  },
): boolean {
  if (!log.signature) {
    return false;
  }

  const payload: AuditSignaturePayload = {
    userId: log.userId,
    operateType: log.operateType as string,
    target: log.target as string,
    targetId: (log.targetId as string) ?? null,
    targetName: (log.targetName as string) ?? null,
    createdAt: log.createdAt,
    tenantId: log.tenant?.connect?.id ?? null,
    result: (log.result as string) ?? 'success',
  };

  const { verifyAuditSignature: verify } = require('./audit-signature.util');
  return verify(payload, log.signature);
}
