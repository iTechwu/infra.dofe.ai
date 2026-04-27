/**
 * NotificationService - 通知服务
 *
 * 负责：
 * - 多渠道通知发送（邮件、Webhook、Slack）
 * - 通知模板管理
 * - 通知历史记录
 * - 通知偏好设置
 */
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * 通知渠道
 */
export type NotificationChannel = 'email' | 'webhook' | 'slack' | 'wechat';

/**
 * 通知优先级
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * 通知状态
 */
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'retrying';

/**
 * 通知请求
 */
export interface NotificationRequest {
  id?: string;
  channel: NotificationChannel;
  recipients: string[];
  subject?: string;
  content: string;
  htmlContent?: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  templateId?: string;
  templateData?: Record<string, unknown>;
  scheduledAt?: Date;
  expiresAt?: Date;
}

/**
 * 通知记录
 */
export interface NotificationRecord {
  id: string;
  requestId: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  content: string;
  status: NotificationStatus;
  priority: NotificationPriority;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  sentAt?: Date;
  failedAt?: Date;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 通知模板
 */
export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject?: string;
  content: string;
  htmlContent?: string;
  variables: string[];
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 通知偏好设置
 */
export interface NotificationPreferences {
  id: string;
  userId?: string;
  tenantId?: string;
  channels: {
    email: { enabled: boolean; address?: string };
    webhook: { enabled: boolean; url?: string };
    slack: { enabled: boolean; webhookUrl?: string };
    wechat: { enabled: boolean; webhookUrl?: string };
  };
  quietHours?: {
    enabled: boolean;
    start: string; // HH:mm
    end: string; // HH:mm
    timezone: string;
  };
  priorities: {
    low: boolean;
    normal: boolean;
    high: boolean;
    critical: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 通知统计
 */
export interface NotificationStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  byChannel: Record<NotificationChannel, { sent: number; failed: number }>;
  byPriority: Record<NotificationPriority, number>;
}

/**
 * Webhook 负载
 */
export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
  signature?: string;
}

@Injectable()
export class NotificationService implements OnModuleInit {
  // 内存存储
  private templates = new Map<string, NotificationTemplate>();
  private preferences = new Map<string, NotificationPreferences>();
  private records = new Map<string, NotificationRecord>();
  private readonly MAX_RECORDS = 10000;

  // 重试配置
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAYS_MS = [1000, 5000, 15000];

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly eventEmitter: EventEmitter2,
    private readonly httpService: HttpService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.info('[Notification] Service initialized');
    this.initializeDefaultTemplates();
    this.startRetryProcessor();
  }

  // ==================== 发送通知 ====================

  /**
   * 发送通知
   */
  async send(request: NotificationRequest): Promise<{
    success: boolean;
    records: NotificationRecord[];
    errors?: string[];
  }> {
    const requestId = request.id || this.generateId('req');
    const records: NotificationRecord[] = [];
    const errors: string[] = [];

    // 应用模板（如果指定）
    let content = request.content;
    let htmlContent = request.htmlContent;
    let subject = request.subject;

    if (request.templateId) {
      const template = this.templates.get(request.templateId);
      if (template) {
        content = this.renderTemplate(
          template.content,
          request.templateData || {},
        );
        htmlContent = template.htmlContent
          ? this.renderTemplate(
              template.htmlContent,
              request.templateData || {},
            )
          : undefined;
        subject = template.subject
          ? this.renderTemplate(template.subject, request.templateData || {})
          : subject;
      }
    }

    // 检查静默时段
    if (this.isQuietHours(request.metadata?.userId as string)) {
      this.logger.info('[Notification] Skipping due to quiet hours', {
        requestId,
      });
      return { success: true, records: [], errors: ['Quiet hours'] };
    }

    // 发送到每个接收者
    for (const recipient of request.recipients) {
      const record = await this.sendToRecipient(
        requestId,
        request.channel,
        recipient,
        subject,
        content,
        htmlContent,
        request.priority || 'normal',
        request.metadata,
      );
      records.push(record);

      if (record.status === 'failed') {
        errors.push(`Failed to send to ${recipient}: ${record.errorMessage}`);
      }
    }

    const success = records.some((r) => r.status === 'sent');

    return { success, records, errors: errors.length > 0 ? errors : undefined };
  }

