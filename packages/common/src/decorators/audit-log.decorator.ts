import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditLogOptions {
  /**
   * 操作类型
   */
  operateType: string;
  /**
   * 操作目标类型
   */
  target: string;
  /**
   * 目标 ID 提取路径（从请求参数中提取）
   * 支持点号分隔的路径，如 'params.id' 或 'body.botId'
   */
  targetIdPath?: string;
  /**
   * 目标名称提取路径
   */
  targetNamePath?: string;
  /**
   * 是否记录变更前数据（需要先查询）
   */
  recordBeforeData?: boolean;
  /**
   * 自定义描述
   */
  description?: string;
}

/**
 * 审计日志装饰器
 *
 * 用于标记需要记录审计日志的方法
 *
 * @example
 * ```typescript
 * @AuditLog({ operateType: 'CREATE', target: 'BOT', targetIdPath: 'body.id' })
 * async createBot(@Body() body: CreateBotDto) { ... }
 * ```
 */
export const AuditLog = (options: AuditLogOptions) =>
  SetMetadata(AUDIT_LOG_KEY, options);
