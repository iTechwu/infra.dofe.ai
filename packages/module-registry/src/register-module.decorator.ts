import { SetMetadata } from '@nestjs/common';
import type { ModuleCategory } from './module-registry.service';

/**
 * Module registration metadata for auto-discovery
 */
export interface RegisterModuleMetadata {
  /** Unique module identifier */
  id: string;
  /** Module category for grouping */
  category: ModuleCategory;
  /** Human-readable name */
  name?: string;
  /** Module description */
  description?: string;
  /** Dependencies (module IDs that must be loaded first) */
  dependencies?: string[];
  /** Whether module is required for app to function */
  required?: boolean;
  /** Priority for load order (lower = earlier) */
  priority?: number;
  /** Feature IDs this module belongs to */
  features?: string[];
}

/**
 * Metadata key for module registration
 */
export const MODULE_REGISTRATION_METADATA = 'module:registration';

/**
 * Decorator to mark a module for auto-registration with ModuleRegistry.
 *
 * The ModuleScanner will discover all modules with this decorator
 * and register them with the ModuleRegistry during application bootstrap.
 *
 * @example
 * ```typescript
 * @RegisterModule({
 *   id: 'bot-query',
 *   category: 'domain',
 *   name: 'Bot Query Module',
 *   dependencies: ['prisma', 'redis'],
 *   features: ['bot-management'],
 * })
 * @Module({})
 * export class BotQueryModule {}
 * ```
 */
export function RegisterModule(
  metadata: RegisterModuleMetadata,
): ClassDecorator {
  return (target: NewableFunction) => {
    SetMetadata(MODULE_REGISTRATION_METADATA, metadata)(target);
  };
}
