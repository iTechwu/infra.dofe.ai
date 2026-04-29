export { ModuleRegistryModule } from './module-registry.module';
export { ModuleRegistry } from './module-registry.service';
export type {
  ModuleRegistration,
  ModuleCategory,
  ModuleGroupConfig,
} from './module-registry.service';
export { DynamicFeatureModule } from './dynamic-feature.module';
export {
  RegisterModule,
  type RegisterModuleMetadata,
} from './register-module.decorator';
export {
  ModuleScanner,
  MODULE_SCANNER_OPTIONS,
  type ModuleScannerOptions,
} from './module-scanner.service';