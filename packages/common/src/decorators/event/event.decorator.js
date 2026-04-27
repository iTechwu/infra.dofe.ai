"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventNames = exports.EMIT_EVENTS_METADATA_KEY = exports.EMIT_EVENT_METADATA_KEY = void 0;
exports.EmitEvent = EmitEvent;
exports.EmitEvents = EmitEvents;
exports.defaultPayloadGenerator = defaultPayloadGenerator;
exports.userEventPayloadGenerator = userEventPayloadGenerator;
exports.cacheInvalidatePayloadGenerator = cacheInvalidatePayloadGenerator;
const common_1 = require("@nestjs/common");
// ============================================================================
// Metadata Keys
// ============================================================================
exports.EMIT_EVENT_METADATA_KEY = 'event:emit';
exports.EMIT_EVENTS_METADATA_KEY = 'event:emit:multiple';
// ============================================================================
// Event Names (建议统一在此定义)
// ============================================================================
/**
 * 系统事件名称常量
 * 使用点号分隔的命名约定: domain.action
 */
exports.EventNames = {
    // 用户相关事件
    USER: {
        CREATED: 'user.created',
        UPDATED: 'user.updated',
        DELETED: 'user.deleted',
        LOGIN: 'user.login',
        LOGOUT: 'user.logout',
        PASSWORD_CHANGED: 'user.password.changed',
    },
    // 缓存相关事件
    CACHE: {
        INVALIDATED: 'cache.invalidated',
        REFRESHED: 'cache.refreshed',
    },
    // 认证相关事件
    AUTH: {
        TOKEN_CREATED: 'auth.token.created',
        TOKEN_REFRESHED: 'auth.token.refreshed',
        TOKEN_REVOKED: 'auth.token.revoked',
    },
};
// ============================================================================
// Decorators
// ============================================================================
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
function EmitEvent(eventName, options) {
    const eventOptions = {
        eventName,
        async: true,
        beforeInvocation: false,
        ...options,
    };
    return (0, common_1.SetMetadata)(exports.EMIT_EVENT_METADATA_KEY, eventOptions);
}
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
function EmitEvents(events) {
    const eventConfigs = events.map((e) => ({
        eventName: e.eventName,
        async: true,
        beforeInvocation: false,
        ...e.options,
    }));
    return (0, common_1.SetMetadata)(exports.EMIT_EVENTS_METADATA_KEY, eventConfigs);
}
// ============================================================================
// Payload Generators
// ============================================================================
/**
 * 默认 payload 生成器
 */
function defaultPayloadGenerator(args, result) {
    return {
        timestamp: new Date(),
        args,
        result,
    };
}
/**
 * 用户事件 payload 生成器
 */
function userEventPayloadGenerator(args, result) {
    const userId = args[0];
    return {
        timestamp: new Date(),
        userId,
        user: result,
        args,
        result,
    };
}
/**
 * 缓存失效事件 payload 生成器
 */
function cacheInvalidatePayloadGenerator(cacheName, keyGenerator) {
    return (args, result) => ({
        timestamp: new Date(),
        cacheName,
        cacheKey: keyGenerator ? keyGenerator(...args) : args[0],
        args,
        result,
    });
}
//# sourceMappingURL=event.decorator.js.map