import { SetMetadata } from '@nestjs/common';

/**
 * 允许 API Key 访问的元数据键
 */
export const ALLOW_API_KEY_KEY = 'allowApiKey' as const;

/**
 * 允许 API Key 访问装饰器
 * 标记可以使用 API Key 跳过部分验证的端点
 *
 * @example
 * ```typescript
 * @TsRestHandler(skillC.list)
 * @AllowApiKey()
 * @TenantScope()
 * @RequirePermissions(PERMISSION.SKILL_READ)
 * async listSkills(@Req() req: AuthenticatedRequest) {
 *   // ...
 * }
 * ```
 *
 * 配合 ApiKeyGuard 使用，需要设置以下环境变量：
 * - INTERNAL_API_KEYS: API Key 列表，多个用逗号分隔（必填）
 * - INTERNAL_API_REQUIRE_TENANT: (可选) 是否强制要求租户 Header，默认 false
 */
export const AllowApiKey = () => SetMetadata(ALLOW_API_KEY_KEY, true);
