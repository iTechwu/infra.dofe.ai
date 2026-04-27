/**
 * App Version Service
 *
 * 提供应用版本管理服务，用于前后端版本一致性检查。
 *
 * 版本策略:
 * - API 版本: 后端 API 接口版本
 * - App 版本: 应用整体版本 (前后端协调)
 * - Build 版本: 构建时间戳/Git commit hash
 *
 * 前端检测机制:
 * 1. 响应头检查: x-app-version, x-build-version
 * 2. 专用接口: GET /api/version
 * 3. 版本不一致时提示用户刷新
 */
import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
export interface AppVersionInfo {
    /** 应用版本 (package.json version) */
    appVersion: string;
    /** API 版本 */
    apiVersion: string;
    /** 构建版本 (时间戳或 Git hash) */
    buildVersion: string;
    /** 构建时间 */
    buildTime: string;
    /** 环境 */
    environment: string;
    /** 最低兼容前端版本 */
    minClientVersion?: string;
}
export interface VersionCheckResult {
    /** 是否需要刷新 */
    needsRefresh: boolean;
    /** 原因 */
    reason?: 'outdated' | 'incompatible' | 'major_update';
    /** 当前服务端版本 */
    serverVersion: string;
    /** 客户端版本 */
    clientVersion: string;
    /** 建议操作 */
    action?: 'refresh' | 'update' | 'none';
    /** 消息 */
    message?: string;
}
export declare class AppVersionService implements OnModuleInit {
    private readonly configService;
    private readonly logger;
    private versionInfo;
    private buildHash;
    constructor(configService: ConfigService, logger: Logger);
    onModuleInit(): Promise<void>;
    /**
     * 加载版本信息
     */
    private loadVersionInfo;
    /**
     * 生成构建哈希
     */
    private generateBuildHash;
    /**
     * 获取版本信息
     */
    getVersionInfo(): AppVersionInfo;
    /**
     * 获取版本响应头
     */
    getVersionHeaders(): Record<string, string>;
    /**
     * 检查客户端版本兼容性
     */
    checkClientVersion(clientVersion: string): VersionCheckResult;
    /**
     * 检查构建版本是否匹配
     */
    checkBuildVersion(clientBuildVersion: string): boolean;
    /**
     * 比较版本号
     * @returns -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
     */
    private compareVersions;
    /**
     * 检查是否为主版本更新
     */
    private isMajorVersionDiff;
}
