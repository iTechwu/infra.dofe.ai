/**
 * Rate Limit Module
 *
 * 限流模块，提供依赖注入支持
 *
 * @example
 * ```typescript
 * // 在 AppModule 或功能模块中导入
 * @Module({
 *     imports: [RateLimitModule],
 * })
 * export class AppModule {}
 *
 * // 在 Controller 中使用
 * @Controller('export')
 * export class ExportController {
 *     @Post()
 *     @RateLimit({ limit: 50, window: 60, dimension: 'userId' })
 *     async create() { ... }
 * }
 * ```
 */
export declare class RateLimitModule {
}
