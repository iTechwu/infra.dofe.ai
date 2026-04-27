/**
 * @fileoverview SMS Service
 * @module @app/shared-services/sms
 *
 * 职责：提供短信发送的业务逻辑服务
 *
 * 功能：
 * - 验证码生成和验证
 * - 短信队列管理
 * - 发送频率限制
 * - 多供应商支持（阿里云、腾讯云、火山引擎等）
 *
 * @example
 * ```typescript
 * // 发送验证码（通过队列）
 * await smsService.processingSendSmsVerifyCode(
 *   { mobile: '13800138000' },
 *   { deviceid: 'xxx' },
 *   'verify'
 * );
 *
 * // 火山引擎：发送并校验验证码
 * await smsService.sendVerifyCode('13800138000');
 * const result = await smsService.checkVerifyCode('13800138000', '123456');
 * ```
 */
import { OnModuleInit } from '@nestjs/common';
import { Logger } from 'winston';
import { HttpService } from '@nestjs/axios';
import type { MobileAuth } from '@prisma/client';
import { RedisService } from "../../../redis/src";
import { RabbitmqService } from "../../../rabbitmq/src";
import { VerifyClient } from "../../../clients/src/internal/verify";
import { DoFeApp } from "../../../common/src/config/dto/config.dto";
import { SmsVendor, SmsTemplate, SmsSendResult, VerifyCodeCheckResult } from './types';
export declare class SmsService implements OnModuleInit {
    private readonly redis;
    private readonly verifyService;
    private readonly rabbitmq;
    private readonly httpService;
    private readonly logger;
    /** SMS 客户端工厂 */
    private factory;
    constructor(redis: RedisService, verifyService: VerifyClient, rabbitmq: RabbitmqService, httpService: HttpService, logger: Logger);
    onModuleInit(): void;
    /**
     * 初始化 SMS 客户端工厂
     */
    private initializeSmsClient;
    /**
     * 检查服务是否已初始化
     */
    get isInitialized(): boolean;
    /**
     * 获取当前供应商类型
     */
    get currentVendor(): SmsVendor | null;
    /**
     * 获取当前供应商显示名称
     */
    get currentVendorName(): string;
    /**
     * 检查是否为火山引擎供应商
     */
    get isVolcengine(): boolean;
    /**
     * 获取设备发送日志
     *
     * @param deviceId - 设备 ID
     * @returns 发送日志数据，不存在返回 null
     */
    getDeviceSendLogger(deviceId: string): Promise<string | null>;
    /**
     * 设置设备发送日志（用于频率限制）
     *
     * @param deviceId - 设备 ID
     * @param expire - 过期时间（秒），默认 30 秒
     */
    setDeviceSendLogger(deviceId: string, expire?: number): Promise<void>;
    /**
     * 检查设备是否在冷却期
     *
     * @param deviceId - 设备 ID
     * @returns 是否在冷却期
     */
    isDeviceInCooldown(deviceId: string): Promise<boolean>;
    /**
     * 发送短信验证码（底层方法）
     *
     * @param mobile - 手机号码
     * @param code - 验证码
     * @param template - 短信模板
     * @returns 发送结果
     */
    doSendSmsCode(mobile: string, code: string, template: SmsTemplate): Promise<SmsSendResult>;
    /**
     * 发送验证码（火山引擎自动生成验证码）
     *
     * 仅火山引擎供应商支持此功能
     *
     * @param phoneNumber - 手机号码
     * @param templateId - 模板 ID，默认 'verify'
     * @returns 发送结果
     * @throws Error 如果当前供应商不是火山引擎
     */
    sendVerifyCode(phoneNumber: string, templateId?: string): Promise<any>;
    /**
     * 校验验证码（火山引擎）
     *
     * 仅火山引擎供应商支持此功能
     *
     * @param phoneNumber - 手机号码
     * @param code - 验证码
     * @param templateId - 模板 ID，默认 'verify'
     * @returns 校验结果
     * @throws Error 如果当前供应商不是火山引擎
     */
    checkVerifyCode(phoneNumber: string, code: string, templateId?: string): Promise<VerifyCodeCheckResult>;
    /**
     * 处理发送短信验证码请求
     *
     * 包含完整的业务逻辑：
     * 1. 验证模板存在
     * 2. 检查发送频率限制
     * 3. 生成验证码
     * 4. 发送到消息队列（数据库写入由消费者处理）
     *
     * @param mobileAccount - 手机账户信息
     * @param deviceInfo - 设备信息
     * @param templateId - 模板 ID，默认 'verify'
     * @throws ApiException 如果模板不存在或发送太频繁
     */
    processingSendSmsVerifyCode(mobileAccount: Partial<MobileAuth>, deviceInfo: DoFeApp.HeaderData, templateId?: string): Promise<void>;
    /**
     * 确保服务已初始化
     */
    private ensureInitialized;
}
