/**
 * NotificationService - 通知服务
 *
 * 负责：
 * - 多渠道通知发送（邮件、Webhook、Slack）
 * - 通知模板管理
 * - 通知历史记录
 * - 通知偏好设置
 */
import { OnModuleInit } from '@nestjs/common';
import { Logger } from 'winston';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
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
        email: {
            enabled: boolean;
            address?: string;
        };
        webhook: {
            enabled: boolean;
            url?: string;
        };
        slack: {
            enabled: boolean;
            webhookUrl?: string;
        };
        wechat: {
            enabled: boolean;
            webhookUrl?: string;
        };
    };
    quietHours?: {
        enabled: boolean;
        start: string;
        end: string;
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
    byChannel: Record<NotificationChannel, {
        sent: number;
        failed: number;
    }>;
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
export declare class NotificationService implements OnModuleInit {
    private readonly logger;
    private readonly eventEmitter;
    private readonly httpService;
    private templates;
    private preferences;
    private records;
    private readonly MAX_RECORDS;
    private readonly MAX_RETRY_ATTEMPTS;
    private readonly RETRY_DELAYS_MS;
    constructor(logger: Logger, eventEmitter: EventEmitter2, httpService: HttpService);
    onModuleInit(): Promise<void>;
    /**
     * 发送通知
     */
    send(request: NotificationRequest): Promise<{
        success: boolean;
        records: NotificationRecord[];
        errors?: string[];
    }>;
    /**
     * 发送到单个接收者
     */
    private sendToRecipient;
    /**
     * 发送邮件
     */
    private sendEmail;
    /**
     * 发送 Webhook
     */
    private sendWebhook;
    /**
     * 发送 Slack 消息
     */
    private sendSlack;
    /**
     * 发送企业微信消息
     */
    private sendWechat;
    /**
     * 创建模板
     */
    createTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): NotificationTemplate;
    /**
     * 获取模板
     */
    getTemplate(id: string): NotificationTemplate | undefined;
    /**
     * 获取所有模板
     */
    getTemplates(channel?: NotificationChannel): NotificationTemplate[];
    /**
     * 渲染模板
     */
    private renderTemplate;
    /**
     * 设置通知偏好
     */
    setPreferences(prefs: Omit<NotificationPreferences, 'id' | 'createdAt' | 'updatedAt'>): NotificationPreferences;
    /**
     * 获取通知偏好
     */
    getPreferences(userId?: string, tenantId?: string): NotificationPreferences | undefined;
    /**
     * 检查是否在静默时段
     */
    private isQuietHours;
    /**
     * 存储记录
     */
    private storeRecord;
    /**
     * 获取通知记录
     */
    getRecords(filters?: {
        channel?: NotificationChannel;
        status?: NotificationStatus;
        recipient?: string;
        limit?: number;
    }): NotificationRecord[];
    /**
     * 获取统计
     */
    getStats(): NotificationStats;
    /**
     * 启动重试处理器
     */
    private startRetryProcessor;
    /**
     * 处理重试
     */
    private processRetries;
    /**
     * 重试单条记录
     */
    private retryRecord;
    /**
     * 生成 ID
     */
    private generateId;
    /**
     * 初始化默认模板
     */
    private initializeDefaultTemplates;
}
