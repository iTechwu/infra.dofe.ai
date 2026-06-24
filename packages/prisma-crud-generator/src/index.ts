/**
 * @dofe/infra-prisma-crud-generator
 *
 * CLI tool for generating Prisma-based CRUD modules from schema definitions.
 *
 * Usage:
 *   dofe-prisma-crud generate --config dofe-prisma-crud.config.ts
 *
 * @example Configuration file (dofe-prisma-crud.config.ts):
 * ```ts
 * import type { DofePrismaCrudGeneratorConfig } from '@dofe/infra-prisma-crud-generator/config';
 *
 * const config: DofePrismaCrudGeneratorConfig = {
 *   schemaPath: 'apps/api/prisma/schema.prisma',
 *   modulesDir: 'apps/api/generated/db/modules',
 *   indexPath: 'apps/api/generated/db/index.ts',
 *   excludeModels: ['UserInfo'],
 *   softDeleteField: 'deletedAt',
 * };
 *
 * export default config;
 * ```
 */

export { type DofePrismaCrudGeneratorConfig, DEFAULT_IMPORTS, DEFAULT_CONFIG } from './config';

/**
 * Parse a Prisma schema file and extract model definitions.
 *
 * @param schemaContent - Raw Prisma schema content
 * @returns Array of parsed model info objects
 */
export function parsePrismaSchema(schemaContent: string): Array<{
  name: string;
  fields: Array<{ name: string; type: string; isRequired: boolean; isId: boolean }>;
}> {
  const models: Array<{
    name: string;
    fields: Array<{ name: string; type: string; isRequired: boolean; isId: boolean }>;
  }> = [];

  const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/gs;
  let match: RegExpExecArray | null;

  while ((match = modelRegex.exec(schemaContent)) !== null) {
    const modelName = match[1]!;
    const body = match[2]!;

    const fields: Array<{ name: string; type: string; isRequired: boolean; isId: boolean }> = [];
    const lines = body.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

      const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(\[\])?\s*(@id)?/);
      if (fieldMatch) {
        fields.push({
          name: fieldMatch[1]!,
          type: fieldMatch[2]!,
          isRequired: !trimmed.includes('?') && !trimmed.includes('[]'),
          isId: trimmed.includes('@id'),
        });
      }
    }

    models.push({ name: modelName, fields });
  }

  return models;
}
