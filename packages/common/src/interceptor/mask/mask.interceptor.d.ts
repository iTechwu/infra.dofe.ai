import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
/**
 * 脱敏配置元数据 Key
 */
export declare const MASK_CONFIG_KEY = "mask:config";
/**
 * 脱敏字段配置
 */
export interface MaskFieldConfig {
    /** 字段路径（支持嵌套，如 'user.email'） */
    field: string;
    /** 脱敏类型 */
    type: 'email' | 'mobile' | 'phone' | 'idCard' | 'bankCard' | 'name' | 'address' | 'ip' | 'token' | 'password' | 'custom';
    /** 自定义脱敏函数（当 type 为 'custom' 时使用） */
    maskFn?: (value: string) => string;
}
/**
 * 脱敏配置
 */
export interface MaskConfig {
    /** 是否启用自动脱敏（根据字段名自动识别敏感数据） */
    auto?: boolean;
    /** 指定字段脱敏配置 */
    fields?: MaskFieldConfig[];
    /** 额外需要脱敏的字段名列表 */
    additionalSensitiveFields?: string[];
}
/**
 * 脱敏装饰器
 * @param config 脱敏配置
 *
 * @example
 * ```typescript
 * // 自动脱敏
 * @Mask({ auto: true })
 * @Get('users')
 * async getUsers() { ... }
 *
 * // 指定字段脱敏
 * @Mask({
 *   fields: [
 *     { field: 'email', type: 'email' },
 *     { field: 'phone', type: 'phone' },
 *   ]
 * })
 * @Get('user/:id')
 * async getUser() { ... }
 * ```
 */
export declare const Mask: (config?: MaskConfig) => import("@nestjs/common").CustomDecorator<string>;
/**
 * 跳过脱敏装饰器
 */
export declare const SkipMask: () => import("@nestjs/common").CustomDecorator<string>;
/**
 * 数据脱敏拦截器
 *
 * 用于在 API 响应中自动脱敏敏感数据。
 *
 * @example
 * ```typescript
 * // 在 Controller 中使用
 * @UseInterceptors(MaskInterceptor)
 * @Mask({ auto: true })
 * @Get('users')
 * async getUsers() { ... }
 *
 * // 全局使用
 * app.useGlobalInterceptors(new MaskInterceptor(reflector));
 * ```
 */
export declare class MaskInterceptor implements NestInterceptor {
    private readonly reflector;
    constructor(reflector: Reflector);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
}
