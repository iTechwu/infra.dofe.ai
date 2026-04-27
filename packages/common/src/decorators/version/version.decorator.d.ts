/**
 * API Version Decorators
 *
 * 提供 API 版本控制装饰器，支持 Header 和 URI 版本控制。
 * 与当前 api/... 前缀结构兼容，不改变现有路由。
 *
 * 版本控制策略:
 * - 使用 Header: x-api-version 指定版本
 * - 默认版本: 1 (VERSION_NEUTRAL)
 * - 支持版本兼容性检查
 *
 * @example
 * ```typescript
 * // Controller 级别版本控制
 * @Controller('users')
 * @ApiVersion('2')
 * export class UsersV2Controller { ... }
 *
 * // Method 级别版本控制
 * @Get()
 * @ApiVersion(['1', '2'])  // 支持多版本
 * async getUsers() { ... }
 * ```
 */
export declare const API_VERSION_HEADER = "x-api-version";
export declare const DEFAULT_API_VERSION = "1";
export declare const VERSION_METADATA_KEY = "api:version";
/**
 * 当前支持的 API 版本列表
 */
export declare const SUPPORTED_VERSIONS: readonly ["1", "2"];
export type SupportedVersion = (typeof SUPPORTED_VERSIONS)[number];
/**
 * @ApiVersion - API 版本控制装饰器
 *
 * 使用 NestJS 内置的 @Version 装饰器，配合 Header 版本控制策略。
 *
 * @param version - 版本号或版本号数组
 *
 * @example
 * ```typescript
 * // 单版本
 * @ApiVersion('2')
 * @Controller('users')
 * export class UsersV2Controller { ... }
 *
 * // 多版本兼容
 * @Get()
 * @ApiVersion(['1', '2'])
 * async getUsers() { ... }
 * ```
 */
export declare function ApiVersion(version: SupportedVersion | SupportedVersion[]): MethodDecorator & ClassDecorator;
/**
 * @VersionNeutral - 版本中立装饰器
 *
 * 标记方法或控制器不受版本控制影响，适用于所有版本。
 *
 * @example
 * ```typescript
 * @VersionNeutral()
 * @Get('health')
 * async healthCheck() { ... }
 * ```
 */
export declare function VersionNeutral(): MethodDecorator & ClassDecorator;
/**
 * @DeprecatedVersion - 废弃版本警告装饰器
 *
 * 标记即将废弃的 API 版本，会在响应头中添加 Deprecation 警告。
 *
 * @param message - 废弃说明
 * @param sunsetDate - 停止服务日期 (可选)
 *
 * @example
 * ```typescript
 * @DeprecatedVersion('请升级到 v2 API', '2025-06-01')
 * @Get()
 * async getUsers() { ... }
 * ```
 */
export declare function DeprecatedVersion(message: string, sunsetDate?: string): MethodDecorator;
/**
 * 检查版本是否受支持
 */
export declare function isSupportedVersion(version: string): version is SupportedVersion;
/**
 * 获取版本从请求头
 */
export declare function getVersionFromRequest(request: any): string;
/**
 * 比较版本号
 * @returns -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
 */
export declare function compareVersions(v1: string, v2: string): number;
