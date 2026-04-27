/**
 * Email Service
 *
 * 职责：提供邮件发送的业务逻辑
 * - 验证码生成和验证
 * - 邮件队列管理
 * - 发送频率限制
 */
import { OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Logger } from 'winston';
import type { UserInfo } from '@prisma/client';
import { RedisService } from "../../../redis/src";
import { RabbitmqService } from "../../../rabbitmq/src";
import { VerifyClient } from "../../../clients/src/internal/verify";
import { DoFeApp } from "../../../common/src/config/dto/config.dto";
import { DoFeEmailSender } from "../../../clients/src/internal/email";
export declare class EmailService implements OnModuleInit {
    private readonly verify;
    private readonly rabbitmq;
    private readonly redis;
    private readonly httpService;
    private readonly logger;
    private deviceSendLoggerKey;
    private emailSendLoggerKey;
    private emailCodePerDayLoggerKey;
    private deviceCodePerDayLoggerKey;
    private secretConfig;
    private templates;
    private emailClient;
    constructor(verify: VerifyClient, rabbitmq: RabbitmqService, redis: RedisService, httpService: HttpService, logger: Logger);
    onModuleInit(): void;
    private initializeEmailClient;
    checkSendEmailTooFrequent(deviceId: string, email: string): Promise<boolean>;
    getEmailSendLogger(deviceId: string, email: string): Promise<{
        deviceLogger: any;
        emailLogger: any;
    }>;
    setEmailSendLogger(deviceId: string, email: string, expire?: number | null): Promise<void>;
    processingEmail(user: {
        email: string;
        nickname?: string;
        name?: string;
    }, deviceInfo: DoFeApp.HeaderData, templateName: string, subValues?: any | null): Promise<boolean>;
    processingSendVerifyEmail(userInfo: UserInfo, deviceInfo: DoFeApp.HeaderData): Promise<boolean>;
    processingSendResetPasswordeEmail(emailAccount: {
        email: string;
        name: string;
    }, deviceInfo: DoFeApp.HeaderData): Promise<boolean>;
    processingSendRegisterEmail(emailAccount: {
        email: string;
        name: string;
    }, deviceInfo: DoFeApp.HeaderData): Promise<boolean>;
    getEmailContent(user: {
        email: string;
        nickname?: string;
        name?: string;
    }, deviceInfo: DoFeApp.HeaderData, templateName: string, subValues?: any | null): Promise<DoFeEmailSender.SignalMessage>;
    getTemplateSub(): void;
}
