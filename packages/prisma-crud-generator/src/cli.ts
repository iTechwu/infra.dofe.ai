#!/usr/bin/env node
/**
 * dofe-prisma-crud CLI entry point.
 *
 * Usage:
 *   dofe-prisma-crud generate --config <path>
 *   dofe-prisma-crud generate --schema <path> --out <dir>
 */

import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  if (!command || command === 'help' || command === '--help') {
    printHelp();
    return;
  }

  switch (command) {
    case 'generate':
      await runGenerate(args.slice(1));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

async function runGenerate(generateArgs: string[]) {
  const configPath = getArg(generateArgs, '--config', '-c');
  const schemaPath = getArg(generateArgs, '--schema', '-s');
  const outDir = getArg(generateArgs, '--out', '-o');
  const dryRun = generateArgs.includes('--dry-run');

  console.log('dofe-prisma-crud generate');
  console.log('=========================');

  if (configPath) {
    console.log(`Config: ${configPath}`);
    // Load and use config file
    const resolvedPath = path.resolve(configPath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`Config file not found: ${resolvedPath}`);
      process.exit(1);
    }
    // TODO: Dynamic import of config and full generation
    console.log('(Full config-driven generation coming in next version)');
  }

  if (schemaPath) {
    const resolved = path.resolve(schemaPath);
    console.log(`Schema: ${resolved}`);
    if (!fs.existsSync(resolved)) {
      console.error(`Schema file not found: ${resolved}`);
      process.exit(1);
    }
    const content = fs.readFileSync(resolved, 'utf-8');
    const { parsePrismaSchema } = await import('./index');
    const models = parsePrismaSchema(content);
    console.log(`\nFound ${models.length} models:`);
    for (const model of models) {
      console.log(`  - ${model.name} (${model.fields.length} fields)`);
    }
  }

  if (outDir) {
    console.log(`Output: ${path.resolve(outDir)}`);
  }

  if (dryRun) {
    console.log('\n[Dry run - no files written]');
  }

  console.log('\nDone. Use --config <path> for full generation.');
}

function getArg(args: string[], ...names: string[]): string | undefined {
  for (const name of names) {
    const idx = args.indexOf(name);
    if (idx !== -1 && idx + 1 < args.length) {
      return args[idx + 1];
    }
  }
  return undefined;
}

function printHelp() {
  console.log(`
dofe-prisma-crud - Generate Prisma-based CRUD modules

Usage:
  dofe-prisma-crud <command> [options]

Commands:
  generate    Generate CRUD modules from Prisma schema
  help        Show this help

Generate Options:
  --config, -c <path>   Path to config file (dofe-prisma-crud.config.ts)
  --schema, -s <path>   Path to Prisma schema file
  --out, -o <dir>       Output directory for generated modules
  --dry-run             Preview without writing files

Examples:
  dofe-prisma-crud generate --config dofe-prisma-crud.config.ts
  dofe-prisma-crud generate --schema apps/api/prisma/schema.prisma --dry-run
`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
