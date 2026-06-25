import { describe, it, expect } from 'vitest';
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
  type ParsedModel,
} from '../index';

const FIXTURE = path.resolve(__dirname, 'fixtures', 'test-schema.prisma');
const schemaContent = fs.readFileSync(FIXTURE, 'utf8');

describe('parsePrismaSchema', () => {
  const models = parsePrismaSchema(schemaContent);

  it('parses all models including relation tables', () => {
    const names = models.map((m) => m.name);
    expect(names).toContain('User');
    expect(names).toContain('Post');
    expect(names).toContain('PostTag');
    expect(names).toContain('Tag');
    expect(names).toContain('AuditLog');
    expect(models.length).toBe(5);
  });

  it('correctly detects @id field', () => {
    const user = models.find((m) => m.name === 'User')!;
    expect(user.idField?.name).toBe('id');
    expect(user.idField?.type).toBe('String');
  });

  it('correctly detects @unique fields', () => {
    const user = models.find((m) => m.name === 'User')!;
    const emailUnique = user.uniqueFields.find((f) => f.name === 'email');
    expect(emailUnique).toBeDefined();
    expect(emailUnique!.type).toBe('String');
  });

  it('correctly detects @@unique composite fields', () => {
    const post = models.find((m) => m.name === 'Post')!;
    expect(post.compositeUniques).toHaveLength(1);
    expect(post.compositeUniques[0]).toEqual(['title', 'authorId']);
  });

  it('correctly detects isDeleted and createdAt flags', () => {
    const user = models.find((m) => m.name === 'User')!;
    expect(user.hasIsDeleted).toBe(true);
    expect(user.hasCreatedAt).toBe(true);

    const tag = models.find((m) => m.name === 'Tag')!;
    expect(tag.hasIsDeleted).toBe(false);
    expect(tag.hasCreatedAt).toBe(false);
  });

  it('correctly detects @relation fields', () => {
    const post = models.find((m) => m.name === 'Post')!;
    expect(post.hasRelations).toBe(true);

    const postTag = models.find((m) => m.name === 'PostTag')!;
    expect(postTag.hasRelations).toBe(true);
  });

  it('handles optional fields (String?)', () => {
    const user = models.find((m) => m.name === 'User')!;
    const nameField = user.fields.find((f) => f.name === 'name')!;
    expect(nameField.isRequired).toBe(false);
  });

  it('handles dotted annotations (@db.Uuid, @db.VarChar)', () => {
    const user = models.find((m) => m.name === 'User')!;
    const idField = user.fields.find((f) => f.name === 'id')!;
    expect(idField).toBeDefined(); // @db.Uuid annotation parsed without error

    const post = models.find((m) => m.name === 'Post')!;
    const titleField = post.fields.find((f) => f.name === 'title')!;
    expect(titleField).toBeDefined(); // @db.VarChar(255)
  });

  it('handles nested parentheses in @default(dbgenerated("..."))', () => {
    const user = models.find((m) => m.name === 'User')!;
    const idField = user.fields.find((f) => f.name === 'id')!;
    expect(idField.isId).toBe(true); // @id with nested parens default
  });

  it('kebab-cases model names correctly', () => {
    const postTag = models.find((m) => m.name === 'PostTag')!;
    expect(postTag.kebab).toBe('post-tag');
  });

  it('AuditLog has no @id and no @unique — should be skipped by CLI', () => {
    const auditLog = models.find((m) => m.name === 'AuditLog')!;
    expect(auditLog.idField).toBeUndefined();
    expect(auditLog.uniqueFields).toHaveLength(0);
  });
});

describe('parsePrismaEnums', () => {
  const enums = parsePrismaEnums(schemaContent);

  it('parses all enums', () => {
    expect(enums).toHaveLength(2);
    expect(enums[0]!.name).toBe('UserRole');
    expect(enums[1]!.name).toBe('ContentStatus');
  });

  it('handles @map values', () => {
    const contentStatus = enums[1]!;
    expect(contentStatus.values[0]!.name).toBe('DRAFT');
    expect(contentStatus.values[0]!.mapValue).toBe('draft');
    expect(contentStatus.values[1]!.mapValue).toBe('published');
    expect(contentStatus.values[2]!.mapValue).toBe('archived');
  });
});

