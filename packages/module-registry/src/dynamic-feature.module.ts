import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { ModuleRegistry, ModuleRegistration } from './module-registry.service';

export interface FeatureConfig {
  id: string;
  modules: string[];
  providers?: Provider[];
  exports?: (string | Type<any>)[];
}

export interface DynamicFeatureModuleOptions {
  features: FeatureConfig[];
  autoRegister?: boolean;
  isGlobal?: boolean;
}

@Module({})
export class DynamicFeatureModule {
  static register(options: DynamicFeatureModuleOptions): DynamicModule {
    const { features, autoRegister = true, isGlobal = false } = options;

    const moduleClasses: Type<any>[] = [];
    const providers: Provider[] = [];
    const exports: (string | Type<any>)[] = [];

    for (const feature of features) {
      for (const moduleId of feature.modules) {
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

  static withRegistry(
    registrations: ModuleRegistration[],
    options?: {
      categories?: string[];
      includeOptional?: boolean;
      isGlobal?: boolean;
    },
  ): DynamicModule {
    const registry = new ModuleRegistry();
    registry.registerAll(registrations);

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

  private static resolveModule(moduleId: string): Type<any> {
    @Module({})
    class PlaceholderModule {}

    Object.defineProperty(PlaceholderModule, 'name', {
      value: `Placeholder_${moduleId}`,
    });

    return PlaceholderModule;
  }
}