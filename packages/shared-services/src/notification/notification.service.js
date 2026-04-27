"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
/**
 * NotificationService - 通知服务
 *
 * 负责：
 * - 多渠道通知发送（邮件、Webhook、Slack）
 * - 通知模板管理
 * - 通知历史记录
 * - 通知偏好设置
 */
const common_1 = require("@nestjs/common");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const event_emitter_1 = require("@nestjs/event-emitter");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
let NotificationService = class NotificationService {
    logger;
    eventEmitter;
    httpService;
    // 内存存储
    templates = new Map();
    preferences = new Map();
    records = new Map();
    MAX_RECORDS = 10000;
    // 重试配置
    MAX_RETRY_ATTEMPTS = 3;
    RETRY_DELAYS_MS = [1000, 5000, 15000];
    constructor(logger, eventEmitter, httpService) {
        this.logger = logger;
        this.eventEmitter = eventEmitter;
        this.httpService = httpService;
    }
    async onModuleInit() {
        this.logger.info('[Notification] Service initialized');
        this.initializeDefaultTemplates();
        this.startRetryProcessor();
    }
    // ==================== 发送通知 ====================
    /**
     * 发送通知
     */
    async send(request) {
        const requestId = request.id || this.generateId('req');
        const records = [];
        const errors = [];
        // 应用模板（如果指定）
        let content = request.content;
        let htmlContent = request.htmlContent;
        let subject = request.subject;
        if (request.templateId) {
            const template = this.templates.get(request.templateId);
            if (template) {
                content = this.renderTemplate(template.content, request.templateData || {});
                htmlContent = template.htmlContent
                    ? this.renderTemplate(template.htmlContent, request.templateData || {})
                    : undefined;
                subject = template.subject
                    ? this.renderTemplate(template.subject, request.templateData || {})
                    : subject;
            }
        }
        // 检查静默时段
        if (this.isQuietHours(request.metadata?.userId)) {
            this.logger.info('[Notification] Skipping due to quiet hours', {
                requestId,
            });
            return { success: true, records: [], errors: ['Quiet hours'] };
        }
        // 发送到每个接收者
        for (const recipient of request.recipients) {
            const record = await this.sendToRecipient(requestId, request.channel, recipient, subject, content, htmlContent, request.priority || 'normal', request.metadata);
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
    async sendToRecipient(requestId, channel, recipient, subject, content, htmlContent, priority = 'normal', metadata) {
        const recordId = this.generateId('rec');
        const now = new Date();
        const record = {
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
                    success = await this.sendEmail(recipient, subject || '', content || '', htmlContent);
                    break;
                case 'webhook':
                    success = await this.sendWebhook(recipient, metadata?.event || 'notification', metadata?.data || {});
                    break;
                case 'slack':
                    success = await this.sendSlack(recipient, content || '', metadata?.slackBlocks);
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
        }
        catch (error) {
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
    async sendEmail(to, subject, content, htmlContent) {
        // 这里应该调用实际的邮件服务
        // 目前只是模拟
        this.logger.debug('[Notification] Sending email', { to, subject });
        return true;
    }
    /**
     * 发送 Webhook
     */
    async sendWebhook(url, event, data) {
        try {
            const payload = {
                event,
                timestamp: new Date().toISOString(),
                data,
            };
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Notification-Event': event,
                },
                timeout: 10000,
            }));
            return response.status >= 200 && response.status < 300;
        }
        catch (error) {
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
    async sendSlack(webhookUrl, content, blocks) {
        try {
            const payload = {
                text: content,
                blocks: blocks || undefined,
            };
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(webhookUrl, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000,
            }));
            return response.status === 200;
        }
        catch (error) {
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
    async sendWechat(webhookUrl, content) {
        try {
            const payload = {
                msgtype: 'text',
                text: { content },
            };
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(webhookUrl, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000,
            }));
            return response.status === 200 && response.data?.errcode === 0;
        }
        catch (error) {
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
    createTemplate(template) {
        const id = this.generateId('tpl');
        const now = new Date();
        const newTemplate = {
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
    getTemplate(id) {
        return this.templates.get(id);
    }
    /**
     * 获取所有模板
     */
    getTemplates(channel) {
        let templates = Array.from(this.templates.values());
        if (channel) {
            templates = templates.filter((t) => t.channel === channel);
        }
        return templates.filter((t) => t.isEnabled);
    }
    /**
     * 渲染模板
     */
    renderTemplate(template, data) {
        return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
            return String(data[key] ?? `{{${key}}}`);
        });
    }
    // ==================== 偏好设置 ====================
    /**
     * 设置通知偏好
     */
    setPreferences(prefs) {
        const id = this.generateId('pref');
        const now = new Date();
        const newPrefs = {
            ...prefs,
            id,
            createdAt: now,
            updatedAt: now,
        };
        // 如果已有相同用户/租户的偏好，更新之
        for (const [existingId, existing] of this.preferences) {
            if ((prefs.userId && existing.userId === prefs.userId) ||
                (prefs.tenantId && existing.tenantId === prefs.tenantId)) {
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
    getPreferences(userId, tenantId) {
        for (const prefs of this.preferences.values()) {
            if (userId && prefs.userId === userId)
                return prefs;
            if (tenantId && prefs.tenantId === tenantId)
                return prefs;
        }
        return undefined;
    }
    /**
     * 检查是否在静默时段
     */
    isQuietHours(userId) {
        if (!userId)
            return false;
        const prefs = this.getPreferences(userId);
        if (!prefs?.quietHours?.enabled)
            return false;
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
    storeRecord(record) {
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
    getRecords(filters) {
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
    getStats() {
        const records = Array.from(this.records.values());
        const stats = {
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
            }
            else if (record.status === 'failed') {
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
    startRetryProcessor() {
        setInterval(() => this.processRetries(), 60000);
    }
    /**
     * 处理重试
     */
    processRetries() {
        const now = Date.now();
        for (const record of this.records.values()) {
            if (record.status !== 'failed' && record.status !== 'retrying')
                continue;
            if (record.attempts >= record.maxAttempts)
                continue;
            // 检查重试延迟
            const delayIndex = Math.min(record.attempts - 1, this.RETRY_DELAYS_MS.length - 1);
            const delay = this.RETRY_DELAYS_MS[delayIndex];
            const lastAttempt = record.lastAttemptAt?.getTime() || 0;
            if (now - lastAttempt < delay)
                continue;
            // 重新发送
            this.retryRecord(record);
        }
    }
    /**
     * 重试单条记录
     */
    async retryRecord(record) {
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
                    success = await this.sendEmail(record.recipient, record.subject || '', record.content);
                    break;
                case 'webhook':
                    success = await this.sendWebhook(record.recipient, record.metadata?.event || 'notification', record.metadata?.data || {});
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
            }
            else {
                record.status = 'failed';
                record.failedAt = new Date();
            }
        }
        catch (error) {
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
    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    /**
     * 初始化默认模板
     */
    initializeDefaultTemplates() {
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
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [winston_1.Logger,
        event_emitter_1.EventEmitter2,
        axios_1.HttpService])
], NotificationService);
//# sourceMappingURL=notification.service.js.map