describe('generateService', () => {
  const models = parsePrismaSchema(schemaContent);
  const user = models.find((m) => m.name === 'User')!;
  const tag = models.find((m) => m.name === 'Tag')!;

  it('generates a valid service for a model with @id', () => {
    const code = generateService(user);
    expect(code).toContain('export class UserService extends TransactionalServiceBase');
    expect(code).toContain('async get(');
    expect(code).toContain('async getById(');
    expect(code).toContain('async getByEmail(');
    expect(code).toContain('async list(');
    expect(code).toContain('async count(');
    expect(code).toContain('async create(');
    expect(code).toContain('async update(');
    expect(code).toContain('async delete(');
    expect(code).toContain('async softDelete(');
    expect(code).toContain('async createMany(');
    expect(code).toContain('async updateMany(');
    expect(code).toContain('async upsert(');
    expect(code).toContain('async getOrThrow(');
    expect(code).toContain('isDeleted: false');
  });

  it('generates a service without getById when no @id', () => {
    // AuditLog has no @id — should throw because generateService requires idField or uniqueFields
    const auditLog = models.find((m) => m.name === 'AuditLog')!;
    expect(() => generateService(auditLog)).toThrow('no @id or @unique field');
  });

  it('generates service without softDelete when hasIsDeleted=false', () => {
    const code = generateService(tag);
    expect(code).not.toContain('softDelete');
    expect(code).not.toContain('isDeleted');
  });

  it('service snapshot is stable', () => {
    const code = generateService(user);
    expect(code).toMatchSnapshot();
  });
});

describe('generateModule', () => {
  const models = parsePrismaSchema(schemaContent);
  const user = models.find((m) => m.name === 'User')!;

  it('generates a valid NestJS module', () => {
    const code = generateModule(user);
    expect(code).toContain('import { Module } from \'@nestjs/common\'');
    expect(code).toContain('import { PrismaModule } from \'@dofe/infra-prisma\'');
    expect(code).toContain('export class UserModule {}');
  });

  it('module snapshot is stable', () => {
    expect(generateModule(user)).toMatchSnapshot();
  });
});

describe('generateModuleIndex', () => {
  const models = parsePrismaSchema(schemaContent);
  const user = models.find((m) => m.name === 'User')!;

  it('generates correct barrel exports', () => {
    const code = generateModuleIndex(user);
    expect(code).toContain('export * from \'./user.service\'');
    expect(code).toContain('export * from \'./user.module\'');
  });
});

describe('generateEnumSchemas', () => {
  const enums = parsePrismaEnums(schemaContent);

  it('generates Zod schemas for all enums', () => {
    const code = generateEnumSchemas(enums);
    expect(code).toContain('export const UserRoleSchema = z.enum([');
    expect(code).toContain('export const ContentStatusSchema = z.enum([');
    expect(code).toContain('export type UserRole = z.infer<');
    expect(code).toContain('export const isUserRole = ');
  });

  it('supports name mappings', () => {
    const code = generateEnumSchemas(enums, { UserRole: 'CustomRole' });
    expect(code).toContain('CustomRoleSchema');
    expect(code).not.toContain('UserRoleSchema');
  });

  it('enum snapshot is stable', () => {
    expect(generateEnumSchemas(enums)).toMatchSnapshot();
  });
});

describe('ensureExportsInIndex', () => {
  it('adds new entries to existing index', () => {
    const existing = 'export * from \'./user/index\';\nexport * from \'./tag/index\';\n';
    const result = ensureExportsInIndex('/fake/index.ts', ['post', 'post-tag'], existing);
    expect(result).toContain('export * from \'./user/index\';');
    expect(result).toContain('export * from \'./tag/index\';');
    expect(result).toContain('export * from \'./post/index\';');
    expect(result).toContain('export * from \'./post-tag/index\';');
  });

  it('does not duplicate existing entries', () => {
    const existing = 'export * from \'./user/index\';\n';
    const result = ensureExportsInIndex('/fake/index.ts', ['user'], existing);
    const matches = result.match(/user\/index/g);
    expect(matches).toHaveLength(1);
  });
});
