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

/**
 * Options for ModuleScanner
 */
export interface ModuleScannerOptions {
  /** Whether to scan all modules automatically on init */
  autoScan?: boolean;
  /** Module IDs to exclude from registration */
  excludeIds?: string[];
  /** Categories to exclude from registration */
  excludeCategories?: string[];
  /** Log discovered modules */
  verbose?: boolean;
}

/** DI token for scanner options */
export const MODULE_SCANNER_OPTIONS = 'MODULE_SCANNER_OPTIONS';

/**
 * ModuleScanner - Auto-discovers and registers modules with ModuleRegistry.
 *
 * This service scans all loaded NestJS modules and automatically registers
 * those decorated with @RegisterModule() to the ModuleRegistry.
 *
 * @example
 * ```typescript
 * // In app.module.ts
 * @Module({
 *   imports: [
 *     ModuleRegistryModule,
 *     // Scanner will auto-discover modules below
 *     BotQueryModule,
 *     BotSseModule,
 *   ],
 *   providers: [
 *     {
 *       provide: MODULE_SCANNER_OPTIONS,
 *       useValue: { verbose: true },
 *     },
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
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

  /**
   * Scan all modules and register those with @RegisterModule decorator
   */
  async scanAndRegister(): Promise<number> {
    const discovered: ModuleRegistration[] = [];
    const excludedIds = new Set(this.options.excludeIds || []);
    const excludedCategories = new Set(this.options.excludeCategories || []);

    // Scan all modules in the container
    for (const [, moduleRef] of this.modulesContainer) {
      const registration = this.extractModuleRegistration(moduleRef);

      if (registration) {
        // Check exclusions
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

    // Register all discovered modules
    this.registry.registerAll(discovered);

    this.logger.log(
      `ModuleScanner discovered ${discovered.length} modules with @RegisterModule()`,
    );

    if (this.options.verbose) {
      this.logDiscoveredModules(discovered);
    }

    return discovered.length;
  }

  /**
   * Extract registration metadata from a module
   */
  private extractModuleRegistration(moduleRef: {
    metatype: Type<unknown> | null | undefined;
  }): ModuleRegistration | null {
    // Get the module class
    const moduleClass = moduleRef.metatype;

    if (!moduleClass) {
      return null;
    }

    // Check for @RegisterModule decorator
    const metadata = Reflect.getMetadata(
      MODULE_REGISTRATION_METADATA,
      moduleClass,
    ) as ModuleRegistration | undefined;

    if (!metadata) {
      return null;
    }

    // Build full registration
    const registration: ModuleRegistration = {
      ...metadata,
      module: moduleClass as Type<any>,
      enabled: true,
    };

    return registration;
  }

  /**
   * Get all modules that would be registered (without actually registering)
   */
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

  /**
   * Manually register a specific module
   */
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

  /**
   * Log discovered modules for debugging
   */
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
