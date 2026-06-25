/**
 * @dofe/infra-prisma-crud-generator
 *
 * CLI tool for generating Prisma-based CRUD modules from schema definitions.
 */

import * as fs from 'fs';

export { type DofePrismaCrudGeneratorConfig, DEFAULT_IMPORTS, DEFAULT_CONFIG } from './config';

// ============================================================================
// Schema Parser
// ============================================================================

export interface ParsedField {
  name: string;
  type: string;
  isRequired: boolean;
  isList: boolean;
  isId: boolean;
  isUnique: boolean;
  hasRelation: boolean;
  mapName?: string;
}

export interface ParsedModel {
  name: string;
  kebab: string;
  fields: ParsedField[];
  idField?: ParsedField;
  uniqueFields: ParsedField[];
  compositeUniques: string[][];
  hasIsDeleted: boolean;
  hasCreatedAt: boolean;
  hasRelations: boolean;
}

export interface ParsedEnum {
  name: string;
  values: Array<{ name: string; mapValue?: string }>;
  comment?: string;
}

/** Convert PascalCase to kebab-case */
function pascalToKebab(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/** Collect all model names for relation detection */
function collectModelNames(schemaContent: string): Set<string> {
  const names = new Set<string>();
  const modelRegex = /model\s+(\w+)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = modelRegex.exec(schemaContent)) !== null) {
    names.add(match[1]!);
  }
  return names;
}

export function parsePrismaSchema(schemaContent: string): ParsedModel[] {
  const modelNames = collectModelNames(schemaContent);
  const models: ParsedModel[] = [];

  const modelRegex = /model\s+(\w+)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = modelRegex.exec(schemaContent)) !== null) {
    const modelName = match[1]!;
    const blockStart = match.index + match[0].length;
    const blockEnd = findMatchingBrace(schemaContent, blockStart);
    const body = schemaContent.slice(blockStart, blockEnd);

    const fields = parseFields(body, modelNames);
    const idField = fields.find(f => f.isId);
    const uniqueFields = fields.filter(f => f.isUnique);
    const compositeUniques = parseCompositeUniques(body);
    const hasIsDeleted = fields.some(f => f.name === 'isDeleted' && f.type === 'Boolean');
    const hasCreatedAt = fields.some(f => f.name === 'createdAt' && f.type === 'DateTime');
    const hasRelations = fields.some(f => f.hasRelation);

    models.push({
      name: modelName,
      kebab: pascalToKebab(modelName),
      fields,
      idField,
      uniqueFields,
      compositeUniques,
      hasIsDeleted,
      hasCreatedAt,
      hasRelations,
    });
  }

  return models;
}

function findMatchingBrace(content: string, start: number): number {
  let depth = 1;
  let i = start;
  while (i < content.length && depth > 0) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') depth--;
    i++;
  }
  return i - 1;
}

function parseFields(body: string, modelNames: Set<string>): ParsedField[] {
  const fields: ParsedField[] = [];
  const lines = body.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

    const fieldMatch = trimmed.match(
      /^(\w+)\s+(\w+)(\[\])?\s*((?:@\w+(?:\([^)]*\))?\s*)*)(?:\/\/.*)?$/,
    );
    if (!fieldMatch) continue;

    const [, name, type, listMarker, annotations] = fieldMatch;
    const isList = !!listMarker;
    const isRequired = !trimmed.includes('?') && !isList;
    const isId = annotations?.includes('@id') ?? false;
    const isUnique = annotations?.includes('@unique') ?? false;
    const hasRelation = (annotations?.includes('@relation') ?? false) || (type ? modelNames.has(type) : false);

    const mapMatch = annotations?.match(/@map\("([^"]+)"\)/);

    fields.push({
      name: name!,
      type: type!,
      isRequired,
      isList,
      isId,
      isUnique,
      hasRelation,
      mapName: mapMatch?.[1],
    });
  }

  return fields;
}

function parseCompositeUniques(body: string): string[][] {
  const result: string[][] = [];
  const regex = /@@unique\(\[([^\]]+)\]\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    result.push(match[1]!.split(',').map(s => s.trim()));
  }
  return result;
}

