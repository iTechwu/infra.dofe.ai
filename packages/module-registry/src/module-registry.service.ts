import { Injectable, Logger, OnModuleInit, Type } from '@nestjs/common';

export type ModuleCategory =
  | 'database'
  | 'cache'
  | 'queue'
  | 'client'
  | 'domain'
  | 'infrastructure'
  | 'integration'
  | 'feature'
  | 'monitoring'
  | 'optional';

export interface ModuleRegistration {
  id: string;
  category: ModuleCategory;
  module: Type<any>;
  name?: string;
  description?: string;
  dependencies?: string[];
  required?: boolean;
  enabled?: boolean;
  priority?: number;
}

export interface ModuleGroupConfig {
  id: string;
  name: string;
  modules: string[];
  required?: boolean;
  enabled?: boolean;
}

@Injectable()
export class ModuleRegistry implements OnModuleInit {
  private readonly logger = new Logger(ModuleRegistry.name);
  private readonly registrations = new Map<string, ModuleRegistration>();
  private readonly categories = new Map<ModuleCategory, Set<string>>();
  private initialized = false;

  async onModuleInit() {
    if (this.initialized) return;
    this.validateDependencies();
    this.logRegistrationSummary();
    this.initialized = true;
  }

  register(registration: ModuleRegistration): void {
    if (this.registrations.has(registration.id)) {
      this.logger.warn(
        `Module "${registration.id}" already registered, overwriting`,
      );
    }

    this.registrations.set(registration.id, registration);

    if (!this.categories.has(registration.category)) {
      this.categories.set(registration.category, new Set());
    }
    this.categories.get(registration.category)!.add(registration.id);

    this.logger.debug(
      `Registered module: ${registration.id} [${registration.category}]`,
    );
  }

  registerAll(registrations: ModuleRegistration[]): void {
    for (const reg of registrations) {
      this.register(reg);
    }
  }

  get(id: string): ModuleRegistration | undefined {
    return this.registrations.get(id);
  }

  has(id: string): boolean {
    return this.registrations.has(id);
  }

  getAllIds(): string[] {
    return Array.from(this.registrations.keys());
  }

  getAllRegistrations(): ModuleRegistration[] {
    return Array.from(this.registrations.values());
  }

  getByCategory(category: ModuleCategory): ModuleRegistration[] {
    const ids = this.categories.get(category);
    if (!ids) return [];

    return Array.from(ids)
      .map((id) => this.registrations.get(id)!)
      .filter(Boolean);
  }

  getModuleClasses(options?: {
    categories?: ModuleCategory[];
    includeOptional?: boolean;
    onlyEnabled?: boolean;
  }): Type<any>[] {
    const {
      categories,
      includeOptional = true,
      onlyEnabled = true,
    } = options || {};

    let filtered = this.getAllRegistrations();

    if (categories?.length) {
      filtered = filtered.filter((r) => categories.includes(r.category));
    }

    if (onlyEnabled) {
      filtered = filtered.filter((r) => r.enabled !== false);
    }

    if (!includeOptional) {
      filtered = filtered.filter((r) => r.required !== false);
    }

    const sorted = this.topologicalSort(filtered);

    return sorted.map((r) => r.module);
  }

  getModulesForFeature(featureIds: string[]): Type<any>[] {
    const featureModules: ModuleRegistration[] = [];

    for (const id of featureIds) {
      const reg = this.registrations.get(id);
      if (reg) {
        featureModules.push(reg);
        const deps = this.getDependenciesRecursive(id);
        for (const depId of deps) {
          const depReg = this.registrations.get(depId);
          if (depReg && !featureModules.find((m) => m.id === depId)) {
            featureModules.push(depReg);
          }
        }
      }
    }

    return this.topologicalSort(featureModules).map((r) => r.module);
  }

  private validateDependencies(): void {
    const errors: string[] = [];

    for (const reg of this.registrations.values()) {
      if (reg.dependencies) {
        for (const depId of reg.dependencies) {
          if (!this.registrations.has(depId)) {
            errors.push(
              `Module "${reg.id}" depends on "${depId}" which is not registered`,
            );
          }
        }
      }
    }

    if (errors.length > 0) {
      this.logger.warn(
        `Module dependency validation found ${errors.length} issues:\n${errors.join('\n')}`,
      );
    }
  }

  private getDependenciesRecursive(
    moduleId: string,
    visited = new Set<string>(),
  ): string[] {
    const reg = this.registrations.get(moduleId);
    if (!reg?.dependencies) return [];

    const deps: string[] = [];
    for (const depId of reg.dependencies) {
      if (!visited.has(depId)) {
        visited.add(depId);
        deps.push(depId);
        deps.push(...this.getDependenciesRecursive(depId, visited));
      }
    }
    return deps;
  }

  private topologicalSort(
    registrations: ModuleRegistration[],
  ): ModuleRegistration[] {
    const sorted: ModuleRegistration[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (reg: ModuleRegistration) => {
      if (visited.has(reg.id)) return;
      if (visiting.has(reg.id)) {
        this.logger.warn(`Circular dependency detected at: ${reg.id}`);
        return;
      }

      visiting.add(reg.id);

      if (reg.dependencies) {
        for (const depId of reg.dependencies) {
          const depReg = this.registrations.get(depId);
          if (depReg && registrations.includes(depReg)) {
            visit(depReg);
          }
        }
      }

      visiting.delete(reg.id);
      visited.add(reg.id);
      sorted.push(reg);
    };

    const byPriority = [...registrations].sort(
      (a, b) => (a.priority ?? 100) - (b.priority ?? 100),
    );

    for (const reg of byPriority) {
      visit(reg);
    }

    return sorted;
  }

  private logRegistrationSummary(): void {
    const byCategory: Record<string, number> = {};

    for (const [category, ids] of this.categories) {
      byCategory[category] = ids.size;
    }

    this.logger.log(
      `Module registry initialized: ${this.registrations.size} modules across ${this.categories.size} categories`,
    );

    for (const [category, count] of Object.entries(byCategory)) {
      this.logger.debug(`  ${category}: ${count} modules`);
    }
  }
}