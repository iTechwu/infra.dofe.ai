import { type EnvConfig, type YamlConfig, type KeysConfig } from './validation';
/**
 * Enable or disable configuration validation
 * Useful for testing or dev scenarios
 */
export declare function setValidationEnabled(enabled: boolean): void;
export declare function getConfig(): YamlConfig | undefined;
/**
 * Get validated environment configuration
 */
export declare function getEnvConfig(): EnvConfig | undefined;
/**
 * Get validated keys configuration
 */
export declare function getKeysConfig(): KeysConfig | undefined;
/**
 * Initialize and validate environment variables
 * Should be called early in application bootstrap
 *
 * @throws Error in production if validation fails
 */
export declare function initEnvValidation(): EnvConfig;
/**
 * Validate environment without throwing
 */
export declare function validateEnvConfig(): import("./validation").EnvValidationResult;
export declare function initConfig(): Promise<void>;
/**
 * Validate YAML config without throwing
 */
export declare function validateYamlConfigResult(rawConfig: unknown): import("./validation").YamlValidationResult;
/**
 * Initialize and validate keys configuration
 * Loads and validates the entire keys/config.json file
 */
export declare function initKeysConfig(): KeysConfig | undefined;
/**
 * Get a specific key from the keys configuration
 * @deprecated Use getKeysConfig() and access properties directly for type safety
 */
export declare function getSecretConfigByKey(key: string): z.infer<any>;
/**
 * Validate keys config without throwing
 */
export declare function validateKeysConfigResult(rawConfig: unknown): import("./validation").KeysValidationResult;
/**
 * Initialize all configuration with validation
 * Call this in application bootstrap
 */
export declare function initAllConfig(): Promise<{
    env: EnvConfig;
    yaml: YamlConfig;
    keys?: KeysConfig;
}>;
