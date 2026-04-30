/**
 * Shared constants for infra packages.
 * Extracted from @repo/constants — zero dependencies.
 */

// ============================================================================
// Pagination defaults
// ============================================================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// ============================================================================
// Skill installation limits
// ============================================================================

export const SKILL_LIMITS = {
  /** 单个技能目录最大总大小 (5MB) */
  MAX_DIR_SIZE: 5 * 1024 * 1024,
  /** 单个技能目录最大文件数 */
  MAX_FILE_COUNT: 50,
  /** 排除的文件名（不写入本地） */
  EXCLUDED_FILES: ['_meta.json'] as readonly string[],
  /** 允许执行的脚本名称白名单 */
  ALLOWED_SCRIPT_NAMES: ['init.sh'] as readonly string[],
  /** 脚本执行超时 (30s) */
  SCRIPT_EXEC_TIMEOUT: 30000,
} as const;

// ============================================================================
// Permission definitions
// ============================================================================

export const PERMISSION = {
  TENANT_READ: 'tenant.read',
  TENANT_UPDATE: 'tenant.update',
  TENANT_DELETE: 'tenant.delete',
  TENANT_MEMBER_READ: 'tenant.member.read',
  TENANT_MEMBER_INVITE: 'tenant.member.invite',
  TENANT_MEMBER_REMOVE: 'tenant.member.remove',
  TENANT_MEMBER_UPDATE_ROLE: 'tenant.member.updateRole',
  BOT_READ: 'bot.read',
  BOT_CREATE: 'bot.create',
  BOT_UPDATE: 'bot.update',
  BOT_DELETE: 'bot.delete',
  BOT_USE: 'bot.use',
  BOT_INSTALL_SKILL: 'bot.installSkill',
  GATEWAY_READ: 'gateway.read',
  GATEWAY_CREATE: 'gateway.create',
  GATEWAY_UPDATE: 'gateway.update',
  GATEWAY_DELETE: 'gateway.delete',
  GATEWAY_MANAGE: 'gateway.manage',
  PROVIDER_KEY_READ: 'providerKey.read',
  PROVIDER_KEY_CREATE: 'providerKey.create',
  PROVIDER_KEY_UPDATE: 'providerKey.update',
  PROVIDER_KEY_DELETE: 'providerKey.delete',
  MODEL_READ: 'model.read',
  MODEL_REFRESH: 'model.refresh',
  MODEL_VERIFY: 'model.verify',
  SKILL_READ: 'skill.read',
  SKILL_CREATE: 'skill.create',
  SKILL_UPDATE: 'skill.update',
  SKILL_DELETE: 'skill.delete',
  ORGANIZATION_SKILL_READ: 'organizationSkill.read',
  ORGANIZATION_SKILL_INSTALL: 'organizationSkill.install',
  ORGANIZATION_SKILL_UPDATE: 'organizationSkill.update',
  ORGANIZATION_SKILL_UNINSTALL: 'organizationSkill.uninstall',
  ORGANIZATION_SKILL_SYNC: 'organizationSkill.sync',
  ORGANIZATION_PLUGIN_READ: 'organizationPlugin.read',
  ORGANIZATION_PLUGIN_INSTALL: 'organizationPlugin.install',
  ORGANIZATION_PLUGIN_UPDATE: 'organizationPlugin.update',
  ORGANIZATION_PLUGIN_UNINSTALL: 'organizationPlugin.uninstall',
  ORGANIZATION_PLUGIN_SYNC: 'organizationPlugin.sync',
  ORGANIZATION_PLUGIN_CONFIGURE: 'organizationPlugin.configure',
  ORGANIZATION_PLUGIN_DOCTOR: 'organizationPlugin.doctor',
  ORGANIZATION_CRON_READ: 'organizationCron.read',
  ORGANIZATION_CRON_CREATE: 'organizationCron.create',
  ORGANIZATION_CRON_UPDATE: 'organizationCron.update',
  ORGANIZATION_CRON_DELETE: 'organizationCron.delete',
  ORGANIZATION_CRON_ENABLE: 'organizationCron.enable',
  ORGANIZATION_CRON_DISABLE: 'organizationCron.disable',
  ORGANIZATION_CRON_SYNC: 'organizationCron.sync',
  MCP_SERVER_READ: 'mcpServer.read',
  MCP_SERVER_CREATE: 'mcpServer.create',
  MCP_SERVER_UPDATE: 'mcpServer.update',
  MCP_SERVER_DELETE: 'mcpServer.delete',
  MONITORING_READ: 'monitoring.read',
  DEPT_READ: 'dept.read',
  DEPT_CREATE: 'dept.create',
  DEPT_UPDATE: 'dept.update',
  DEPT_DELETE: 'dept.delete',
  TEAM_READ: 'team.read',
  TEAM_CREATE: 'team.create',
  TEAM_UPDATE: 'team.update',
  TEAM_DELETE: 'team.delete',
  AUDIT_READ: 'audit.read',
  AUDIT_EXPORT: 'audit.export',
  FINANCE_READ: 'finance.read',
  FINANCE_EXPORT: 'finance.export',
} as const;

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION];

