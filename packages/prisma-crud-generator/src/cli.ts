#!/usr/bin/env node
/**
 * dofe-prisma-crud CLI entry point.
 *
 * Usage:
 *   dofe-prisma-crud generate        # Generate CRUD modules from config
 *   dofe-prisma-crud generate enums  # Generate Zod enum schemas
 *   dofe-prisma-crud help
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  parsePrismaSchema,
  parsePrismaEnums,
  generateService,
  generateModule,
  generateModuleIndex,
  generateEnumSchemas,
  ensureExportsInIndex,
  type GeneratorConfig,
} from './index';
import type { DofePrismaCrudGeneratorConfig } from './config';

const DEFAULT_IMPORTS = {
  prismaService: '@dofe/infra-prisma',
  transactionalServiceBase: '@dofe/infra-shared-db',
  prismaError: '@dofe/infra-common',
  pagination: '@dofe/infra-contracts',
};

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help') {
    printHelp();
    return;
  }

  switch (command) {
    case 'generate':
      runGenerate(args.slice(1));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function runGenerate(generateArgs: string[]): void {
  const subCommand = generateArgs[0];

  if (subCommand === 'enums' || generateArgs.includes('--enums')) {
    runEnumGenerate(generateArgs);
    return;
  }

  runCrudGenerate(generateArgs);
}

function loadConfig(configPath?: string): DofePrismaCrudGeneratorConfig {
  if (!configPath) return { schemaPath: '', modulesDir: '', indexPath: '' };

  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    console.error(`Config file not found: ${resolved}`);
    process.exit(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(resolved);
  const config = mod.default || mod;
  return config;
}

function getArg(args: string[], ...names: string[]): string | undefined {
  for (const name of names) {
    const idx = args.indexOf(name);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1]!;
  }
  return undefined;
}

function runCrudGenerate(args: string[]): void {
  const configPath = getArg(args, '--config', '-c');
  const schemaPath = getArg(args, '--schema', '-s');
  const outDir = getArg(args, '--out', '-o');
  const indexPath = getArg(args, '--index', '-i');
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  const config = configPath ? loadConfig(configPath) : null;
  const effectiveSchemaPath = schemaPath || config?.schemaPath;
  const effectiveModulesDir = outDir || config?.modulesDir;
  const effectiveIndexPath = indexPath || config?.indexPath;

  if (!effectiveSchemaPath) {
    console.error('Schema path required. Use --schema <path> or --config <path>');
    process.exit(1);
  }
  if (!effectiveModulesDir) {
    console.error('Output directory required. Use --out <dir> or --config <path>');
    process.exit(1);
  }

  const resolvedSchema = path.resolve(effectiveSchemaPath);
  if (!fs.existsSync(resolvedSchema)) {
    console.error(`Schema file not found: ${resolvedSchema}`);
    process.exit(1);
  }

  const excludeModels = new Set(config?.excludeModels ?? []);
  const genConfig: GeneratorConfig = {
    excludeModels: config?.excludeModels,
    softDeleteField: config?.softDeleteField ?? 'isDeleted',
    defaultOrderBy: config?.defaultOrderBy,
    imports: config?.imports ?? DEFAULT_IMPORTS,
  };

  console.log('dofe-prisma-crud generate CRUD modules');
  console.log(`  Schema: ${resolvedSchema}`);
  console.log(`  Output: ${path.resolve(effectiveModulesDir)}`);
  if (effectiveIndexPath) console.log(`  Index:  ${path.resolve(effectiveIndexPath)}`);
  if (dryRun) console.log('  Mode:   DRY RUN');
  if (force) console.log('  Mode:   FORCE (overwrite existing)');
  console.log('');

  const schemaContent = fs.readFileSync(resolvedSchema, 'utf8');
  const models = parsePrismaSchema(schemaContent);
  console.log(`Found ${models.length} models in schema\n`);

  const modulesDir = path.resolve(effectiveModulesDir);
  if (!dryRun) {
    if (!fs.existsSync(modulesDir)) fs.mkdirSync(modulesDir, { recursive: true });
  }

  const generatedKebabs: string[] = [];
  let skippedCount = 0;

  for (const model of models) {
    if (excludeModels.has(model.name)) {
      console.log(`  SKIP ${model.name} (excluded by config)`);
      continue;
    }
    if (!model.idField && model.uniqueFields.length === 0) {
      console.log(`  SKIP ${model.name} (no @id and no single @unique)`);
      skippedCount++;
      continue;
    }

    const kebab = model.kebab;
    const dir = path.join(modulesDir, kebab);
    const servicePath = path.join(dir, `${kebab}.service.ts`);
    const modulePath = path.join(dir, `${kebab}.module.ts`);
    const modIndexPath = path.join(dir, 'index.ts');

    generatedKebabs.push(kebab);

    // Skip if service exists (preserve manual changes)
    if (fs.existsSync(servicePath) && !force) {
      console.log(`  SKIP ${kebab} (service exists, use --force to overwrite)`);
      continue;
    }

    if (dryRun) {
      console.log(`  GEN  ${kebab} (dry-run)`);
      continue;
    }

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(servicePath, generateService(model, genConfig), 'utf8');
    fs.writeFileSync(modulePath, generateModule(model), 'utf8');
    fs.writeFileSync(modIndexPath, generateModuleIndex(model), 'utf8');
    console.log(`  WROTE ${kebab}`);
  }

  // Maintain barrel index
  if (generatedKebabs.length > 0 && effectiveIndexPath) {
    const resolvedIndex = path.resolve(effectiveIndexPath);
    const indexDir = path.dirname(resolvedIndex);
    if (!dryRun && !fs.existsSync(indexDir)) fs.mkdirSync(indexDir, { recursive: true });

    const newContent = ensureExportsInIndex(resolvedIndex, generatedKebabs);
    if (!dryRun) {
      fs.writeFileSync(resolvedIndex, newContent, 'utf8');
    }
    console.log(`\n  INDEX ${resolvedIndex} (${generatedKebabs.length} modules)`);
  }

  if (dryRun) console.log('\n[Dry run complete - no files written]');
  else console.log(`\nDone. Generated ${generatedKebabs.length} modules (${skippedCount} skipped).`);
}

function runEnumGenerate(args: string[]): void {
  const configPath = getArg(args, '--config', '-c');
  const schemaPath = getArg(args, '--schema', '-s');
  const outFile = getArg(args, '--out', '-o');
  const dryRun = args.includes('--dry-run');

  const config = configPath ? loadConfig(configPath) : null;
  const effectiveSchemaPath = schemaPath || config?.schemaPath;
  const effectiveOutFile = outFile || (config as any)?.enumOutputPath;

  if (!effectiveSchemaPath) {
    console.error('Schema path required. Use --schema <path> or --config <path>');
    process.exit(1);
  }
  if (!effectiveOutFile) {
    console.error('Output file required. Use --out <path> or set enumOutputPath in config');
    process.exit(1);
  }

  const resolvedSchema = path.resolve(effectiveSchemaPath);
  if (!fs.existsSync(resolvedSchema)) {
    console.error(`Schema file not found: ${resolvedSchema}`);
    process.exit(1);
  }

  const nameMappings = (config as any)?.enumNameMappings ?? {};

  console.log('dofe-prisma-crud generate enums');
  console.log(`  Schema: ${resolvedSchema}`);
  console.log(`  Output: ${path.resolve(effectiveOutFile)}`);
  if (dryRun) console.log('  Mode:   DRY RUN');
  console.log('');

  const schemaContent = fs.readFileSync(resolvedSchema, 'utf8');
  const enums = parsePrismaEnums(schemaContent);
  console.log(`Found ${enums.length} enums in schema`);

  for (const e of enums) {
    const mappedName = nameMappings[e.name] || e.name;
    console.log(`  - ${e.name}${e.name !== mappedName ? ` → ${mappedName}` : ''} (${e.values.length} values)`);
  }

  const output = generateEnumSchemas(enums, nameMappings);

  if (dryRun) {
    console.log('\n--- Preview (first 30 lines) ---');
    console.log(output.split('\n').slice(0, 30).join('\n'));
    console.log('...');
    console.log('\n[Dry run complete - no files written]');
  } else {
    const resolvedOut = path.resolve(effectiveOutFile);
    const outDir = path.dirname(resolvedOut);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(resolvedOut, output, 'utf8');
    console.log(`\nWrote ${enums.length} enum schemas to ${resolvedOut}`);
  }
}

function printHelp(): void {
  console.log(`
dofe-prisma-crud - Generate Prisma-based CRUD modules and enum schemas

Usage:
  dofe-prisma-crud <command> [options]

Commands:
  generate          Generate CRUD modules from Prisma schema
  generate enums    Generate Zod enum schemas from Prisma schema
  help              Show this help

CRUD Generate Options:
  --config, -c <path>   Path to config file (dofe-prisma-crud.config.ts)
  --schema, -s <path>   Path to Prisma schema file
  --out, -o <dir>       Output directory for generated modules
  --index, -i <path>    Barrel index file path
  --force               Overwrite existing service files
  --dry-run             Preview without writing files

Enum Generate Options:
  --config, -c <path>   Path to config file
  --schema, -s <path>   Path to Prisma schema file
  --out, -o <path>      Output file path for generated enum schemas
  --dry-run             Preview without writing files

Config file format (dofe-prisma-crud.config.ts):
  import type { DofePrismaCrudGeneratorConfig } from '@dofe/infra-prisma-crud-generator';
  const config: DofePrismaCrudGeneratorConfig = {
    schemaPath: 'apps/api/prisma/schema.prisma',
    modulesDir: 'apps/api/generated/db/modules',
    indexPath: 'apps/api/generated/db/index.ts',
    excludeModels: ['UserInfo'],
    softDeleteField: 'isDeleted',
    enumOutputPath: 'packages/contracts/src/schemas/prisma-enums.generated.ts',
    enumNameMappings: { MdFileType: 'BotFocusFileType' },
  };
  export default config;

Examples:
  dofe-prisma-crud generate --schema apps/api/prisma/schema.prisma --out generated/db/modules --index generated/db/index.ts --dry-run
  dofe-prisma-crud generate enums --schema apps/api/prisma/schema.prisma --out packages/contracts/src/schemas/prisma-enums.generated.ts
`);
}

main();
