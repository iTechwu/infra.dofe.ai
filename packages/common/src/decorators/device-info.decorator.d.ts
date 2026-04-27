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
import { FastifyRequest } from 'fastify';
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
export declare const DeviceInfo: (...dataOrPipes: unknown[]) => ParameterDecorator;
/**
 * Get device ID from request headers
 * 从请求头获取设备ID的辅助函数
 *
 * @param request - Fastify request object
 * @returns Device ID string or 'unknown'
 */
export declare function getDeviceId(request: FastifyRequest): string;