// ============================================================================
// Metadata keys
// ============================================================================

export const PUBLIC_ENDPOINT_KEY = 'isPublicEndpoint' as const;
export const TENANT_SCOPE_KEY = 'requiresTenantScope' as const;
export const REQUIRE_PERMISSIONS_KEY = 'requirePermissions' as const;

// ============================================================================
// Multi-tenant constants
// ============================================================================

export const DEFAULT_TENANT_ID = '2c450d80-e6ca-48d0-9cbc-fa33c4f5f67a' as const;
export const DEFAULT_TENANT_SLUG = 'default' as const;

// ============================================================================
// HTTP Header constants
// ============================================================================

export const CURRENT_TENANT_HEADER = 'x-current-tenant' as const;
export const API_VERSION_HEADER = 'x-api-version' as const;
export const APP_BUILD_HEADER = 'x-app-build' as const;
export const SERVER_BUILD_HEADER = 'x-server-build' as const;
export const MIN_APP_BUILD_HEADER = 'x-min-app-build' as const;
export const PLATFORM_HEADER = 'x-platform' as const;
export const OS_HEADER = 'x-os' as const;
export const DEVICE_ID_HEADER = 'x-device-id' as const;
export const MPTRAIL_HEADER = 'x-mptrail' as const;
export const API_CONTRACT_HEADER = 'x-api-contract' as const;
export const DEPRECATION_HEADER = 'deprecation' as const;
export const DEPRECATION_MESSAGE_HEADER = 'x-deprecation-message' as const;
export const SUNSET_HEADER = 'sunset' as const;

// ============================================================================
// Platform types
// ============================================================================

export const PLATFORMS = {
  WEB: 'web',
  IOS: 'ios',
  ANDROID: 'android',
} as const;

export type Platform = (typeof PLATFORMS)[keyof typeof PLATFORMS];

// ============================================================================
// API Contract types (version-based contracts for APP)
// ============================================================================

export type ApiContract = '2024-12' | '2025-01';

// ============================================================================
// API Version constants
// ============================================================================

export const API_VERSION = {
  V1: '1',
  V2: '2',
} as const;

export type ApiVersion = (typeof API_VERSION)[keyof typeof API_VERSION];

export const API_VERSION_DEFAULT = API_VERSION.V1;

// ============================================================================
// Generation constants
// ============================================================================

export const API_GENERATION = 1;
export const MIN_CLIENT_GENERATION = 1;

// ============================================================================
// Contract configuration (for version-based API contracts)
// ============================================================================

export const CONTRACTS: Record<
  ApiContract,
  {
    minBuild: { ios: number; android: number };
    deprecated: boolean;
    sunset: string | null;
    features: readonly string[];
  }
> = {
  '2024-12': {
    minBuild: { ios: 1000000, android: 1000000 },
    deprecated: false,
    sunset: null,
    features: ['user-v1'],
  },
  '2025-01': {
    minBuild: { ios: 1000000, android: 1000000 },
    deprecated: false,
    sunset: null,
    features: ['user-v1'],
  },
} as const;

export const CURRENT_CONTRACT: ApiContract = '2025-01';
export const MIN_SUPPORTED_CONTRACT: ApiContract = '2024-12';
