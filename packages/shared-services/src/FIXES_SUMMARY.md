# shared-services 错误修复报告

## 修复的文件

### 1. ✅ email/email.service.ts (第 239 行)
**问题**: Type 'unknown' cannot be used as an index type
**修复**: 添加类型断言和空值检查
```typescript
// 修复前
const subVery = {};
for (const key in sub) {
  subVery['%' + sub[key] + '%'] = [subValues[sub[key]]];
}

// 修复后
const subVery: Record<string, string[]> = {};
if (sub && subValues) {
  for (const key in sub) {
    const subKey = sub[key];
    const subValue = (subValues as Record<string, string>)[subKey];
    if (subValue) {
      subVery['%' + subKey + '%'] = [subValue];
    }
  }
}
```

### 2. ✅ email/dto/email.dto.ts
**问题**: Zod 4.x `z.record()` 需要两个参数
**修复**:
```typescript
// 修复前
sub: z.record(z.string()).nullable().optional(),

// 修复后
sub: z.record(z.string(), z.string()).nullable().optional(),
```

### 3. ✅ clients/internal/email/dto/email.dto.ts
**问题**: 多处 `z.record()` 调用需要修复
**修复**:
```typescript
// 第 24 行
sub: z.record(z.string(), z.string()).nullable().optional(),

// 第 49 行
sub: z.record(z.string(), z.array(z.string())),

// 第 52 行
metadata: z.record(z.string(), z.any()).optional(),
```

### 4. ✅ clients/internal/volcengine-tts/dto/tts.dto.ts
**问题**: Class property 可选性不匹配接口
**修复**:
```typescript
// 修复前
export class TtsRequestDto implements TtsRequest {
  format?: string = 'mp3';  // 可选，但接口要求必需
}

// 修复后
export class TtsRequestDto implements TtsRequest {
  format: string = 'mp3';  // 改为必需
}
```

### 5. ✅ common/config/validation/env.validation.ts
**问题**: Zod 4.x 使用 `issues` 而非 `errors`
**修复**:
```typescript
// 修复前
const errorMessages = result.error.errors
  .map((err) => `  - ${err.path.join('.')}: ${err.message}`)

// 修复后
const issues = (result.error as any).issues || [];
const errorMessages = issues
  .map((err: any) => `  - ${err.path.join('.')}: ${err.message}`)
```

### 6. ✅ common/config/validation/keys.validation.ts
**问题**:
- 第 99 行: `z.record(z.any())` 需要两个参数
- 第 463 行: `result.error.errors` 需要改为 `issues`

**修复**:
```typescript
// 第 99 行
templates: z.array(z.record(z.string(), z.any())).optional(),

// 第 463 行
const issues = (result.error as any).issues || [];
const errorMessages = issues
  .map((err: any) => { ... })
```

### 7. ✅ common/config/validation/yaml.validation.ts
**问题**:
- 第 188 行: `z.record(z.string())`
- 第 203 行: `z.record(z.boolean())`
- 第 519 行: `result.error.errors`

**修复**:
```typescript
// 第 188 行
customHeaders: z.record(z.string(), z.string()).optional(),

// 第 203 行
defaultFlags: z.record(z.string(), z.boolean()).optional(),

// 第 519 行
const issues = (result.error as any).issues || [];
const errorMessages = issues
  .map((err: any) => `  - ${err.path.join('.')}: ${err.message}`)
```

## 未修复的问题

### ❌ auth.service.ts (第 106 行)
**问题**: Type 'Partial<UserInfo>' is not assignable to type '{ id: string; ... }'
**原因**: `LoginSuccess` 类型定义在 `@repo/contracts` 包中，可能期望 `user` 对象包含必需的 `id` 字段，但 `Partial<UserInfo>` 使所有字段可选。

**建议修复**: 需要修改 `@repo/contracts` 包中的类型定义，或在返回前确保 user 对象包含 id。

```typescript
// 可能的修复方案
return {
  refresh: tokens.refresh,
  expire: tokens.expire,
  access: tokens.access,
  accessExpire: tokens.accessExpire,
  isAnonymity: tokens.isAnonymity,
  user: user as UserInfo,  // 类型断言
};
```

## 总结

已修复 7 个文件中的 TypeScript 编译错误，主要问题是：

1. **Zod 4.x 迁移问题**: `z.record()` API 变更，现在需要两个参数
2. **Zod 4.x 错误处理**: `ZodError.errors` 改为 `ZodError.issues`
3. **类型不匹配**: 类属性可选性与接口不匹配

还有一个问题需要在 `@repo/contracts` 包中修复。