  /**
   * 发送到单个接收者
   */
  private async sendToRecipient(
    requestId: string,
    channel: NotificationChannel,
    recipient: string,
    subject?: string,
    content?: string,
    htmlContent?: string,
    priority: NotificationPriority = 'normal',
    metadata?: Record<string, unknown>,
  ): Promise<NotificationRecord> {
    const recordId = this.generateId('rec');
    const now = new Date();

    const record: NotificationRecord = {
      id: recordId,
      requestId,
      channel,
      recipient,
      subject,
      content: content || '',
      status: 'pending',
      priority,
      attempts: 0,
      maxAttempts: this.MAX_RETRY_ATTEMPTS,
      metadata,
      createdAt: now,
      updatedAt: now,
    };

    try {
      let success = false;

      switch (channel) {
        case 'email':
          success = await this.sendEmail(
            recipient,
            subject || '',
            content || '',
            htmlContent,
          );
          break;
        case 'webhook':
          success = await this.sendWebhook(
            recipient,
            (metadata?.event as string) || 'notification',
            (metadata?.data as Record<string, unknown>) || {},
          );
          break;
        case 'slack':
          success = await this.sendSlack(
            recipient,
            content || '',
            metadata?.slackBlocks,
          );
          break;
        case 'wechat':
          success = await this.sendWechat(recipient, content || '');
          break;
        default:
          throw new Error(`Unsupported channel: ${channel}`);
      }

      record.status = 'sent';
      record.sentAt = new Date();
      record.attempts++;

      this.logger.info('[Notification] Sent successfully', {
        recordId,
        channel,
        recipient,
      });
    } catch (error) {
      record.status = 'failed';
      record.failedAt = new Date();
      record.attempts++;
      record.errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error('[Notification] Send failed', {
        recordId,
        channel,
        recipient,
        error: record.errorMessage,
      });
    }

    record.lastAttemptAt = new Date();
    record.updatedAt = new Date();

    // 存储记录
    this.storeRecord(record);

    return record;
  }

  /**
   * 发送邮件
   */
  private async sendEmail(
    to: string,
    subject: string,
    content: string,
    htmlContent?: string,
  ): Promise<boolean> {
    // 这里应该调用实际的邮件服务
    // 目前只是模拟
    this.logger.debug('[Notification] Sending email', { to, subject });
    return true;
  }

