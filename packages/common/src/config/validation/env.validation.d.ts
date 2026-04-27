/**
 * Environment Variables Validation Schema
 *
 * Validates environment variables at startup using Zod.
 * Ensures all required configuration is present before the application starts.
 */
import { z } from 'zod';
/**
 * Environment variable schema definition
 */
export declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<{
        dev: "dev";
        test: "test";
        prod: "prod";
        produs: "produs";
        prodap: "prodap";
    }>>;
    PROJECT_ROOT: z.ZodOptional<z.ZodString>;
    YAML_CONFIG_FILENAME: z.ZodDefault<z.ZodString>;
    BASE_HOST: z.ZodDefault<z.ZodString>;
    DATABASE_URL: z.ZodString;
    READ_DATABASE_URL: z.ZodOptional<z.ZodString>;
    REDIS_URL: z.ZodString;
    RABBITMQ_URL: z.ZodString;
    API_BASE_URL: z.ZodOptional<z.ZodString>;
    INTERNAL_API_BASE_URL: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
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
export declare function validateEnv(): EnvConfig;
/**
 * Validates environment variables and returns detailed result
 *
 * @returns Validation result with success status and data or errors
 */
export declare function validateEnvSafe(): EnvValidationResult;
/**
 * Get a single environment variable with validation
 *
 * @param key - Environment variable key
 * @param defaultValue - Default value if not set
 * @returns Environment variable value
 */
export declare function getEnvVar(key: keyof EnvConfig, defaultValue?: string): string;
