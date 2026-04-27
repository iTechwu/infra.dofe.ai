"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envSchema = void 0;
exports.validateEnv = validateEnv;
exports.validateEnvSafe = validateEnvSafe;
exports.getEnvVar = getEnvVar;
/**
 * Environment Variables Validation Schema
 *
 * Validates environment variables at startup using Zod.
 * Ensures all required configuration is present before the application starts.
 */
const zod_1 = require("zod");
/**
 * Environment variable schema definition
 */
exports.envSchema = zod_1.z.object({
    // Environment
    NODE_ENV: zod_1.z.enum(['dev', 'test', 'prod', 'produs', 'prodap']).default('dev'),
    // Project root path
    PROJECT_ROOT: zod_1.z.string().optional(),
    // YAML config filename
    YAML_CONFIG_FILENAME: zod_1.z.string().default('config.local.yaml'),
    // Base host for local services
    BASE_HOST: zod_1.z.string().default('127.0.0.1'),
    // Database URLs
    DATABASE_URL: zod_1.z
        .string()
        .url()
        .refine((url) => url.startsWith('postgresql://'), {
        message: 'DATABASE_URL must be a PostgreSQL URL',
    }),
    READ_DATABASE_URL: zod_1.z
        .string()
        .url()
        .refine((url) => url.startsWith('postgresql://'), {
        message: 'READ_DATABASE_URL must be a PostgreSQL URL',
    })
        .optional(),
    // Redis URL
    REDIS_URL: zod_1.z.string().refine((url) => url.startsWith('redis://'), {
        message: 'REDIS_URL must be a Redis URL',
    }),
    // RabbitMQ URL
    RABBITMQ_URL: zod_1.z.string().refine((url) => url.startsWith('amqp://'), {
        message: 'RABBITMQ_URL must be an AMQP URL',
    }),
    // S3 和日志配置已迁移到 config.local.yaml -> app 节点:
    // - enableRetryMechanism, enableEnhancedLogging, maxRetries, baseRetryDelay
    // - nestLogOutput
    // External services
    API_BASE_URL: zod_1.z.string().url().optional(),
    INTERNAL_API_BASE_URL: zod_1.z.string().url().optional(),
});
/**
 * Validates environment variables against the schema
 *
 * @returns Validated environment configuration
 * @throws Error if validation fails in production
 */
function validateEnv() {
    // Expand environment variables in values (e.g., ${BASE_HOST})
    const expandedEnv = expandEnvVariables(process.env);
    const result = exports.envSchema.safeParse(expandedEnv);
    if (!result.success) {
        // Zod 4 uses issues instead of errors
        const issues = result.error.issues || [];
        const errorMessages = issues
            .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
            .join('\n');
        console.error('❌ Environment variable validation failed:');
        console.error(errorMessages);
        // In production, throw an error to prevent startup
        if (process.env.NODE_ENV?.startsWith('prod')) {
            throw new Error(`Environment validation failed:\n${errorMessages}`);
        }
        // In dev, log warning but continue
        console.warn('⚠️  Continuing with invalid environment in dev mode');
        return expandedEnv;
    }
    console.log('✅ Environment variables validated successfully');
    return result.data;
}
/**
 * Validates environment variables and returns detailed result
 *
 * @returns Validation result with success status and data or errors
 */
function validateEnvSafe() {
    const expandedEnv = expandEnvVariables(process.env);
    const result = exports.envSchema.safeParse(expandedEnv);
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
function expandEnvVariables(env) {
    const expanded = { ...env };
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
function getEnvVar(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined && defaultValue === undefined) {
        throw new Error(`Environment variable ${key} is required but not set`);
    }
    return value ?? defaultValue ?? '';
}
//# sourceMappingURL=env.validation.js.map