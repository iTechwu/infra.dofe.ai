import { Injectable, Logger, OnModuleInit, Type } from '@nestjs/common';

/**
 * Module feature category for grouping related modules
 */
export type ModuleCategory =
  | 'database' // Database access modules (Prisma, DB services)
  | 'cache' // Caching modules (Redis)
  | 'queue' // Message queue modules (RabbitMQ)
  | 'client' // External API clients
  | 'domain' // Business domain modules
  | 'infrastructure' // Infrastructure services
  | 'integration' // Third-party integrations
  | 'feature' // Feature-specific modules
  | 'monitoring' // Health checks, monitoring
  | 'optional'; // Optional/enhancement modules

/**
 * Module registration metadata
 */
export interface ModuleRegistration {
  /** Unique module identifier */
  id: string;
  /** Module category for grouping */
  category: ModuleCategory;
  /** Module class reference */
  module: Type<any>;
  /** Human-readable name */
  name?: string;
  /** Module description */
  description?: string;
  /** Dependencies (module IDs that must be loaded first) */
  dependencies?: string[];
  /** Whether module is required for app to function */
  required?: boolean;
  /** Whether module is enabled (can be toggled via config) */
  enabled?: boolean;
  /** Priority for load order (lower = earlier) */
  priority?: number;
}

/**
 * Module group configuration
 */
export interface ModuleGroupConfig {
  /** Group ID */
  id: string;
  /** Display name */
  name: string;
  /** Module IDs in this group */
  modules: string[];
  /** Whether all modules in group are required */
  required?: boolean;
  /** Whether group is enabled by default */
  enabled?: boolean;
}

/**
 * Registry for dynamic module loading and dependency management.
 *
 * Provides:
 * - Module registration with metadata
 * - Dependency resolution
 * - Conditional loading based on config
 * - Load order optimization
 *
 * @example
 * ```typescript
 * // Register a module
 * moduleRegistry.register({
 *   id: 'bot-query',
 *   category: 'domain',
 *   module: BotQueryModule,
 *   dependencies: ['prisma', 'redis'],
 * });
 *
 * // Get modules for a feature
 * const modules = moduleRegistry.getModulesForFeature('bot-management');
 * ```
 */
@Injectable()
export class ModuleRegistry implements OnModuleInit {
  private readonly logger = new Logger(ModuleRegistry.name);
  private readonly registrations = new Map<string, ModuleRegistration>();
  private readonly categories = new Map<ModuleCategory, Set<string>>();
  private initialized = false;

  async onModuleInit() {
    if (this.initialized) return;

    // Validate dependencies after all registrations
    this.validateDependencies();

    // Log registration summary
    this.logRegistrationSummary();

    this.initialized = true;
  }

  /**
   * Register a module with metadata
   */
  register(registration: ModuleRegistration): void {
    if (this.registrations.has(registration.id)) {
      this.logger.warn(
        `Module "${registration.id}" already registered, overwriting`,
      );
    }

    this.registrations.set(registration.id, registration);

    // Add to category index
    if (!this.categories.has(registration.category)) {
      this.categories.set(registration.category, new Set());
    }
    this.categories.get(registration.category)!.add(registration.id);

    this.logger.debug(
      `Registered module: ${registration.id} [${registration.category}]`,
    );
  }

  /**
   * Register multiple modules at once
   */
  registerAll(registrations: ModuleRegistration[]): void {
    for (const reg of registrations) {
      this.register(reg);
    }
  }

  /**
   * Get a module registration by ID
   */
  get(id: string): ModuleRegistration | undefined {
    return this.registrations.get(id);
  }

  /**
   * Check if a module is registered
   */
  has(id: string): boolean {
    return this.registrations.has(id);
  }

  /**
   * Get all registered module IDs
   */
  getAllIds(): string[] {
    return Array.from(this.registrations.keys());
  }

  /**
   * Get all registrations
   */
  getAllRegistrations(): ModuleRegistration[] {
    return Array.from(this.registrations.values());
  }

  /**
   * Get modules by category
   */
  getByCategory(category: ModuleCategory): ModuleRegistration[] {
    const ids = this.categories.get(category);
    if (!ids) return [];

    return Array.from(ids)
      .map((id) => this.registrations.get(id)!)
      .filter(Boolean);
  }

  /**
   * Get module classes for dynamic import, sorted by dependencies and priority
   */
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

    // Filter registrations
    let filtered = this.getAllRegistrations();

    // Filter by category
    if (categories?.length) {
      filtered = filtered.filter((r) => categories.includes(r.category));
    }

    // Filter by enabled status
    if (onlyEnabled) {
      filtered = filtered.filter((r) => r.enabled !== false);
    }

    // Filter optional modules
    if (!includeOptional) {
      filtered = filtered.filter((r) => r.required !== false);
    }

    // Sort by dependencies and priority
    const sorted = this.topologicalSort(filtered);

    return sorted.map((r) => r.module);
  }

  /**
   * Get module classes for a specific feature set
   */
  getModulesForFeature(featureIds: string[]): Type<any>[] {
    const featureModules: ModuleRegistration[] = [];

    for (const id of featureIds) {
      const reg = this.registrations.get(id);
      if (reg) {
        featureModules.push(reg);
        // Include dependencies
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

  /**
   * Validate all module dependencies exist
   */
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

  /**
   * Get all dependencies for a module recursively
   */
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

  /**
   * Topological sort for dependency-ordered loading
   */
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

      // Visit dependencies first
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

    // Sort by priority first (lower priority = earlier)
    const byPriority = [...registrations].sort(
      (a, b) => (a.priority ?? 100) - (b.priority ?? 100),
    );

    for (const reg of byPriority) {
      visit(reg);
    }

    return sorted;
  }

  /**
   * Log registration summary
   */
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