  /**
   * 发送 Webhook
   */
  private async sendWebhook(
    url: string,
    event: string,
    data: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data,
      };

      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Notification-Event': event,
          },
          timeout: 10000,
        }),
      );

      return response.status >= 200 && response.status < 300;
    } catch (error) {
      this.logger.error('[Notification] Webhook failed', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 发送 Slack 消息
   */
  private async sendSlack(
    webhookUrl: string,
    content: string,
    blocks?: unknown,
  ): Promise<boolean> {
    try {
      const payload = {
        text: content,
        blocks: blocks || undefined,
      };

      const response = await firstValueFrom(
        this.httpService.post(webhookUrl, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }),
      );

      return response.status === 200;
    } catch (error) {
      this.logger.error('[Notification] Slack failed', {
        webhookUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 发送企业微信消息
   */
  private async sendWechat(
    webhookUrl: string,
    content: string,
  ): Promise<boolean> {
    try {
      const payload = {
        msgtype: 'text',
        text: { content },
      };

      const response = await firstValueFrom(
        this.httpService.post(webhookUrl, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }),
      );

      return response.status === 200 && response.data?.errcode === 0;
    } catch (error) {
      this.logger.error('[Notification] Wechat failed', {
        webhookUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  // ==================== 模板管理 ====================

  /**
   * 创建模板
   */
  createTemplate(
    template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>,
  ): NotificationTemplate {
    const id = this.generateId('tpl');
    const now = new Date();

    const newTemplate: NotificationTemplate = {
      ...template,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.templates.set(id, newTemplate);

    this.logger.info('[Notification] Created template', {
      id,
      name: template.name,
    });
    return newTemplate;
  }

  /**
   * 获取模板
   */
  getTemplate(id: string): NotificationTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * 获取所有模板
   */
  getTemplates(channel?: NotificationChannel): NotificationTemplate[] {
    let templates = Array.from(this.templates.values());
    if (channel) {
      templates = templates.filter((t) => t.channel === channel);
    }
    return templates.filter((t) => t.isEnabled);
  }

  /**
   * 渲染模板
   */
  private renderTemplate(
    template: string,
    data: Record<string, unknown>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return String(data[key] ?? `{{${key}}}`);
    });
  }

  // ==================== 偏好设置 ====================

  /**
   * 设置通知偏好
   */
  setPreferences(
    prefs: Omit<NotificationPreferences, 'id' | 'createdAt' | 'updatedAt'>,
  ): NotificationPreferences {
    const id = this.generateId('pref');
    const now = new Date();

    const newPrefs: NotificationPreferences = {
      ...prefs,
      id,
      createdAt: now,
      updatedAt: now,
    };

    // 如果已有相同用户/租户的偏好，更新之
    for (const [existingId, existing] of this.preferences) {
      if (
        (prefs.userId && existing.userId === prefs.userId) ||
        (prefs.tenantId && existing.tenantId === prefs.tenantId)
      ) {
        newPrefs.id = existingId;
        newPrefs.createdAt = existing.createdAt;
        this.preferences.delete(existingId);
        break;
      }
    }

    this.preferences.set(newPrefs.id, newPrefs);
    return newPrefs;
  }

  /**
   * 获取通知偏好
   */
  getPreferences(
    userId?: string,
    tenantId?: string,
  ): NotificationPreferences | undefined {
    for (const prefs of this.preferences.values()) {
      if (userId && prefs.userId === userId) return prefs;
      if (tenantId && prefs.tenantId === tenantId) return prefs;
    }
    return undefined;
  }

  /**
   * 检查是否在静默时段
   */
  private isQuietHours(userId?: string): boolean {
    if (!userId) return false;

    const prefs = this.getPreferences(userId);
    if (!prefs?.quietHours?.enabled) return false;

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm

    const { start, end } = prefs.quietHours;

    // 处理跨午夜的情况
    if (start > end) {
      return currentTime >= start || currentTime < end;
    }

    return currentTime >= start && currentTime < end;
  }

  // ==================== 记录和统计 ====================

  /**
   * 存储记录
   */
  private storeRecord(record: NotificationRecord): void {
    this.records.set(record.id, record);

    // 限制记录数量
    if (this.records.size > this.MAX_RECORDS) {
      const oldestKey = this.records.keys().next().value;
      if (oldestKey) {
        this.records.delete(oldestKey);
      }
    }
  }

  /**
   * 获取通知记录
   */
  getRecords(filters?: {
    channel?: NotificationChannel;
    status?: NotificationStatus;
    recipient?: string;
    limit?: number;
  }): NotificationRecord[] {
    let records = Array.from(this.records.values());

    if (filters) {
      if (filters.channel) {
        records = records.filter((r) => r.channel === filters.channel);
      }
      if (filters.status) {
        records = records.filter((r) => r.status === filters.status);
      }
      if (filters.recipient) {
        records = records.filter((r) => r.recipient === filters.recipient);
      }
    }

    // 按创建时间倒序
    records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return records.slice(0, filters?.limit || 100);
  }

  /**
   * 获取统计
   */
  getStats(): NotificationStats {
    const records = Array.from(this.records.values());

    const stats: NotificationStats = {
      total: records.length,
      sent: records.filter((r) => r.status === 'sent').length,
      failed: records.filter((r) => r.status === 'failed').length,
      pending: records.filter((r) => r.status === 'pending').length,
      byChannel: {
        email: { sent: 0, failed: 0 },
        webhook: { sent: 0, failed: 0 },
        slack: { sent: 0, failed: 0 },
        wechat: { sent: 0, failed: 0 },
      },
      byPriority: {
        low: 0,
        normal: 0,
        high: 0,
        critical: 0,
      },
    };

    for (const record of records) {
      if (record.status === 'sent') {
        stats.byChannel[record.channel].sent++;
      } else if (record.status === 'failed') {
        stats.byChannel[record.channel].failed++;
      }
      stats.byPriority[record.priority]++;
    }

    return stats;
  }

  // ==================== 重试机制 ====================

  /**
   * 启动重试处理器
   */
  private startRetryProcessor(): void {
    setInterval(
      () => this.processRetries(),
      60000, // 每分钟检查一次
    );
  }

  /**
   * 处理重试
   */
  private processRetries(): void {
    const now = Date.now();

    for (const record of this.records.values()) {
      if (record.status !== 'failed' && record.status !== 'retrying') continue;
      if (record.attempts >= record.maxAttempts) continue;

      // 检查重试延迟
      const delayIndex = Math.min(
        record.attempts - 1,
        this.RETRY_DELAYS_MS.length - 1,
      );
      const delay = this.RETRY_DELAYS_MS[delayIndex];
      const lastAttempt = record.lastAttemptAt?.getTime() || 0;

      if (now - lastAttempt < delay) continue;

      // 重新发送
      this.retryRecord(record);
    }
  }

  /**
   * 重试单条记录
   */
  private async retryRecord(record: NotificationRecord): Promise<void> {
    record.status = 'retrying';
    record.updatedAt = new Date();

    this.logger.info('[Notification] Retrying notification', {
      recordId: record.id,
      attempt: record.attempts + 1,
    });

    try {
      let success = false;

      switch (record.channel) {
        case 'email':
          success = await this.sendEmail(
            record.recipient,
            record.subject || '',
            record.content,
          );
          break;
        case 'webhook':
          success = await this.sendWebhook(
            record.recipient,
            (record.metadata?.event as string) || 'notification',
            (record.metadata?.data as Record<string, unknown>) || {},
          );
          break;
        case 'slack':
          success = await this.sendSlack(record.recipient, record.content);
          break;
        case 'wechat':
          success = await this.sendWechat(record.recipient, record.content);
          break;
      }

      if (success) {
        record.status = 'sent';
        record.sentAt = new Date();
      } else {
        record.status = 'failed';
        record.failedAt = new Date();
      }
    } catch (error) {
      record.status = 'failed';
      record.failedAt = new Date();
      record.errorMessage =
        error instanceof Error ? error.message : String(error);
    }

    record.attempts++;
    record.lastAttemptAt = new Date();
    record.updatedAt = new Date();

    this.records.set(record.id, record);
  }

  // ==================== 工具方法 ====================

  /**
   * 生成 ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 初始化默认模板
   */
  private initializeDefaultTemplates(): void {
    // 预算预警模板
    this.createTemplate({
      name: 'budget-warning',
      channel: 'email',
      subject: 'Budget Warning: {{budgetName}}',
      content: `Your budget "{{budgetName}}" has reached {{percentage}}% of its limit.\n\nUsed: {{used}} {{currency}}\nLimit: {{limit}} {{currency}}\n\nPlease review your usage.`,
      variables: ['budgetName', 'percentage', 'used', 'limit', 'currency'],
      isEnabled: true,
    });

    // 预算超限模板
    this.createTemplate({
      name: 'budget-exceeded',
      channel: 'email',
      subject: 'Budget Exceeded: {{budgetName}}',
      content: `Your budget "{{budgetName}}" has been exceeded.\n\nUsed: {{used}} {{currency}}\nLimit: {{limit}} {{currency}}\n\nFurther requests may be blocked until the budget is reset.`,
      variables: ['budgetName', 'used', 'limit', 'currency'],
      isEnabled: true,
    });

    // Webhook 通知模板
    this.createTemplate({
      name: 'webhook-notification',
      channel: 'webhook',
      content: '{{message}}',
      variables: ['message'],
      isEnabled: true,
    });

    this.logger.info('[Notification] Default templates initialized');
  }
}
