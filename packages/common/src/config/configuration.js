"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setValidationEnabled = setValidationEnabled;
exports.getConfig = getConfig;
exports.getEnvConfig = getEnvConfig;
exports.getKeysConfig = getKeysConfig;
exports.initEnvValidation = initEnvValidation;
exports.validateEnvConfig = validateEnvConfig;
exports.initConfig = initConfig;
exports.validateYamlConfigResult = validateYamlConfigResult;
exports.initKeysConfig = initKeysConfig;
exports.getSecretConfigByKey = getSecretConfigByKey;
exports.validateKeysConfigResult = validateKeysConfigResult;
exports.initAllConfig = initAllConfig;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
const process = __importStar(require("process"));
const api_exception_1 = require("../filter/exception/api.exception");
const validation_1 = require("./validation");
const enviroment_util_1 = __importDefault(require("../../../utils/dist/enviroment.util"));
// ============================================================================
// Configuration State
// ============================================================================
let config = undefined;
let envConfig = undefined;
let keysConfig = undefined;
let validationEnabled = true;
/**
 * Enable or disable configuration validation
 * Useful for testing or dev scenarios
 */
function setValidationEnabled(enabled) {
    validationEnabled = enabled;
}
// ============================================================================
// Configuration Getters
// ============================================================================
/**
 * 获取项目根目录路径
 * 处理 Windows 环境下 $(pwd) 未展开的问题
 */
function getProjectRoot() {
    let projectRoot = process.env.PROJECT_ROOT;
    // 如果 PROJECT_ROOT 包含 $(pwd)，则替换为实际的工作目录
    if (projectRoot && projectRoot.includes('$(pwd)')) {
        projectRoot = projectRoot.replace('$(pwd)', process.cwd());
    }
    // 如果 PROJECT_ROOT 未设置或为空，使用当前工作目录
    if (!projectRoot) {
        projectRoot = process.cwd();
    }
    return projectRoot;
}
function getConfig() {
    return config;
}
/**
 * Get validated environment configuration
 */
function getEnvConfig() {
    return envConfig;
}
/**
 * Get validated keys configuration
 */
function getKeysConfig() {
    return keysConfig;
}
// ============================================================================
// Environment Validation
// ============================================================================
/**
 * Initialize and validate environment variables
 * Should be called early in application bootstrap
 *
 * @throws Error in production if validation fails
 */
function initEnvValidation() {
    if (!validationEnabled) {
        console.log('⚠️  Environment validation disabled');
        return process.env;
    }
    try {
        envConfig = (0, validation_1.validateEnv)();
        return envConfig;
    }
    catch (error) {
        // In dev, log warning but allow startup
        if (!process.env.NODE_ENV?.startsWith('prod')) {
            console.warn('⚠️  Environment validation failed, continuing in dev mode');
            return process.env;
        }
        throw error;
    }
}
/**
 * Validate environment without throwing
 */
function validateEnvConfig() {
    return (0, validation_1.validateEnvSafe)();
}
// ============================================================================
// YAML Configuration
// ============================================================================
async function initConfig() {
    try {
        // 获取项目根目录
        const projectRoot = getProjectRoot();
        // 获取 YAML 配置文件名，若环境变量未设置，则使用默认值 'config.local.yaml'
        const YAML_CONFIG_FILENAME = process.env.YAML_CONFIG_FILENAME || 'config.local.yaml';
        // 构建配置文件路径
        const configPath = path.join(projectRoot, YAML_CONFIG_FILENAME);
        if (enviroment_util_1.default.isProduction()) {
            console.log(`✅ Loading config from: ${configPath}`);
        }
        if (!(0, fs_1.existsSync)(configPath)) {
            throw new Error(`Configuration file not found: ${configPath}`);
        }
        // 读取 YAML 配置文件内容
        const rawConfig = yaml.load((0, fs_1.readFileSync)(configPath, 'utf8'));
        if (enviroment_util_1.default.isProduction()) {
            console.log('✅ Config loaded successfully, validating...');
        }
        // 使用 Zod 验证配置
        if (validationEnabled) {
            try {
                const validated = (0, validation_1.validateYamlConfig)(rawConfig);
                config = validated;
            }
            catch (validationError) {
                // In dev, log warning but continue with raw config
                if (!process.env.NODE_ENV?.startsWith('prod')) {
                    console.warn('⚠️  YAML validation failed, using raw config in dev mode');
                    console.warn(validationError);
                    config = rawConfig;
                }
                else {
                    throw validationError;
                }
            }
        }
        else {
            config = rawConfig;
        }
        if (enviroment_util_1.default.isProduction()) {
            console.log('✅ Config validation completed successfully');
        }
    }
    catch (error) {
        console.error('Error in initConfig:', error);
        throw error;
    }
}
/**
 * Validate YAML config without throwing
 */
function validateYamlConfigResult(rawConfig) {
    return (0, validation_1.validateYamlConfigSafe)(rawConfig);
}
// ============================================================================
// Keys Configuration
// ============================================================================
/**
 * Initialize and validate keys configuration
 * Loads and validates the entire keys/config.json file
 */
function initKeysConfig() {
    const projectRoot = getProjectRoot();
    const keysConfigPath = `${projectRoot}/keys/config.json`;
    if (!(0, fs_1.existsSync)(keysConfigPath)) {
        console.warn(`⚠️  Keys config file not found: ${keysConfigPath}`);
        return undefined;
    }
    try {
        const rawConfig = JSON.parse((0, fs_1.readFileSync)(keysConfigPath, 'utf8'));
        if (validationEnabled) {
            try {
                keysConfig = (0, validation_1.validateKeysConfig)(rawConfig);
            }
            catch (validationError) {
                // In dev, log warning but continue with raw config
                if (!process.env.NODE_ENV?.startsWith('prod')) {
                    console.warn('⚠️  Keys validation failed, using raw config in dev mode');
                    console.warn(validationError);
                    keysConfig = rawConfig;
                }
                else {
                    throw validationError;
                }
            }
        }
        else {
            keysConfig = rawConfig;
        }
        return keysConfig;
    }
    catch (error) {
        console.error('Error loading keys config:', error);
        throw error;
    }
}
/**
 * Get a specific key from the keys configuration
 * @deprecated Use getKeysConfig() and access properties directly for type safety
 */
function getSecretConfigByKey(key) {
    const projectRoot = getProjectRoot();
    const keysConfigPath = path.join(projectRoot, 'keys', 'config.json');
    const keysConfig = JSON.parse((0, fs_1.readFileSync)(keysConfigPath, 'utf8'));
    if (!Object.prototype.hasOwnProperty.call(keysConfig, key)) {
        throw new api_exception_1.ApiException('invalidEnv', `Key "${key}" not found in keys config`);
    }
    return keysConfig[key];
}
/**
 * Validate keys config without throwing
 */
function validateKeysConfigResult(rawConfig) {
    return (0, validation_1.validateKeysConfigSafe)(rawConfig);
}
// ============================================================================
// Full Configuration Initialization
// ============================================================================
/**
 * Initialize all configuration with validation
 * Call this in application bootstrap
 */
async function initAllConfig() {
    console.log('🔧 Initializing all configuration...');
    // 1. Validate environment variables
    const env = initEnvValidation();
    // 2. Load and validate YAML config
    await initConfig();
    // 3. Load and validate keys config
    const keys = initKeysConfig();
    console.log('✅ All configuration initialized successfully');
    return {
        env,
        yaml: config,
        keys,
    };
}
//# sourceMappingURL=configuration.js.map