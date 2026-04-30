/**
 * Environment Variables Validation Schema
 *
 * Validates environment variables at startup using Zod.
 * Ensures all required configuration is present before the application starts.
 */
import { z } from 'zod';
import { createContextLogger } from '@dofe/infra-utils';

const logger = createContextLogger('EnvValidation');

/**
 * Environment variable schema definition
 *
 * 分类:
 * - Core: 核心配置（数据库、缓存、消息队列）
 * - Server: 服务器配置（端口、环境）
 * - Security: 安全配置（JWT、加密）
 * - Docker: Docker/Bot 容器配置
 * - S3: S3 存储配置
 * - Feature: 功能开关配置
 * - External: 外部服务配置
 */
export const envSchema = z.object({
  // ============================================================================
  // Core Infrastructure (核心基础设施)
  // ============================================================================

  // Environment
  NODE_ENV: z.enum(['dev', 'test', 'prod', 'produs', 'prodap']).default('dev'),

  // Server port (从 config.local.yaml 迁移)
  API_PORT: z.coerce.number().int().positive().max(65535).default(3200),

  // Project root path
  PROJECT_ROOT: z.string().optional(),

  // YAML config filename
  YAML_CONFIG_FILENAME: z.string().default('config.local.yaml'),

  // Base host for local services
  BASE_HOST: z.string().default('127.0.0.1'),

  // Database URLs
  DATABASE_URL: z
    .string()
    .url()
    .refine((url) => url.startsWith('postgresql://'), {
      message: 'DATABASE_URL must be a PostgreSQL URL',
    }),
  READ_DATABASE_URL: z
    .string()
    .url()
    .refine((url) => url.startsWith('postgresql://'), {
      message: 'READ_DATABASE_URL must be a PostgreSQL URL',
    })
    .optional(),

  // Redis URL
  REDIS_URL: z.string().refine((url) => url.startsWith('redis://'), {
    message: 'REDIS_URL must be a Redis URL',
  }),

  // RabbitMQ URL
  RABBITMQ_URL: z.string().refine((url) => url.startsWith('amqp://'), {
    message: 'RABBITMQ_URL must be an AMQP URL',
  }),
  RABBITMQ_OPTIONAL: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  // ============================================================================
  // Security (安全配置)
  // ============================================================================

  // JWT Configuration (从 config.local.yaml 迁移)
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
  JWT_EXPIRE_IN: z.coerce.number().int().positive().default(3600),

  // Crypto Configuration (从 config.local.yaml 迁移)
  CRYPTO_KEY: z.string().min(1, 'CRYPTO_KEY is required'),
  CRYPTO_IV: z.string().min(1, 'CRYPTO_IV is required'),

  // Bot Master Key
  BOT_MASTER_KEY: z.string().optional(),

  // ==========================================================================
  // Audit (审计)
  // ==========================================================================

  /** 审计日志签名密钥（生产环境必须设置） */
  AUDIT_SIGNATURE_SECRET: z.string().optional(),

  /** 是否启用审计详情脱敏（默认开启） */
  AUDIT_MASK_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),

  /** Gateway 审计上报超时（毫秒） */
  GATEWAY_AUDIT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  /** Gateway 审计上报端点（可选，默认由 API_BASE_URL 拼接） */
  GATEWAY_AUDIT_ENDPOINT: z.string().url().optional(),

  // ============================================================================
  // Docker / Bot Container (Docker 容器配置)
  // ============================================================================

  // Bot images
  BOT_IMAGE_GATEWAY: z.string().default('openclaw:latest'),
  // Sandbox images - configurable via environment variables
  BOT_IMAGE_TOOL_SANDBOX: z.string().default('openclaw-sandbox:bookworm-slim'),
  BOT_IMAGE_BROWSER_SANDBOX: z.string().default('openclaw-sandbox-browser:bookworm-slim'),

  // Gateway container limits
  GATEWAY_CONTAINER_CPU_LIMIT: z.coerce.number().default(1),
  GATEWAY_CONTAINER_MEMORY_LIMIT: z.coerce.number().default(2147483648), // 2GB

  // Gateway Docker port range start
  GATEWAY_DOCKER_PORT_START: z.coerce.number().int().positive().default(9200),

  // Bot directories
  BOT_DATA_DIR: z.string().default('/data/bots'),
  BOT_SECRETS_DIR: z.string().default('/data/secrets'),
  BOT_OPENCLAW_DIR: z.string().default('/data/openclaw'),

  // Bot volumes
  DATA_VOLUME_NAME: z.string().optional(),
  SECRETS_VOLUME_NAME: z.string().optional(),
  OPENCLAW_VOLUME_NAME: z.string().optional(),

  // OpenClaw source path (for development)
  OPENCLAW_SRC_PATH: z.string().default('../openclaw'),

  // Docker host socket path
  DOCKER_HOST: z.string().default('/var/run/docker.sock'),

  // Docker platform for image build/pull
  DOCKER_PLATFORM: z.string().default('linux/amd64'),

  // MCP build directory
  MCP_BUILD_DIR: z.string().default('/tmp/mcp-builds'),

  // Sandbox cleanup configuration
  SANDBOX_IDLE_THRESHOLD_MS: z.coerce.number().int().positive().default(3600000), // 1 hour
  SANDBOX_GRACE_PERIOD_MS: z.coerce.number().int().positive().default(300000), // 5 minutes

  // NPM registry
  NPM_CONFIG_REGISTRY: z.string().optional(),

  // Docker registry authentication (for pulling private images)
  DOCKER_REGISTRY_USERNAME: z.string().optional(),
  DOCKER_REGISTRY_PASSWORD: z.string().optional(),
  DOCKER_REGISTRY_SERVER: z.string().optional(),

  // ============================================================================
  // S3 Storage (S3 存储配置)
  // ============================================================================

  S3_ENABLE_RETRY: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  S3_ENHANCED_LOGGING: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  S3_MAX_RETRIES: z.coerce.number().int().positive().default(3),
  S3_RETRY_DELAY: z.coerce.number().int().positive().default(1000),

  // ============================================================================
  // Feature Flags (功能开关)
  // ============================================================================

  // Swagger
  SWAGGER_ENABLE: z
    .string()
    .transform((v) => v === 'true')
    .optional(),

  // Proxy
  PROXY_PREFER_STATS: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  PROXY_TOKEN_TTL: z.coerce.number().int().positive().default(86400),
  ZERO_TRUST_MODE: z.string().optional(),

  // Mode user (bypass auth for development)
  MODE_USER_ID: z.string().optional(),

  // Gateway Pool (多 Agent 架构)
  GATEWAY_POOL_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  GATEWAY_POOL_MIN_INSTANCES: z.coerce.number().int().positive().default(1),
  GATEWAY_POOL_MAX_INSTANCES: z.coerce.number().int().positive().default(10),
  GATEWAY_POOL_MAX_AGENTS_PER_GATEWAY: z.coerce
    .number()
    .int()
    .positive()
    .default(10),
  GATEWAY_POOL_HEALTH_CHECK_INTERVAL: z.coerce
    .number()
    .int()
    .positive()
    .default(30000),

  // Gateway Host (Gateway RPC 访问地址)
  // 本地开发: localhost
  // Docker 环境: host.docker.internal (从容器访问宿主机)
  // Kubernetes: gateway-service (Service 名称)
  GATEWAY_HOST: z.string().default('localhost'),

  // ============================================================================
  // External Services (外部服务)
  // ============================================================================

  // Pinecone API Key (从 config.local.yaml 迁移)
  PINECONE_API_KEY: z.string().optional(),

  // External API URLs
  API_BASE_URL: z.string().url().optional(),
  INTERNAL_API_BASE_URL: z.string().url().optional(),
  // Model capability research - dedicated internal bot proxy token
  RESEARCH_BOT_PROXY_TOKEN: z.string().optional(),

  // Feishu
  FEISHU_APP_ID: z.string().optional(),
  FEISHU_APP_SECRET: z.string().optional(),
  FEISHU_DOMAIN: z.string().default('feishu'),
  FEISHU_ENCRYPT_KEY: z.string().optional(),

  // ============================================================================
  // Third-party Aggregator Platforms (第三方聚合平台)
  // ============================================================================

  /**
   * DMXAPI 用户 ID（用于 Rix-Api-User header）
   * 某些第三方聚合平台（如 DMXAPI）需要特殊的 headers：
   * - Authorization 不需要 Bearer 前缀
   * - 需要 Rix-Api-User header 标识用户
   * 默认值: 20700
   */
  DMXAPI_USER_ID: z.string().default('20700'),

  // ============================================================================
  // Server Build Info (构建信息)
  // ============================================================================

  MICRO_SERVER_NAME: z.string().default('api'),
  SERVER_BUILD: z.string().optional(),
  GIT_COMMIT_HASH: z.string().optional(),
  VERCEL_GIT_COMMIT_SHA: z.string().optional(),

  // ============================================================================
  // MLflow Tracking (可观测性)
  // ============================================================================

  // MLflow Tracking Server URL (e.g., http://127.0.0.1:15000)
  MLFLOW_TRACKING_URI: z.string().url().optional(),
  // 是否启用 MLflow 上报
  MLFLOW_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

/**
 * Type inferred from the env schema
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validation result type
 */
export interface EnvValidationResult {
  success: boolean;
  data?: EnvConfig;
  errors?: z.ZodError;
}

/**
 * Validates environment variables against the schema
 *
 * @returns Validated environment configuration
 * @throws Error if validation fails in production
 */
export function validateEnv(): EnvConfig {
  // Expand environment variables in values (e.g., ${BASE_HOST})
  const expandedEnv = expandEnvVariables(process.env);

  const result = envSchema.safeParse(expandedEnv);

  if (!result.success) {
    const errorMessages = result.error.issues
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    logger.error('Environment variable validation failed', {
      error: errorMessages,
    });

    // In production, throw an error to prevent startup
    if (process.env.NODE_ENV?.startsWith('prod')) {
      throw new Error(`Environment validation failed:\n${errorMessages}`);
    }

    // In dev, log warning but continue
    logger.warn('Continuing with invalid environment in dev mode');
    // Apply defaults for missing fields
    const defaultEnv = envSchema.parse({});
    return { ...defaultEnv, ...expandedEnv } as EnvConfig;
  }

  logger.info('Environment variables validated successfully');
  return result.data;
}

/**
 * Validates environment variables and returns detailed result
 *
 * @returns Validation result with success status and data or errors
 */
export function validateEnvSafe(): EnvValidationResult {
  const expandedEnv = expandEnvVariables(process.env);
  const result = envSchema.safeParse(expandedEnv);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}

/**
 * Expands environment variable references in values
 * Handles patterns like ${VAR_NAME}
 *
 * @param env - Environment object
 * @returns Expanded environment object
 */
function expandEnvVariables(
  env: NodeJS.ProcessEnv,
): Record<string, string | undefined> {
  const expanded: Record<string, string | undefined> = { ...env };
  const varPattern = /\$\{([^}]+)\}/g;

  for (const key of Object.keys(expanded)) {
    const value = expanded[key];
    if (value && varPattern.test(value)) {
      expanded[key] = value.replace(varPattern, (_, varName) => {
        return expanded[varName] || process.env[varName] || '';
      });
    }
  }

  return expanded;
}

/**
 * Get a single environment variable with validation
 *
 * @param key - Environment variable key
 * @param defaultValue - Default value if not set
 * @returns Environment variable value
 */
export function getEnvVar(key: keyof EnvConfig, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value ?? defaultValue ?? '';
}
