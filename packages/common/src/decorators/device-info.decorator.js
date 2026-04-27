"use strict";
/**
 * Device Info Decorator
 * 设备信息装饰器 - 从请求头提取设备信息
 *
 * 使用方式：
 * ```typescript
 * @TsRestHandler(c.loginByEmail)
 * async loginByEmail(@DeviceInfo() deviceInfo: DoFeApp.HeaderData) {
 *   // deviceInfo 自动注入
 *   const result = await this.signService.loginByEmail(body, deviceInfo);
 *   return success(result);
 * }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceInfo = void 0;
exports.getDeviceId = getDeviceId;
const common_1 = require("@nestjs/common");
/**
 * @DeviceInfo() decorator - 从请求头提取设备信息
 *
 * 自动从以下请求头提取：
 * - x-platform: 平台标识
 * - x-os: 操作系统
 * - x-device-id: 设备ID
 * - x-mptrail: 营销追踪参数
 *
 * @example
 * // 在控制器方法中使用
 * async login(@DeviceInfo() deviceInfo: DoFeApp.HeaderData) {
 *   console.log(deviceInfo.platform, deviceInfo.os, deviceInfo.deviceid);
 * }
 */
exports.DeviceInfo = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const headers = request.headers;
    return {
        platform: headers['x-platform'] || '',
        os: headers['x-os'] || '',
        deviceid: headers['x-device-id'] || '',
        mptrail: headers['x-mptrail'],
    };
});
/**
 * Get device ID from request headers
 * 从请求头获取设备ID的辅助函数
 *
 * @param request - Fastify request object
 * @returns Device ID string or 'unknown'
 */
function getDeviceId(request) {
    return request.headers['x-device-id'] || 'unknown';
}
//# sourceMappingURL=device-info.decorator.js.map