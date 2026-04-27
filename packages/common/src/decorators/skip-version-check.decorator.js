"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkipVersionCheck = void 0;
const common_1 = require("@nestjs/common");
const version_guard_1 = require("../guards/version.guard");
/**
 * Skip Version Check Decorator
 * 跳过版本检查装饰器
 *
 * 标记的控制器或方法将跳过 VersionGuard 的版本检查。
 * 适用于健康检查、版本信息等不需要版本控制的端点。
 *
 * @example
 * ```typescript
 * // 跳过整个控制器
 * @SkipVersionCheck()
 * @Controller('health')
 * export class HealthController { ... }
 *
 * // 跳过单个方法
 * @Controller('api')
 * export class ApiController {
 *   @SkipVersionCheck()
 *   @Get('version')
 *   getVersion() { ... }
 * }
 * ```
 */
const SkipVersionCheck = () => (0, common_1.SetMetadata)(version_guard_1.SKIP_VERSION_CHECK, true);
exports.SkipVersionCheck = SkipVersionCheck;
//# sourceMappingURL=skip-version-check.decorator.js.map