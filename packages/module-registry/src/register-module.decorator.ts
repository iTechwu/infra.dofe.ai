import { SetMetadata } from '@nestjs/common';
import type { ModuleCategory } from './module-registry.service';

export interface RegisterModuleMetadata {
  id: string;
  category: ModuleCategory;
  name?: string;
  description?: string;
  dependencies?: string[];
  required?: boolean;
  priority?: number;
  features?: string[];
}

export const MODULE_REGISTRATION_METADATA = 'module:registration';

export function RegisterModule(
  metadata: RegisterModuleMetadata,
): ClassDecorator {
  return (target: NewableFunction) => {
    SetMetadata(MODULE_REGISTRATION_METADATA, metadata)(target);
  };
}