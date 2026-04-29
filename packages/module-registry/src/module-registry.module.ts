import { Module, Global, DynamicModule, Provider } from '@nestjs/common';
import { ModuleRegistry } from './module-registry.service';
import {
  ModuleScanner,
  MODULE_SCANNER_OPTIONS,
  ModuleScannerOptions,
} from './module-scanner.service';

@Global()
@Module({
  providers: [ModuleRegistry, ModuleScanner],
  exports: [ModuleRegistry, ModuleScanner],
})
export class ModuleRegistryModule {
  static withOptions(options: ModuleScannerOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: MODULE_SCANNER_OPTIONS,
      useValue: options,
    };

    return {
      module: ModuleRegistryModule,
      providers: [ModuleRegistry, ModuleScanner, optionsProvider],
      exports: [ModuleRegistry, ModuleScanner],
      global: true,
    };
  }

  static withoutAutoScan(): DynamicModule {
    return this.withOptions({ autoScan: false });
  }
}