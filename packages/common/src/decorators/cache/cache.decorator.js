"use strict";
/**
 * Cache Decorators
 *
 * 提供方法级别的缓存装饰器，与 RedisService 深度融合。
 * 支持配置驱动的缓存策略，使用 config.local.yaml 中的 redis 配置。
 *
 * 支持分层缓存键策略:
 * - 格式: prefix:primaryKey:hash(secondaryParams)
 * - 示例: userInfo:userId:md5(select+include)
 * - 清除时支持前缀匹配: userInfo:userId:* 清除所有变体
 *
 * @example
 * ```typescript
 * // 基础用法 - 使用配置名称
 * @Cacheable('userInfo')
 * async getUserById(userId: string) { ... }
 *
 * // 分层缓存 - 支持不同 select/include 参数的独立缓存
 * @Cacheable('userInfo', {
 *     keyGenerator: hierarchicalKeyGenerator({
 *         primaryKey: (userId) => userId,
 *         secondaryParams: (userId, select, include) => ({ select, include }),
 *     }),
 * })
 * async getUserById(userId: string, select?: any, include?: any) { ... }
 *
 * // 缓存失效 - 清除所有相关缓存
 * @CacheEvict('userInfo', {
 *     keyGenerator: (userId) => userId,
 *     evictByPrefix: true,  // 清除 userInfo:userId:* 所有变体
 * })
 * async updateUser(userId: string, data: any) { ... }
 * ```
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.spaceKeyGenerator = exports.userKeyGenerator = exports.CACHE_PUT_METADATA_KEY = exports.CACHE_EVICT_METADATA_KEY = exports.CACHE_METADATA_KEY = void 0;
exports.Cacheable = Cacheable;
exports.CacheEvict = CacheEvict;
exports.CachePut = CachePut;
exports.defaultKeyGenerator = defaultKeyGenerator;
exports.objectKeyGenerator = objectKeyGenerator;
exports.compositeKeyGenerator = compositeKeyGenerator;
exports.hashObject = hashObject;
exports.hashParams = hashParams;
exports.hierarchicalKeyGenerator = hierarchicalKeyGenerator;
exports.simpleHierarchicalKeyGenerator = simpleHierarchicalKeyGenerator;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
// ============================================================================
// Metadata Keys
// ============================================================================
exports.CACHE_METADATA_KEY = 'cache:cacheable';
exports.CACHE_EVICT_METADATA_KEY = 'cache:evict';
exports.CACHE_PUT_METADATA_KEY = 'cache:put';
// ============================================================================
// Decorators
// ============================================================================
/**
 * @Cacheable - 缓存方法返回值
 *
 * 首次调用时执行方法并缓存结果，后续调用直接返回缓存。
 *
 * @param cacheName - Redis 配置名称
 * @param options - 可选配置
 *
 * @example
 * ```typescript
 * @Cacheable('userInfo')
 * async getUserById(userId: string) {
 *     return await this.prisma.userInfo.findUnique({ where: { id: userId } });
 * }
 *
 * ```
 */
function Cacheable(cacheName, options) {
    const cacheOptions = {
        cacheName,
        ...options,
    };
    return (0, common_1.SetMetadata)(exports.CACHE_METADATA_KEY, cacheOptions);
}
/**
 * @CacheEvict - 缓存失效
 *
 * 方法执行后（或前）使指定缓存失效。
 *
 * @param cacheName - Redis 配置名称
 * @param options - 可选配置
 *
 * @example
 * ```typescript
 * @CacheEvict('userInfo')
 * async updateUser(userId: string, data: any) {
 *     return await this.prisma.userInfo.update({ where: { id: userId }, data });
 * }
 *
 * @CacheEvict('userInfo', { allEntries: true })
 * async clearAllUserCache() { ... }
 * ```
 */
function CacheEvict(cacheName, options) {
    const evictOptions = {
        cacheName,
        ...options,
    };
    return (0, common_1.SetMetadata)(exports.CACHE_EVICT_METADATA_KEY, evictOptions);
}
/**
 * @CachePut - 更新缓存
 *
 * 每次都执行方法，并用返回值更新缓存。
 * 适用于需要确保数据新鲜度的场景。
 *
 * @param cacheName - Redis 配置名称
 * @param options - 可选配置
 *
 * @example
 * ```typescript
 * @CachePut('userInfo')
 * async refreshUserCache(userId: string) {
 *     return await this.prisma.userInfo.findUnique({ where: { id: userId } });
 * }
 * ```
 */
function CachePut(cacheName, options) {
    const cacheOptions = {
        cacheName,
        ...options,
    };
    return (0, common_1.SetMetadata)(exports.CACHE_PUT_METADATA_KEY, cacheOptions);
}
// ============================================================================
// Key Generators
// ============================================================================
/**
 * 默认 key 生成器
 * 将方法参数序列化为缓存 key
 */