// ============================================================================
// Enum Parser
// ============================================================================

export function parsePrismaEnums(schemaContent: string): ParsedEnum[] {
  const enums: ParsedEnum[] = [];
  // Match enum blocks with optional doc comments preceding them
  const enumRegex = /(?:^\s*\/\/\s*(.+)\s*\n)?^\s*enum\s+(\w+)\s*\{([^}]*)\}/gm;
  let match: RegExpExecArray | null;

  while ((match = enumRegex.exec(schemaContent)) !== null) {
    const comment = match[1] || undefined;
    const name = match[2]!;
    const body = match[3]!;
    const values: Array<{ name: string; mapValue?: string }> = [];

    const valueLines = body.split('\n');
    for (const line of valueLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;
      const valueMatch = trimmed.match(/^(\w+)(?:\s+@map\("([^"]+)"\))?/);
      if (valueMatch) {
        values.push({
          name: valueMatch[1]!,
          mapValue: valueMatch[2],
        });
      }
    }

    if (values.length > 0) {
      enums.push({ name, values, comment });
    }
  }

  return enums;
}

// ============================================================================
// Code Generators
// ============================================================================

export interface GeneratorConfig {
  excludeModels?: string[];
  softDeleteField?: string;
  defaultOrderBy?: Record<string, 'asc' | 'desc'>;
  imports?: {
    prismaService: string;
    transactionalServiceBase: string;
    prismaError: string;
    pagination: string;
  };
  enumNameMappings?: Record<string, string>;
}

const DEFAULT_GEN_CONFIG: GeneratorConfig = {
  excludeModels: [],
  softDeleteField: 'isDeleted',
  defaultOrderBy: {},
  imports: {
    prismaService: '@dofe/infra-prisma',
    transactionalServiceBase: '@dofe/infra-shared-db',
    prismaError: '@dofe/infra-common',
    pagination: '@dofe/infra-contracts',
  },
  enumNameMappings: {},
};

