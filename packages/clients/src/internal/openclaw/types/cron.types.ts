/**
 * OpenClaw Cron API 类型定义
 *
 * 基于 OpenClaw 官方文档:
 * https://docs.openclaw.ai/automation/cron
 */

/**
 * Cron 调度配置
 */
export type CronSchedule =
  | { kind: 'at'; at: string } // 一次性: ISO 8601 时间戳
  | { kind: 'every'; everyMs: number } // 固定间隔: 毫秒
  | { kind: 'cron'; expr: string; tz?: string }; // Cron 表达式 + 时区

/**
 * Cron 执行负载
 */
export type CronPayload =
  | { kind: 'systemEvent'; text: string } // Main session: 系统事件
  | {
      kind: 'agentTurn'; // Isolated session: Agent turn
      message: string;
      model?: string;
      thinking?: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
      timeoutSeconds?: number;
    };

/**
 * Cron 交付配置
 */
export interface CronDelivery {
  mode: 'none' | 'announce' | 'webhook';
  channel?: 'whatsapp' | 'telegram' | 'slack' | 'discord' | 'last';
  to?: string; // 目标地址 (channel 或 webhook URL)
  bestEffort?: boolean; // 交付失败不影响任务成功
}

/**
 * Cron 任务定义
 */
export interface CronJob {
  jobId: string; // 任务 ID (Gateway 生成)
  name: string; // 任务名称
  description?: string; // 任务描述
  schedule: CronSchedule; // 调度配置
  sessionTarget: 'main' | 'isolated'; // 执行模式
  wakeMode?: 'now' | 'next-heartbeat'; // 唤醒模式
  payload: CronPayload; // 执行负载
  delivery?: CronDelivery; // 交付配置
  enabled: boolean; // 是否启用
  deleteAfterRun?: boolean; // 一次性任务
  agentId?: string; // 绑定的 Agent ID
  nextRun?: string; // 下次执行时间 (ISO 8601)
  lastRun?: string; // 上次执行时间 (ISO 8601)
  createdAt: string; // 创建时间
  updatedAt: string; // 更新时间
}

/**
 * Cron 任务执行记录
 */
export interface CronRun {
  runId: string; // 运行 ID
  jobId: string; // 任务 ID
  startedAt: string; // 开始时间 (ISO 8601)
  endedAt?: string; // 结束时间 (ISO 8601)
  status: 'running' | 'success' | 'failure'; // 执行状态
  duration?: number; // 执行耗时 (毫秒)
  error?: string; // 错误信息
  result?: unknown; // 执行结果
}

/**
 * 创建 Cron 任务参数
 */
export interface AddCronJobParams {
  name: string;
  description?: string;
  schedule: CronSchedule;
  sessionTarget: 'main' | 'isolated';
  wakeMode?: 'now' | 'next-heartbeat';
  payload: CronPayload;
  delivery?: CronDelivery;
  enabled?: boolean;
  deleteAfterRun?: boolean;
  agentId?: string;
}

/**
 * 更新 Cron 任务参数
 */
export interface UpdateCronJobPatch {
  name?: string;
  description?: string;
  schedule?: CronSchedule;
  payload?: CronPayload;
  delivery?: CronDelivery;
  enabled?: boolean;
  agentId?: string | null; // null 表示清除 agentId
}

/**
 * Cron 调度器状态
 */
export interface CronSchedulerStatus {
  enabled: boolean; // 调度器是否启用
  nextWakeAtMs?: number; // 下次唤醒时间 (Unix 时间戳毫秒)
  jobCount: number; // 任务总数
  enabledJobCount: number; // 启用的任务数
}