function defaultKeyGenerator(...args) {
    if (args.length === 0)
        return '';
    if (args.length === 1) {
        const arg = args[0];
        if (typeof arg === 'string' || typeof arg === 'number') {
            return String(arg);
        }
    }
    return JSON.stringify(args);
}
/**
 * 基于对象属性的 key 生成器
 *
 * @example
 * ```typescript
 * @Cacheable('userInfo', { keyGenerator: objectKeyGenerator('id') })
 * async getUser(user: { id: string; name: string }) { ... }
 * ```
 */
function objectKeyGenerator(...properties) {
    return (...args) => {
        const obj = args[0];
        if (!obj || typeof obj !== 'object') {
            return defaultKeyGenerator(...args);
        }
        return properties.map((prop) => obj[prop]).join(':');
    };
}
/**
 * 组合 key 生成器
 * 使用冒号连接多个参数
 *
 * @example
 */
function compositeKeyGenerator(...args) {
    return args
        .map((arg) => {
        if (typeof arg === 'object' && arg !== null) {
            return JSON.stringify(arg);
        }
        return String(arg);
    })
        .join(':');
}
// ============================================================================
// Hash Utilities
// ============================================================================
/**
 * 计算对象的 MD5 哈希值
 * 用于生成缓存键中的参数哈希部分
 */
function hashObject(obj) {
    if (obj === null || obj === undefined) {
        return 'null';
    }
    const str = typeof obj === 'string'
        ? obj
        : JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
}
/**
 * 计算多个参数的组合哈希
 */
function hashParams(...params) {
    const parts = params.map((p) => {
        if (p === null || p === undefined) {
            return 'null';
        }
        return typeof p === 'string'
            ? p
            : JSON.stringify(p, Object.keys(p || {}).sort());
    });
    return crypto
        .createHash('md5')
        .update(parts.join('|'))
        .digest('hex')
        .substring(0, 8);
}
/**
 * 分层缓存键生成器
 *
 * 生成格式: primaryKey:hash(secondaryParams)
 * 如果没有 secondaryParams 或为空，则只返回 primaryKey
 *
 * @example
 * ```typescript
 * // 用于 getUserById(userId, select?, include?)
 * @Cacheable('userInfo', {
 *     keyGenerator: hierarchicalKeyGenerator({
 *         primaryKey: (userId) => userId,
 *         secondaryParams: (userId, select, include) => ({ select, include }),
 *     }),
 * })
 * async getUserById(userId: string, select?: any, include?: any) { ... }
 *
 * // 生成的 key 示例:
 * // - getUserById('user1') -> 'user1'
 * // - getUserById('user1', { id: true }) -> 'user1:a3f2b1c4'
 * // - getUserById('user1', { id: true, name: true }) -> 'user1:b2c3d4e5'
 * ```
 */
function hierarchicalKeyGenerator(config) {
    return (...args) => {
        const primaryKey = config.primaryKey(...args);
        if (!config.secondaryParams) {
            return primaryKey;
        }
        const secondary = config.secondaryParams(...args);
        // 如果次要参数为空或所有值都是 undefined/null，只返回主键
        if (!secondary ||
            Object.values(secondary).every((v) => v === undefined || v === null)) {
            return primaryKey;
        }
        // 过滤掉 undefined 和 null 的值，然后计算哈希
        const filteredSecondary = Object.fromEntries(Object.entries(secondary).filter(([_, v]) => v !== undefined && v !== null));
        if (Object.keys(filteredSecondary).length === 0) {
            return primaryKey;
        }
        const hash = hashObject(filteredSecondary);
        return `${primaryKey}:${hash}`;
    };
}
/**
 * 简单分层键生成器
 * 第一个参数作为主键，其余参数作为次要参数
 *
 * @example
 * ```typescript
 * @Cacheable('userInfo', { keyGenerator: simpleHierarchicalKeyGenerator })
 * async getUserById(userId: string, select?: any, include?: any) { ... }
 * // 生成: userId:hash(select+include)
 * ```
 */
function simpleHierarchicalKeyGenerator(...args) {
    if (args.length === 0)
        return '';
    const primaryKey = String(args[0]);
    if (args.length === 1) {
        return primaryKey;
    }
    // 其余参数作为次要参数
    const secondaryArgs = args.slice(1);
    // 如果所有次要参数都是 undefined/null，只返回主键
    if (secondaryArgs.every((arg) => arg === undefined || arg === null)) {
        return primaryKey;
    }
    const hash = hashParams(...secondaryArgs);
    return `${primaryKey}:${hash}`;
}
/**
 * 创建用户缓存键生成器
 * 专门用于 User 相关的缓存
 *
 * @example
 * ```typescript
 * @Cacheable('userInfo', { keyGenerator: userKeyGenerator })
 * async getUserById(userId: string, select?: any, include?: any) { ... }
 * ```
 */
exports.userKeyGenerator = simpleHierarchicalKeyGenerator;
/**
 * 创建空间缓存键生成器
 * 专门用于 Space 相关的缓存
 */
exports.spaceKeyGenerator = simpleHierarchicalKeyGenerator;
//# sourceMappingURL=cache.decorator.js.map