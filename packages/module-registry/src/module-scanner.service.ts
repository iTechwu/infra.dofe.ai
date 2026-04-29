import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  Optional,
  Type,
} from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { ModuleRegistry, ModuleRegistration } from './module-registry.service';
import { MODULE_REGISTRATION_METADATA } from './register-module.decorator';

export interface ModuleScannerOptions {
  autoScan?: boolean;
  excludeIds?: string[];
  excludeCategories?: string[];
  verbose?: boolean;
}

export const MODULE_SCANNER_OPTIONS = 'MODULE_SCANNER_OPTIONS';

@Injectable()
export class ModuleScanner implements OnModuleInit {
  private readonly logger = new Logger(ModuleScanner.name);
  private readonly options: ModuleScannerOptions;

  constructor(
    private readonly registry: ModuleRegistry,
    private readonly modulesContainer: ModulesContainer,
    @Optional()
    @Inject(MODULE_SCANNER_OPTIONS)
    options?: ModuleScannerOptions,
  ) {
    this.options = {
      autoScan: true,
      verbose: false,
      ...options,
    };
  }

  async onModuleInit() {
    if (this.options.autoScan) {
      await this.scanAndRegister();
    }
  }

  async scanAndRegister(): Promise<number> {
    const discovered: ModuleRegistration[] = [];
    const excludedIds = new Set(this.options.excludeIds || []);
    const excludedCategories = new Set(this.options.excludeCategories || []);

    for (const [, moduleRef] of this.modulesContainer) {
      const registration = this.extractModuleRegistration(moduleRef);

      if (registration) {
        if (excludedIds.has(registration.id)) {
          this.logger.debug(`Skipping excluded module: ${registration.id}`);
          continue;
        }

        if (excludedCategories.has(registration.category)) {
          this.logger.debug(
            `Skipping excluded category: ${registration.category} (${registration.id})`,
          );
          continue;
        }

        discovered.push(registration);
      }
    }

    this.registry.registerAll(discovered);

    this.logger.log(
      `ModuleScanner discovered ${discovered.length} modules with @RegisterModule()`,
    );

    if (this.options.verbose) {
      this.logDiscoveredModules(discovered);
    }

    return discovered.length;
  }

  private extractModuleRegistration(moduleRef: {
    metatype: Type<unknown> | null | undefined;
  }): ModuleRegistration | null {
    const moduleClass = moduleRef.metatype;

    if (!moduleClass) {
      return null;
    }

    const metadata = Reflect.getMetadata(
      MODULE_REGISTRATION_METADATA,
      moduleClass,
    ) as ModuleRegistration | undefined;

    if (!metadata) {
      return null;
    }

    const registration: ModuleRegistration = {
      ...metadata,
      module: moduleClass as Type<any>,
      enabled: true,
    };

    return registration;
  }

  previewModules(): ModuleRegistration[] {
    const discovered: ModuleRegistration[] = [];

    for (const [, moduleRef] of this.modulesContainer) {
      const registration = this.extractModuleRegistration(moduleRef);
      if (registration) {
        discovered.push(registration);
      }
    }

    return discovered;
  }

  registerModule(moduleClass: Type<any>): boolean {
    const metadata = Reflect.getMetadata(
      MODULE_REGISTRATION_METADATA,
      moduleClass,
    ) as ModuleRegistration | undefined;

    if (!metadata) {
      this.logger.warn(
        `Module ${moduleClass.name} does not have @RegisterModule decorator`,
      );
      return false;
    }

    this.registry.register({
      ...metadata,
      module: moduleClass,
      enabled: true,
    });

    return true;
  }

  private logDiscoveredModules(modules: ModuleRegistration[]): void {
    const byCategory: Record<string, ModuleRegistration[]> = {};

    for (const mod of modules) {
      const cat = mod.category;
      if (!byCategory[cat]) {
        byCategory[cat] = [];
      }
      byCategory[cat].push(mod);
    }

    this.logger.debug('Discovered modules by category:');
    for (const [category, mods] of Object.entries(byCategory)) {
      this.logger.debug(`  ${category}:`);
      for (const mod of mods) {
        const deps = mod.dependencies?.length
          ? ` deps: [${mod.dependencies.join(', ')}]`
          : '';
        this.logger.debug(`    - ${mod.id}${deps}`);
      }
    }
  }
}