/**
 * Configuration types for @dofe/infra-prisma-crud-generator.
 */

export interface DofePrismaCrudGeneratorConfig {
  /** Path to the Prisma schema file. */
  schemaPath: string;

  /** Directory where generated CRUD modules will be written. */
  modulesDir: string;

  /** Path where the barrel index file will be written. */
  indexPath: string;

  /** Models to exclude from generation. */
  excludeModels?: string[];

  /** Field name for soft-delete support (default: 'isDeleted'). */
  softDeleteField?: string;

  /** Default ordering for list queries. */
  defaultOrderBy?: Record<string, 'asc' | 'desc'>;

  /** Import paths for dependencies (customizable per project). */
  imports?: {
    prismaService: string;
    prismaModule: string;
    transactionalServiceBase: string;
    prismaError: string;
    pagination: string;
  };

  /** Output path for generated Prisma enum Zod schemas. */
  enumOutputPath?: string;

  /** Enum name mappings to resolve naming conflicts (e.g. { MdFileType: 'BotFocusFileType' }). */
  enumNameMappings?: Record<string, string>;

  /** Barrel index strategy: 'append' (default) or 'replace'. */
  indexStrategy?: 'append' | 'replace';

  /** Extra barrel exports to always include (used with 'replace' strategy). */
  indexManualExports?: string[];
}

export const DEFAULT_IMPORTS = {
  prismaService: '@dofe/infra-prisma',
  prismaModule: '@dofe/infra-prisma',
  transactionalServiceBase: '@dofe/infra-shared-db',
  prismaError: '@dofe/infra-common',
  pagination: '@dofe/infra-contracts',
};

export const DEFAULT_CONFIG: Partial<DofePrismaCrudGeneratorConfig> = {
  excludeModels: [],
  softDeleteField: 'isDeleted',
  imports: DEFAULT_IMPORTS,
  indexStrategy: 'append',
};