export function generateService(model: ParsedModel, config: GeneratorConfig = {}): string {
  const cfg = { ...DEFAULT_GEN_CONFIG, ...config };
  const kebab = model.kebab;
  const pascal = model.name;
  const idField = model.idField!;
  const softDeleteField = cfg.softDeleteField || 'isDeleted';
  const orderField = model.hasCreatedAt ? 'createdAt' : idField.name;
  const orderDir = cfg.defaultOrderBy?.[orderField] ?? 'desc';

  let out = '';

  // Imports
  out += `import { Injectable, Logger } from '@nestjs/common';\n`;
  out += `import { Prisma } from '@prisma/client';\n`;
  out += `import { PAGINATION } from '${cfg.imports!.pagination}';\n`;
  out += `import { HandlePrismaError } from '${cfg.imports!.prismaError}';\n`;
  out += `import { TransactionalServiceBase } from '${cfg.imports!.transactionalServiceBase}';\n`;
  out += `import { PrismaService } from '${cfg.imports!.prismaService}';\n\n`;

  // Service class
  out += `@Injectable()\n`;
  out += `export class ${pascal}Service extends TransactionalServiceBase {\n`;
  out += `  private readonly logger = new Logger(${pascal}Service.name);\n\n`;
  out += `  constructor(prisma: PrismaService) {\n`;
  out += `    super(prisma);\n`;
  out += `  }\n\n`;

  // Helper
  const addType = model.hasRelations
    ? 'additional?: { select?: Prisma.XxxSelect; include?: Prisma.XxxInclude }'
    : 'additional?: { select?: Prisma.XxxSelect }';
  const addTypeClean = addType.replace(/Xxx/g, pascal);

  // get
  out += `  @HandlePrismaError('query')\n`;
  out += `  async get(where: Prisma.${pascal}WhereInput, ${addTypeClean}) {\n`;
  out += `    const query: any = { where: { ...where`;
  if (model.hasIsDeleted) out += `, ${softDeleteField}: false`;
  out += ` } };\n`;
  out += `    if (additional) Object.assign(query, additional);\n`;
  out += `    return this.getReadClient().${kebab}.findFirst(query);\n`;
  out += `  }\n\n`;

  // getById
  out += `  @HandlePrismaError('query')\n`;
  out += `  async getById(id: string, ${addTypeClean}) {\n`;
  out += `    return this.getReadClient().${kebab}.findUnique({ where: { ${idField.name}: id }, ...(additional || {}) });\n`;
  out += `  }\n\n`;

  // getByXxx per unique field
  for (const uf of model.uniqueFields) {
    const typeName = uf.type === 'String' ? 'string' : uf.type === 'Int' ? 'number' : 'string';
    out += `  @HandlePrismaError('query')\n`;
    out += `  async getBy${capitalize(uf.name)}(value: ${typeName}, ${addTypeClean}) {\n`;
    out += `    return this.getReadClient().${kebab}.findUnique({ where: { ${uf.name}: value }, ...(additional || {}) });\n`;
    out += `  }\n\n`;
  }

  // list
  out += `  @HandlePrismaError('query')\n`;
  out += `  async list(\n`;
  out += `    where?: Prisma.${pascal}WhereInput,\n`;
  out += `    pagination?: { page?: number; limit?: number; sort?: string; asc?: 'asc' | 'desc' },\n`;
  out += `    ${addTypeClean},\n`;
  out += `  ) {\n`;
  out += `    const page = pagination?.page ?? PAGINATION.DEFAULT_PAGE;\n`;
  out += `    const limit = Math.min(pagination?.limit ?? PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);\n`;
  out += `    const orderBy = pagination?.sort ? { [pagination.sort]: pagination.asc ?? '${orderDir}' } : { ${orderField}: '${orderDir}' as const };\n`;
  out += `    const query: any = {\n`;
  out += `      where: { ...(where || {})`;
  if (model.hasIsDeleted) out += `, ${softDeleteField}: false`;
  out += ` },\n`;
  out += `      orderBy,\n`;
  out += `      skip: (page - 1) * limit,\n`;
  out += `      take: limit,\n`;
  out += `    };\n`;
  out += `    if (additional) Object.assign(query, additional);\n`;
  out += `    const [list, total] = await Promise.all([\n`;
  out += `      this.getReadClient().${kebab}.findMany(query),\n`;
  out += `      this.getReadClient().${kebab}.count({ where: query.where }),\n`;
  out += `    ]);\n`;
  out += `    return { list, total, page, limit };\n`;
  out += `  }\n\n`;

  // count
  out += `  @HandlePrismaError('query')\n`;
  out += `  async count(where?: Prisma.${pascal}WhereInput) {\n`;
  out += `    return this.getReadClient().${kebab}.count({\n`;
  out += `      where: { ...(where || {})`;
  if (model.hasIsDeleted) out += `, ${softDeleteField}: false`;
  out += ` },\n`;
  out += `    });\n`;
  out += `  }\n\n`;

  // create
  out += `  @HandlePrismaError('create')\n`;
  out += `  async create(data: Prisma.${pascal}CreateInput) {\n`;
  out += `    return this.getWriteClient().${kebab}.create({ data });\n`;
  out += `  }\n\n`;

  // update
  out += `  @HandlePrismaError('update')\n`;
  out += `  async update(where: Prisma.${pascal}WhereUniqueInput, data: Prisma.${pascal}UpdateInput) {\n`;
  out += `    return this.getWriteClient().${kebab}.update({ where, data });\n`;
  out += `  }\n\n`;

  // delete
  out += `  @HandlePrismaError('delete')\n`;
  out += `  async delete(where: Prisma.${pascal}WhereUniqueInput) {\n`;
  out += `    return this.getWriteClient().${kebab}.delete({ where });\n`;
  out += `  }\n\n`;

  // softDelete (conditional)
  if (model.hasIsDeleted) {
    out += `  @HandlePrismaError('update')\n`;
    out += `  async softDelete(where: Prisma.${pascal}WhereUniqueInput) {\n`;
    out += `    return this.getWriteClient().${kebab}.update({\n`;
    out += `      where,\n`;
    out += `      data: { ${softDeleteField}: true },\n`;
    out += `    });\n`;
    out += `  }\n\n`;
  }

  // createMany
  out += `  @HandlePrismaError('create')\n`;
  out += `  async createMany(data: Prisma.${pascal}CreateManyInput[]) {\n`;
  out += `    return this.getWriteClient().${kebab}.createMany({ data });\n`;
  out += `  }\n\n`;

  // updateMany
  out += `  @HandlePrismaError('update')\n`;
  out += `  async updateMany(where: Prisma.${pascal}WhereInput, data: Prisma.${pascal}UpdateManyMutationInput) {\n`;
  out += `    return this.getWriteClient().${kebab}.updateMany({ where, data });\n`;
  out += `  }\n\n`;

  // upsert
  out += `  @HandlePrismaError('create')\n`;
  out += `  async upsert(args: Prisma.${pascal}UpsertArgs) {\n`;
  out += `    return this.getWriteClient().${kebab}.upsert(args);\n`;
  out += `  }\n\n`;

  // getOrThrow
  out += `  @HandlePrismaError('query')\n`;
  out += `  async getOrThrow(where: Prisma.${pascal}WhereInput, ${addTypeClean}) {\n`;
  out += `    const record = await this.get(where, additional);\n`;
  out += `    if (!record) throw new Error('${pascal} not found');\n`;
  out += `    return record;\n`;
  out += `  }\n`;

  out += `}\n`;
  return out;
}

