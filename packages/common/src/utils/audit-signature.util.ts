/**
 * Audit Signature Utility
 *
 * 提供审计日志签名生成和验证功能，防止日志被篡改
 *
 * 签名算法：HMAC-SHA256
 * 签名内容：关键字段按固定顺序拼接
 *
 * 使用方式：
 * 1. 创建日志时调用 generateAuditSignature() 生成签名
 * 2. 验证日志时调用 verifyAuditSignature() 验证完整性
 */
import * as crypto from 'crypto';
import { auditConfig, isProduction } from '../config/env-config.service';

/** 默认签名密钥（仅开发环境使用） */
const DEFAULT_SECRET = 'dev-audit-signature-secret-change-in-production';

/**
 * 获取签名密钥
 */
function getSecretKey(): string {
  const secret = auditConfig.signatureSecret;
  if (!secret) {
    if (isProduction()) {
      throw new Error(
        'Missing AUDIT_SIGNATURE_SECRET environment variable in production',
      );
    }
    return DEFAULT_SECRET;
  }
  return secret;
}

/**
 * 审计日志签名字段
 */
export interface AuditSignaturePayload {
  /** 用户 ID */
  userId: string;
  /** 操作类型 */
  operateType: string;
  /** 操作目标 */
  target: string;
  /** 目标 ID */
  targetId?: string | null;
  /** 目标名称 */
  targetName?: string | null;
  /** 创建时间（ISO 字符串） */
  createdAt: string | Date;
  /** 租户 ID */
  tenantId?: string | null;
  /** 操作结果 */
  result?: string;
  // === Q1 2027 审计链增强字段 ===
  /** 父事件 ID（因果链） */
  parentEventId?: string | null;
  /** 关联 ID（跨系统追踪） */
  correlationId?: string | null;
  /** 事件哈希 */
  eventHash?: string | null;
}

/**
 * 构建签名字符串
 * 按固定顺序拼接关键字段，确保签名一致性
 */
function buildSignatureString(payload: AuditSignaturePayload): string {
  const parts = [
    `userId:${payload.userId}`,
    `operateType:${payload.operateType}`,
    `target:${payload.target}`,
    `targetId:${payload.targetId ?? ''}`,
    `targetName:${payload.targetName ?? ''}`,
    `createdAt:${payload.createdAt instanceof Date ? payload.createdAt.toISOString() : payload.createdAt}`,
    `tenantId:${payload.tenantId ?? ''}`,
    `result:${payload.result ?? 'success'}`,
    // Q1 2027 审计链增强字段
    `parentEventId:${payload.parentEventId ?? ''}`,
    `correlationId:${payload.correlationId ?? ''}`,
    `eventHash:${payload.eventHash ?? ''}`,
  ];
  return parts.join('|');
}

/**
 * 生成审计日志签名
 *
 * @param payload 签名载荷
 * @returns HMAC-SHA256 签名（十六进制）
 */
export function generateAuditSignature(payload: AuditSignaturePayload): string {
  const secret = getSecretKey();
  const signatureString = buildSignatureString(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signatureString)
    .digest('hex');
  return signature;
}

/**
 * 验证审计日志签名
 *
 * @param payload 签名载荷
 * @param signature 待验证的签名
 * @returns 验证结果
 */
export function verifyAuditSignature(
  payload: AuditSignaturePayload,
  signature: string,
): boolean {
  if (!signature) {
    return false;
  }

  const expectedSignature = generateAuditSignature(payload);

  // 使用常量时间比较防止时序攻击
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  } catch {
    // 签名长度不匹配或格式错误
    return false;
  }
}

/**
 * 重新计算签名（用于数据修复）
 * 仅当需要修复损坏的签名时使用
 *
 * @param payload 签名载荷
 * @returns 新签名
 */
export function recalculateSignature(payload: AuditSignaturePayload): string {
  return generateAuditSignature(payload);
}

/**
 * 批量验证审计日志签名
 *
 * @param logs 日志列表
 * @returns 验证结果列表
 */
export function batchVerifySignatures(
  logs: Array<AuditSignaturePayload & { signature?: string | null }>,
): Array<{ id?: string; valid: boolean; error?: string }> {
  return logs.map((log) => {
    if (!log.signature) {
      return { valid: false, error: 'Missing signature' };
    }

    const { signature, ...payload } = log;
    const isValid = verifyAuditSignature(
      payload as AuditSignaturePayload,
      signature,
    );

    return {
      valid: isValid,
      error: isValid ? undefined : 'Signature mismatch',
    };
  });
}
