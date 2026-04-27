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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaskInterceptor = exports.SkipMask = exports.Mask = exports.MASK_CONFIG_KEY = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const operators_1 = require("rxjs/operators");
const utils_1 = require("@repo/utils");
/**
 * 脱敏配置元数据 Key
 */
exports.MASK_CONFIG_KEY = 'mask:config';
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
const Mask = (config = { auto: true }) => (0, common_1.SetMetadata)(exports.MASK_CONFIG_KEY, config);
exports.Mask = Mask;
/**
 * 跳过脱敏装饰器
 */
const SkipMask = () => (0, common_1.SetMetadata)(exports.MASK_CONFIG_KEY, { skip: true });
exports.SkipMask = SkipMask;
/**
 * 根据字段路径获取值
 */
function getValueByPath(obj, path) {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
}
/**
 * 根据字段路径设置值
 */
function setValueByPath(obj, path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    if (!last)
        return;
    const target = parts.reduce((acc, part) => {
        if (acc && typeof acc === 'object') {
            return acc[part];
        }
        return undefined;
    }, obj);
    if (target && typeof target === 'object') {
        target[last] = value;
    }
}
/**
 * 应用单个字段脱敏
 */
function applyFieldMask(data, config) {
    const value = getValueByPath(data, config.field);
    if (typeof value !== 'string')
        return;
    let maskedValue;
    switch (config.type) {
        case 'email':
            maskedValue = utils_1.maskUtil.email(value);
            break;
        case 'mobile':
        case 'phone':
            maskedValue = utils_1.maskUtil.phone(value);
            break;
        case 'idCard':
            maskedValue = utils_1.maskUtil.idCard(value);
            break;
        case 'bankCard':
            maskedValue = utils_1.maskUtil.bankCard(value);
            break;
        case 'name':
            maskedValue = utils_1.maskUtil.name(value);
            break;
        case 'address':
            maskedValue = utils_1.maskUtil.address(value);
            break;
        case 'ip':
            maskedValue = utils_1.maskUtil.ip(value);
            break;
        case 'token':
            maskedValue = utils_1.maskUtil.token(value);
            break;
        case 'password':
            maskedValue = utils_1.maskUtil.password(value);
            break;
        case 'custom':
            maskedValue = config.maskFn ? config.maskFn(value) : value;
            break;
        default:
            maskedValue = value;
    }
    setValueByPath(data, config.field, maskedValue);
}
/**
 * 递归处理数组和嵌套对象
 */
function processData(data, config) {
    if (!data)
        return data;
    // 处理数组
    if (Array.isArray(data)) {
        return data.map((item) => processData(item, config));
    }
    // 处理对象
    if (typeof data === 'object') {
        // 创建副本以避免修改原数据
        const result = { ...data };
        // 处理 data.data 嵌套结构（API 响应格式）
        if (result.data !== undefined) {
            result.data = processData(result.data, config);
            return result;
        }
        // 自动脱敏
        if (config.auto) {
            return utils_1.maskUtil.object(result, config.additionalSensitiveFields);
        }
        // 指定字段脱敏
        if (config.fields && config.fields.length > 0) {
            for (const fieldConfig of config.fields) {
                applyFieldMask(result, fieldConfig);
            }
        }
        return result;
    }
    return data;
}
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
let MaskInterceptor = class MaskInterceptor {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    intercept(context, next) {
        const config = this.reflector.get(exports.MASK_CONFIG_KEY, context.getHandler());
        // 如果没有配置或跳过脱敏，直接返回
        if (!config || config.skip) {
            return next.handle();
        }
        return next.handle().pipe((0, operators_1.map)((data) => {
            try {
                return processData(data, config);
            }
            catch (error) {
                // 脱敏失败时返回原数据，避免影响正常响应
                console.error('Data masking failed:', error);
                return data;
            }
        }));
    }
};
exports.MaskInterceptor = MaskInterceptor;
exports.MaskInterceptor = MaskInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], MaskInterceptor);
//# sourceMappingURL=mask.interceptor.js.map