export function generateModule(model: ParsedModel): string {
  const pascal = model.name;
  const kebab = model.kebab;

  return [
    `import { Module } from '@nestjs/common';`,
    `import { PrismaModule } from '@dofe/infra-prisma';`,
    `import { ${pascal}Service } from './${kebab}.service';`,
    ``,
    `@Module({`,
    `  imports: [PrismaModule],`,
    `  providers: [${pascal}Service],`,
    `  exports: [${pascal}Service],`,
    `})`,
    `export class ${pascal}Module {}`,
    ``,
  ].join('\n');
}

export function generateModuleIndex(model: ParsedModel): string {
  const kebab = model.kebab;
  return `export * from './${kebab}.service';\nexport * from './${kebab}.module';\n`;
}

// ============================================================================
// Enum Generator
// ============================================================================

export function generateEnumSchemas(
  enums: ParsedEnum[],
  nameMappings: Record<string, string> = {},
): string {
  let out = `/**\n * Generated Prisma Enum Zod Schemas\n * DO NOT EDIT MANUALLY\n */\n\n`;
  out += `import { z } from 'zod';\n\n`;

  for (const e of enums) {
    const mappedName = nameMappings[e.name] || e.name;
    if (e.comment) out += `// ${e.comment}\n`;

    const displayValues = e.values.map(v => (v.mapValue ? `"${v.mapValue}"` : `"${v.name}"`));

    out += `export const ${mappedName}Schema = z.enum([${displayValues.join(', ')}]);\n`;
    out += `export type ${mappedName} = z.infer<typeof ${mappedName}Schema>;\n`;
    out += `export const ${mappedName}Values = ${mappedName}Schema.options;\n`;
    out += `export const is${mappedName} = (value: unknown): value is ${mappedName} => {\n`;
    out += `  return ${mappedName}Schema.safeParse(value).success;\n`;
    out += `};\n\n`;
  }

  return out;
}

// ============================================================================
// Barrel Index Maintenance
// ============================================================================

export function ensureExportsInIndex(
  indexPath: string,
  generatedModules: string[],
  existingContent?: string,
): string {
  const existing = existingContent ?? (fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '');
  const existingLines = existing.split('\n');

  const existingExports = new Set<string>();
  for (const line of existingLines) {
    const match = line.match(/export \* from '\.\/([\w-]+)\/index'/);
    if (match) existingExports.add(match[1]!);
  }

  const lines = [...existingLines];
  for (const mod of generatedModules) {
    if (!existingExports.has(mod)) {
      lines.push(`export * from './${mod}/index';`);
    }
  }

  // Remove trailing empty lines, add exactly one
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// Helpers
// ============================================================================

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
