import { readFileSync, existsSync } from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as process from 'process';
import { ApiException } from '../filter/exception/api.exception';
import {
  validateEnv,
  validateEnvSafe,
  validateYamlConfig,
  validateYamlConfigSafe,
  validateKeysConfig,
  validateKeysConfigSafe,
  type EnvConfig,
  type YamlConfig,
  type KeysConfig,
} from './validation';
import environment from '@dofe/infra-utils/environment.util';
import {
  validateRequiredFeatures,
  type FeatureValidationContext,
  type FeatureValidationResult,
} from './features';

// ============================================================================
// Configuration State
// ============================================================================

let config: YamlConfig | undefined = undefined;
let envConfig: EnvConfig | undefined = undefined;
let keysConfig: KeysConfig | undefined;
let validationEnabled = true;

/**
 * Enable or disable configuration validation
 * Useful for testing or dev scenarios
 */
export function setValidationEnabled(enabled: boolean) {
  validationEnabled = enabled;
}

// ============================================================================
// Configuration Getters
// ============================================================================

function getProjectRoot(): string {
  let projectRoot = process.env.PROJECT_ROOT;

  if (projectRoot && projectRoot.includes('$(pwd)')) {
    projectRoot = projectRoot.replace('$(pwd)', process.cwd());
  }

  if (!projectRoot) {
    projectRoot = process.cwd();
  }

  return projectRoot;
}

export function getConfig(): YamlConfig | undefined {
  return config;
}

export function getEnvConfig(): EnvConfig | undefined {
  return envConfig;
}

export function getKeysConfig(): KeysConfig | undefined {
  return keysConfig;
}

// ============================================================================
// Environment Validation
// ============================================================================

export function initEnvValidation(): EnvConfig {
  if (!validationEnabled) {
    console.log('⚠️  Environment validation disabled');
    return process.env as unknown as EnvConfig;
  }

  try {
    envConfig = validateEnv();
    return envConfig;
  } catch (error) {
    if (!process.env.NODE_ENV?.startsWith('prod')) {
      console.warn('⚠️  Environment validation failed, continuing in dev mode');
      return process.env as unknown as EnvConfig;
    }
    throw error;
  }
}

export function validateEnvConfig() {
  return validateEnvSafe();
}

// ============================================================================
// YAML Configuration
// ============================================================================

export async function initConfig() {
  try {
    const projectRoot = getProjectRoot();

    const YAML_CONFIG_FILENAME =
      process.env.YAML_CONFIG_FILENAME || 'config.local.yaml';

    const configPath = path.join(projectRoot, YAML_CONFIG_FILENAME);

    if (environment.isProduction()) {
      console.log(`✅ Loading config from: ${configPath}`);
    }

    if (!existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    const rawConfig = yaml.load(readFileSync(configPath, 'utf8'));
    if (environment.isProduction()) {
      console.log('✅ Config loaded successfully, validating...');
    }

    if (validationEnabled) {
      try {
        const validated = validateYamlConfig(rawConfig) as unknown;
        config = validated as YamlConfig;
      } catch (validationError) {
        if (!process.env.NODE_ENV?.startsWith('prod')) {
          console.warn(
            '⚠️  YAML validation failed, using raw config in dev mode',
          );
          console.warn(validationError);
          config = rawConfig as YamlConfig;
        } else {
          throw validationError;
        }
      }
    } else {
      config = rawConfig as YamlConfig;
    }

    if (environment.isProduction()) {
      console.log('✅ Config validation completed successfully');
    }
  } catch (error) {
    console.error('Error in initConfig:', error);
    throw error;
  }
}

export function validateYamlConfigResult(rawConfig: unknown) {
  return validateYamlConfigSafe(rawConfig);
}

// ============================================================================
// Keys Configuration
// ============================================================================

export function initKeysConfig(): KeysConfig | undefined {
  const projectRoot = getProjectRoot();
  const keysConfigPath = `${projectRoot}/keys/config.json`;

  if (!existsSync(keysConfigPath)) {
    console.warn(`⚠️  Keys config file not found: ${keysConfigPath}`);
    return undefined;
  }

  try {
    const rawConfig = JSON.parse(readFileSync(keysConfigPath, 'utf8'));

    if (validationEnabled) {
      try {
        keysConfig = validateKeysConfig(rawConfig);
      } catch (validationError) {
        if (!process.env.NODE_ENV?.startsWith('prod')) {
          console.warn(
            '⚠️  Keys validation failed, using raw config in dev mode',
          );
          console.warn(validationError);
          keysConfig = rawConfig as KeysConfig;
        } else {
          throw validationError;
        }
      }
    } else {
      keysConfig = rawConfig as KeysConfig;
    }

    return keysConfig;
  } catch (error) {
    console.error('Error loading keys config:', error);
    throw error;
  }
}

/**
 * @deprecated Use getKeysConfig() and access properties directly for type safety
 */
export function getSecretConfigByKey(key: string) {
  const projectRoot = getProjectRoot();
  const keysConfigPath = path.join(projectRoot, 'keys', 'config.json');
  const keysConfig = JSON.parse(
    readFileSync(keysConfigPath, 'utf8'),
  ) as KeysConfig;

  if (!Object.prototype.hasOwnProperty.call(keysConfig, key)) {
    throw new ApiException(
      'invalidEnv',
      `Key "${key}" not found in keys config`,
    );
  }

  return keysConfig[key];
}

export function validateKeysConfigResult(rawConfig: unknown) {
  return validateKeysConfigSafe(rawConfig);
}

// ============================================================================
// Keys → Env Sync (向后兼容)
// ============================================================================

/**
 * 将 keys/config.json 中的核心密钥同步到 process.env，
 * 使现有 ConfigService.getOrThrow('JWT_SECRET') 等调用无需修改。
 */
function syncKeysToEnv(keys: KeysConfig): void {
  if (keys.jwt) {
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = keys.jwt.secret;
    }
    if (!process.env.JWT_EXPIRE_IN) {
      process.env.JWT_EXPIRE_IN = String(keys.jwt.expireIn ?? 3600);
    }
  }
  if (keys.crypto) {
    if (!process.env.CRYPTO_KEY) {
      process.env.CRYPTO_KEY = keys.crypto.key;
    }
    if (!process.env.CRYPTO_IV) {
      process.env.CRYPTO_IV = keys.crypto.iv;
    }
  }
  if (keys.encryption) {
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = keys.encryption.key;
    }
  }
}

