/**
 * ModuleRegistry 模块导出
 *
 * 提供通用的模块注册和动态加载功能，不包含任何业务模块定义。
 * 业务模块映射应放在各自的 API 模块或 domain 层。
 */

export { ModuleRegistryModule } from './module-registry.module';
export { ModuleRegistry } from './module-registry.service';
export type {
  ModuleRegistration,
  ModuleCategory,
  ModuleGroupConfig,
} from './module-registry.service';
export { DynamicFeatureModule } from './dynamic-feature.module';

// Auto-registration
export {
  RegisterModule,
  type RegisterModuleMetadata,
} from './register-module.decorator';
export {
  ModuleScanner,
  MODULE_SCANNER_OPTIONS,
  type ModuleScannerOptions,
} from './module-scanner.service';
