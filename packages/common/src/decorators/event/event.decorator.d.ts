/**
 * Event Decorators
 *
 * 提供方法级别的事件装饰器，用于解耦业务逻辑。
 * 支持同步和异步事件触发，与 NestJS EventEmitter 深度融合。
 *
 * @example
 * ```typescript
 * // 触发事件 - 方法执行后触发
 * @EmitEvent('user.updated')
 * async updateUser(userId: string, data: any) { ... }
 *
 * // 监听事件
 * @OnEvent('user.updated')
 * async handleUserUpdated(payload: UserUpdatedPayload) { ... }
 *
 * // 条件触发
 * @EmitEvent('user.created', { condition: (result) => result !== null })
 * async createUser(data: any) { ... }
 * ```
 */
export declare const EMIT_EVENT_METADATA_KEY = "event:emit";
export declare const EMIT_EVENTS_METADATA_KEY = "event:emit:multiple";
/**
 * 系统事件名称常量
 * 使用点号分隔的命名约定: domain.action
 */
export declare const EventNames: {
    readonly USER: {
        readonly CREATED: "user.created";
        readonly UPDATED: "user.updated";
        readonly DELETED: "user.deleted";
        readonly LOGIN: "user.login";
        readonly LOGOUT: "user.logout";
        readonly PASSWORD_CHANGED: "user.password.changed";
    };
    readonly CACHE: {
        readonly INVALIDATED: "cache.invalidated";
        readonly REFRESHED: "cache.refreshed";
    };
    readonly AUTH: {
        readonly TOKEN_CREATED: "auth.token.created";
        readonly TOKEN_REFRESHED: "auth.token.refreshed";
        readonly TOKEN_REVOKED: "auth.token.revoked";
    };
};
/**
 * 事件发射配置选项
 */
export interface EmitEventOptions {
    /** 事件名称 */
    eventName: string;
    /**
     * 是否异步触发 (不阻塞方法返回)
     * 默认: true
     */
    async?: boolean;
    /**
     * 是否在方法执行前触发
     * 默认: false (方法执行后触发)
     */
    beforeInvocation?: boolean;
    /**
     * 条件表达式 - 决定是否触发事件
     * 接收方法返回值，返回 true 则触发
     * 默认: 总是触发
     */
    condition?: (result: any, args: any[]) => boolean;
    /**
     * 自定义 payload 生成器
     * 接收方法参数和返回值，返回事件 payload
     * 默认: { args, result }
     */
    payloadGenerator?: (args: any[], result: any) => any;
}
/**
 * 事件 Payload 基础类型
 */
export interface BaseEventPayload<T = any> {
    /** 事件触发时间 */
    timestamp: Date;
    /** 方法参数 */
    args: any[];
    /** 方法返回值 */
    result: T;
    /** 额外上下文 */
    context?: Record<string, any>;
}
/**
 * @EmitEvent - 方法执行后触发事件
 *
 * @param eventName - 事件名称
 * @param options - 可选配置
 *
 * @example
 * ```typescript
 * @EmitEvent(EventNames.USER.UPDATED)
 * async updateUser(userId: string, data: any) {
 *     return await this.prisma.userInfo.update({ where: { id: userId }, data });
 * }
 *
 * @EmitEvent(EventNames.USER.CREATED, {
 *     condition: (result) => result !== null,
 *     payloadGenerator: (args, result) => ({ userId: result.id, email: result.email }),
 * })
 * async createUser(data: CreateUserDto) { ... }
 * ```
 */
export declare function EmitEvent(eventName: string, options?: Partial<Omit<EmitEventOptions, 'eventName'>>): MethodDecorator;
/**
 * @EmitEvents - 方法执行后触发多个事件
 *
 * @param events - 事件配置数组
 *
 * @example
 * ```typescript
 * @EmitEvents([
 *     { eventName: EventNames.USER.UPDATED },
 *     { eventName: EventNames.CACHE.INVALIDATED, payloadGenerator: (args) => ({ key: `user:${args[0]}` }) },
 * ])
 * async updateUser(userId: string, data: any) { ... }
 * ```
 */
export declare function EmitEvents(events: Array<{
    eventName: string;
    options?: Partial<Omit<EmitEventOptions, 'eventName'>>;
}>): MethodDecorator;
/**
 * 默认 payload 生成器
 */
export declare function defaultPayloadGenerator(args: any[], result: any): BaseEventPayload;
/**
 * 用户事件 payload 生成器
 */
export declare function userEventPayloadGenerator(args: any[], result: any): {
    timestamp: Date;
    userId: any;
    user: any;
    args: any[];
    result: any;
};
/**
 * 缓存失效事件 payload 生成器
 */
export declare function cacheInvalidatePayloadGenerator(cacheName: string, keyGenerator?: (...args: any[]) => string): (args: any[], result: any) => {
    timestamp: Date;
    cacheName: string;
    cacheKey: any;
    args: any[];
    result: any;
};
