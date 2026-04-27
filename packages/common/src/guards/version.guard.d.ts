import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type ApiContract, type Platform } from '@repo/constants';
/**
 * 跳过版本检查的装饰器 key
 */
export declare const SKIP_VERSION_CHECK = "skipVersionCheck";
/**
 * 跳过版本检查装饰器
 * @example
 * ```typescript
 * @SkipVersionCheck()
 * @Get('health')
 * health() { return { status: 'ok' }; }
 * ```
 */
export declare const SkipVersionCheck: () => import("@nestjs/common").CustomDecorator<string>;
/**
 * 版本上下文接口
 * 注入到 request 中供 Service 使用
 */
export interface VersionContext {
    /** 平台类型 */
    platform: Platform;
    /** API 合约版本 (APP 专用) */
    contract?: ApiContract;
    /** 支持的能力列表 */
    features: readonly string[];
    /** APP 构建号 */
    appBuild?: string;
}
declare module 'fastify' {
    interface FastifyRequest {
        versionContext?: VersionContext;
    }
}
/**
 * Version Guard
 * 统一版本校验 Guard，支持 Web 和 APP 双轨校验
 *
 * 校验策略:
 * - Web 客户端: 使用 Generation (代际号) 校验，不兼容时返回 426 强制刷新
 * - APP 客户端: 使用 Contract (合约版本) 校验，通过 Adapter 兼容旧版本
 *
 * @example
 * ```typescript
 * // 全局注册
 * app.useGlobalGuards(new VersionGuard(new Reflector()));
 *
 * // 跳过特定路由
 * @SkipVersionCheck()
 * @Get('health')
 * health() { return { status: 'ok' }; }
 *
 * // 在 Service 中使用版本上下文
 * @Injectable()
 * class MyService {
 *   getUser(req: FastifyRequest) {
 *     const ctx = req.versionContext;
 *     if (ctx?.features.includes('user-v2')) {
 *       return this.getUserV2();
 *     }
 *     return this.getUserV1();
 *   }
 * }
 * ```
 */
export declare class VersionGuard implements CanActivate {
    private readonly reflector;
    constructor(reflector: Reflector);
    canActivate(context: ExecutionContext): boolean;
    /**
     * Web 客户端校验
     * 使用 Generation (代际号) 进行校验
     */
    private validateWebClient;
    /**
     * APP 客户端校验
     * 使用 Contract (合约版本) 进行校验
     */
    private validateAppClient;
    /**
     * 从构建版本中提取代际号
     * @param buildVersion 构建版本字符串 (格式: YYYY.MM.DD-hash-gNN)
     * @returns 代际号，无法解析时返回 0
     */
    private extractGeneration;
    /**
     * 从 APP Build 中提取构建号
     * @param appBuild APP 构建版本字符串 (格式: 数字或版本号)
     * @returns 构建号，无法解析时返回 0
     */
    private extractBuildNumber;
    /**
     * 获取最低兼容的构建版本
     */
    private getMinAppBuild;
}
