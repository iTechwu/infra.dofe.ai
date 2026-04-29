import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { ModuleRegistry, ModuleRegistration } from './module-registry.service';

/**
 * Feature module configuration
 */
export interface FeatureConfig {
  /** Feature identifier */
  id: string;
  /** Module IDs to include */
  modules: string[];
  /** Additional providers to register */
  providers?: Provider[];
  /** Additional exports */
  exports?: (string | Type<any>)[];
}

/**
 * Options for DynamicFeatureModule
 */
export interface DynamicFeatureModuleOptions {
  /** Feature configurations */
  features: FeatureConfig[];
  /** Auto-register modules to registry */
  autoRegister?: boolean;
  /** Global module (available everywhere) */
  isGlobal?: boolean;
}

/**
 * Dynamic module that loads feature-specific modules on demand.
 *
 * Reduces the "dependency explosion" problem by grouping related modules
 * and loading them conditionally based on feature flags or configuration.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     DynamicFeatureModule.register({
 *       features: [
 *         {
 *           id: 'bot-management',
 *           modules: ['bot-query', 'bot-sse', 'bot-config-resolver'],
 *         },
 *         {
 *           id: 'model-management',
 *           modules: ['model-sync', 'model-verification'],
 *         },
 *       ],
 *     }),
 *   ],
 * })
 * export class BotApiModule {}
 * ```
 */
@Module({})
export class DynamicFeatureModule {
  /**
   * Create a dynamic module with feature-based loading
   */
  static register(options: DynamicFeatureModuleOptions): DynamicModule {
    const { features, autoRegister = true, isGlobal = false } = options;

    // Collect all module classes from features
    const moduleClasses: Type<any>[] = [];
    const providers: Provider[] = [];
    const exports: (string | Type<any>)[] = [];

    for (const feature of features) {
      for (const moduleId of feature.modules) {
        // In a real implementation, we would resolve module IDs to actual classes
        // For now, this requires pre-registered modules in ModuleRegistry
        moduleClasses.push(this.resolveModule(moduleId));
      }

      if (feature.providers) {
        providers.push(...feature.providers);
      }

      if (feature.exports) {
        exports.push(...feature.exports);
      }
    }

    return {
      module: DynamicFeatureModule,
      imports: moduleClasses,
      providers: autoRegister ? [ModuleRegistry, ...providers] : providers,
      exports: [...exports],
      global: isGlobal,
    };
  }

  /**
   * Create a dynamic module with pre-configured module map
   *
   * Use this when you have a static mapping of module IDs to classes
   */
  static withModuleMap(
    moduleMap: Record<string, Type<any>>,
    featureIds: string[],
    options?: { isGlobal?: boolean },
  ): DynamicModule {
    const modules: Type<any>[] = [];

    for (const id of featureIds) {
      const moduleClass = moduleMap[id];
      if (moduleClass) {
        modules.push(moduleClass);
      }
    }

    return {
      module: DynamicFeatureModule,
      imports: modules,
      global: options?.isGlobal,
    };
  }

  /**
   * Create a dynamic module with registry integration
   *
   * This approach registers all modules to the registry first,
   * then uses dependency resolution to determine load order
   */
  static withRegistry(
    registrations: ModuleRegistration[],
    options?: {
      categories?: string[];
      includeOptional?: boolean;
      isGlobal?: boolean;
    },
  ): DynamicModule {
    // Create a temporary registry for resolution
    const registry = new ModuleRegistry();
    registry.registerAll(registrations);

    // Get modules in dependency order
    const modules = registry.getModuleClasses({
      categories: options?.categories as any,
      includeOptional: options?.includeOptional,
    });

    return {
      module: DynamicFeatureModule,
      imports: modules,
      providers: [ModuleRegistry],
      exports: [ModuleRegistry],
      global: options?.isGlobal,
    };
  }

  /**
   * Resolve module ID to class
   *
   * In a real implementation, this could use:
   * - A static module map
   * - Dynamic import()
   * - ModuleRegistry lookup
   */
  private static resolveModule(moduleId: string): Type<any> {
    // Placeholder - in real implementation, this would resolve to actual module class
    // For now, return a dummy module that will be replaced
    @Module({})
    class PlaceholderModule {}

    Object.defineProperty(PlaceholderModule, 'name', {
      value: `Placeholder_${moduleId}`,
    });

    return PlaceholderModule;
  }
}