// ============================================================================
// Feature Validation
// ============================================================================

function getRequiredFeaturesFromConfig(): string[] {
  const envVal = process.env.REQUIRED_FEATURES;
  const fromEnv: string[] = envVal
    ? envVal.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const fromYaml: string[] = config?.app?.requiredFeatures ?? [];
  return [...new Set([...fromEnv, ...fromYaml])];
}

function runFeatureValidation(): FeatureValidationResult | null {
  const requiredFeatures = getRequiredFeaturesFromConfig();
  if (requiredFeatures.length === 0) return null;

  const ctx: FeatureValidationContext = {
    env: process.env as Record<string, string>,
    yaml: (config ?? {}) as Record<string, unknown>,
    keys: (keysConfig ?? undefined) as Record<string, unknown> | undefined,
  };

  const result = validateRequiredFeatures(requiredFeatures, ctx);

  if (result.valid) {
    console.info(
      `[Config] ${result.validatedFeatures.length} 个功能校验通过 ✓`,
    );
  } else {
    const nodeEnv = process.env.NODE_ENV ?? 'dev';
    if (
      nodeEnv === 'prod' ||
      nodeEnv === 'produs' ||
      nodeEnv === 'prodap'
    ) {
      console.error('[Config] 功能配置校验失败:');
      result.errors.forEach((e) => console.error(`  ✗ ${e}`));
      throw new Error('配置校验失败，请检查上述缺失项');
    } else {
      console.warn('[Config] 功能配置校验警告 (dev 模式继续):');
      result.errors.forEach((e) => console.warn(`  ⚠ ${e}`));
    }
  }

  if (result.warnings.length > 0) {
    result.warnings.forEach((w) => console.warn(`  ⚠ ${w}`));
  }

  return result;
}

// ============================================================================
// Full Configuration Initialization
// ============================================================================

export async function initAllConfig(): Promise<{
  env: EnvConfig;
  yaml: YamlConfig;
  keys?: KeysConfig;
  featureValidation?: FeatureValidationResult | null;
}> {
  console.log('🔧 Initializing all configuration...');

  // 1. Validate environment variables
  const env = initEnvValidation();

  // 2. Load and validate YAML config
  await initConfig();

  // 3. Load and validate keys config
  const keys = initKeysConfig();

  // 4. Sync keys → process.env (backward compatibility)
  if (keys) {
    syncKeysToEnv(keys);
  }

  // 5. Feature validation (if REQUIRED_FEATURES is set)
  const featureValidation = runFeatureValidation();

  console.log('✅ All configuration initialized successfully');

  return {
    env,
    yaml: config,
    keys,
    featureValidation,
  };
}
