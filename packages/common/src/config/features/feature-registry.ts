// ============================================================================
// Feature Registry
// ============================================================================

export interface FeatureDescriptor {
  /** 功能唯一标识 */
  name: string;
  /** 功能描述 */
  description?: string;
  /** 需要的 env 变量（二选一：env 或 keys） */
  requiredEnvVars?: string[];
  /** 需要的 yaml 配置路径 */
  requiredYamlPaths?: string[];
  /** 需要的 keys 配置路径 */
  requiredKeysPaths?: string[];
}

export interface FeatureValidationContext {
  env: Record<string, string | undefined>;
  yaml: Record<string, unknown>;
  keys: Record<string, unknown> | undefined;
}

export interface FeatureValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  validatedFeatures: string[];
}

export const FEATURE_REGISTRY: Record<string, FeatureDescriptor> = {
  // ── 核心基础设施 ──
  database: {
    name: 'database',
    description: 'PostgreSQL 数据库连接',
    requiredEnvVars: ['DATABASE_URL'],
  },
  redis: {
    name: 'redis',
    description: 'Redis 缓存',
    requiredEnvVars: ['REDIS_URL'],
  },
  rabbitmq: {
    name: 'rabbitmq',
    description: 'RabbitMQ 消息队列',
    requiredEnvVars: ['RABBITMQ_URL'],
  },
  // ── 核心安全 ──
  jwt: {
    name: 'jwt',
    description: 'JWT 认证（支持 env 或 keys/config.json 二选一）',
    requiredKeysPaths: ['jwt'],
    requiredEnvVars: ['JWT_SECRET'],
  },
  crypto: {
    name: 'crypto',
    description: 'AES 加解密（支持 env 或 keys/config.json 二选一）',
    requiredKeysPaths: ['crypto'],
    requiredEnvVars: ['CRYPTO_KEY'],
  },
  // ── 通信 ──
  email: {
    name: 'email',
    description: '邮件服务（SendCloud）',
    requiredKeysPaths: ['sendcloud'],
  },
  sms: {
    name: 'sms',
    description: '短信服务',
    requiredKeysPaths: ['sms'],
  },
  // ── 存储 ──
  storage: {
    name: 'storage',
    description: '对象存储',
    requiredYamlPaths: ['buckets'],
    requiredKeysPaths: ['storage'],
  },
  // ── AI / 语音 ──
  openai: {
    name: 'openai',
    description: 'OpenAI 兼容 API',
    requiredKeysPaths: ['openai'],
  },
  tts: {
    name: 'tts',
    description: '语音合成',
    requiredKeysPaths: ['tts'],
  },
  openspeech: {
    name: 'openspeech',
    description: '语音识别',
    requiredKeysPaths: ['openspeech'],
  },
  // ── 风控 / 检测 ──
  'risk-detection': {
    name: 'risk-detection',
    description: '风控检测',
    requiredKeysPaths: ['risk'],
  },
  image: {
    name: 'image',
    description: '图片处理（火山引擎 Imagex）',
    requiredKeysPaths: ['image'],
  },
  // ── 信息查询 ──
  ipinfo: {
    name: 'ipinfo',
    description: 'IP 地理信息',
    requiredKeysPaths: ['ipinfo'],
  },
  'exchange-rate': {
    name: 'exchange-rate',
    description: '汇率查询',
    requiredKeysPaths: ['exchangerate'],
  },
};

// ============================================================================
// Helpers
// ============================================================================

function getByPath(obj: Record<string, unknown> | undefined, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => (acc as Record<string, unknown>)?.[key], obj);
}

/**
 * 检查功能是否"至少满足一个来源"：
 * - jwt/crypto 特殊处理：env 或 keys 二选一即可
 * - 其他功能：只检查 keysPaths 或 yamlPaths
 */
function isFeatureSatisfied(
  descriptor: FeatureDescriptor,
  ctx: FeatureValidationContext,
): { satisfied: boolean; missing: string[] } {
  const missing: string[] = [];

  // 对于同时声明了 env 和 keys 的功能（如 jwt, crypto），二选一即可
  if (descriptor.requiredEnvVars?.length && descriptor.requiredKeysPaths?.length) {
    const envOk = descriptor.requiredEnvVars.every((v) => ctx.env[v] !== undefined && ctx.env[v] !== '');
    const keysOk =
      !!ctx.keys &&
      descriptor.requiredKeysPaths.every((p) => getByPath(ctx.keys, p) !== undefined);
    if (!envOk && !keysOk) {
      missing.push(
        `需要环境变量 [${descriptor.requiredEnvVars.join(', ')}] 或 keys 配置 [${descriptor.requiredKeysPaths.join(', ')}]（二选一）`,
      );
    }
  } else {
    // 仅 env
    for (const envVar of descriptor.requiredEnvVars ?? []) {
      if (!ctx.env[envVar]) {
        missing.push(`缺少环境变量: ${envVar}`);
      }
    }
    // 仅 keys
    for (const keysPath of descriptor.requiredKeysPaths ?? []) {
      if (!ctx.keys || getByPath(ctx.keys, keysPath) === undefined) {
        missing.push(`缺少密钥配置: keys.${keysPath}`);
      }
    }
  }

  // yaml 路径始终单独检查
  for (const yamlPath of descriptor.requiredYamlPaths ?? []) {
    if (getByPath(ctx.yaml, yamlPath) === undefined) {
      missing.push(`缺少 YAML 配置: ${yamlPath}`);
    }
  }

  return { satisfied: missing.length === 0, missing };
}

// ============================================================================
// Validation
// ============================================================================

export function validateRequiredFeatures(
  requiredFeatures: string[],
  ctx: FeatureValidationContext,
): FeatureValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validatedFeatures: string[] = [];

  for (const featureName of requiredFeatures) {
    const trimmed = featureName.trim();
    if (!trimmed) continue;

    const descriptor = FEATURE_REGISTRY[trimmed];
    if (!descriptor) {
      warnings.push(`[Feature] 未知的功能声明: "${trimmed}"，已跳过`);
      continue;
    }

    const { satisfied, missing: featureErrors } = isFeatureSatisfied(descriptor, ctx);
    if (satisfied) {
      validatedFeatures.push(trimmed);
    } else {
      for (const err of featureErrors) {
        errors.push(`[Feature:${trimmed}] ${err}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    validatedFeatures,
  };
}
