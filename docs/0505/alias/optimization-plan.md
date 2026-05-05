# infra.dofe.ai 别名依赖优化方案

## 背景

sso.dofe.ai (消费端) 的 `apps/api/tsconfig.json` 中维护了大量 `@/` 和 `@dofe/infra-*` 的 path aliases，指向 `node_modules/@dofe/infra-*/dist/*`。这些别名是为了绕过 `@dofe/infra-*` 包本身的模块解析问题。

目标：**移除消费端的这些别名**，通过修复 infra.dofe.ai 的源码包，使其导出机制自洽。

## 问题诊断

sso.dofe.ai `pnpm dev:api` 编译失败，共 20 个 webpack 错误，分为以下类别：

### 问题 1：`exports` 字段 `"./*"` 模式不支持目录索引解析

**受影响的导入示例：**

| 消费端导入 | 解析目标（exports） | 实际文件 | 结果 |
|---|---|---|---|
| `@dofe/infra-common/ts-rest` | `./dist/ts-rest.js` | `./dist/ts-rest/index.js` | 失败 |
| `@dofe/infra-clients/crypt` | `./dist/internal/crypt.js` | `./dist/internal/crypt/index.js` | 失败 |
| `@dofe/infra-clients/file-storage` | `./dist/internal/file-storage.js` | `./dist/internal/file-storage/index.js` | 失败 |
| `@dofe/infra-clients/sms` | `./dist/internal/sms.js` | `./dist/internal/sms/index.js` | 失败 |

**根因**：当前所有包的 `exports` 字段统一使用：
```json
"./*": {
  "types": "./dist/*.d.ts",
  "default": "./dist/*.js"
}
```

Node.js `exports` 字段的解析是**路径精确匹配**：
- 对于**单文件**子路径（如 `encryption.service`），`./dist/encryption.service.js` 存在 → 成功
- 对于**目录**子路径（如 `ts-rest`），`./dist/ts-rest.js` 不存在 → **不回落**到 `./dist/ts-rest/index.js` → 失败

**影响范围**：几乎所有 infra 包都存在此问题。`common` 包的 `dist/` 下有 11 个子目录（`ts-rest/`、`config/`、`filter/`、`decorators/` 等），`clients` 包的 `dist/internal/` 下有 19 个子目录（`crypt/`、`sms/`、`file-storage/` 等）。

### 问题 2：传递依赖无法解析

```
ERROR in ./node_modules/@dofe/infra-shared-services/dist/transcode/modules/aliyun-imm/aliyun-imm.client.js
Module not found: Error: Can't resolve '@alicloud/openapi-core'
Module not found: Error: Can't resolve '@darabonba/typescript'
```

**根因**：`@dofe/infra-shared-services` 的 `package.json` 将这两个包声明为 `dependencies`（而非 `peerDependencies`）：
```json
"dependencies": {
  "@alicloud/openapi-core": "^1.0.7",
  "@darabonba/typescript": "^1.0.4"
}
```

而 sso.dofe.ai 的 webpack 配置将 `@dofe/infra-*` 包纳入打包（bundleAllowlist），webpack 需要解析这些包的**所有**传递依赖。pnpm 将这些依赖嵌套安装在 shared-services 的 `node_modules` 内部，消费端无法直接访问。

对比：`@dofe/infra-clients` 将阿里云 SDK 声明为 `peerDependencies`，消费端自行安装，无此问题。

### ~~问题 3（已排除）：`@/` 别名引用泄露~~

~~猜测 `@dofe/infra-*` 编译后 JS 中残留 `require("@/...")` 引用。~~

**验证结果**：所有 `packages/*/dist/` 中 `@/` 仅存在于**代码注释**中，无运行时代码引用。TypeScript 编译器已将 `@/` 别名解析为相对路径。此项**不是问题**。

### 其他相关发现

**`@dofe/infra-utils` 无 wildcard exports**：`utils/package.json` 未使用 `"./*"` 模式，而是逐个显式列出 12 个导出。但 `dist/` 下有 30+ 个文件，大量文件（如 `bcrypt.util.js`、`crypto.util.js`、`http-client.js` 等）无法被外部 import。

---

## 优化方案

### 方案 A：修改 `exports` 目标路径，移除扩展名（推荐）

将 `default` 和 `types` 条件的目标路径中的 `.js` / `.d.ts` 扩展名移除，利用 Node.js CJS 模块加载器的自动扩展名/目录索引解析。

**修改前：**
```json
"./*": {
  "types": "./dist/*.d.ts",
  "default": "./dist/*.js"
}
```

**修改后：**
```json
"./*": {
  "types": "./dist/*",
  "default": "./dist/*"
}
```

**原理：**
- 文件导出（`encryption.service`）→ 映射到 `./dist/encryption.service` → Node.js 尝试 `./dist/encryption.service.js` → 成功
- 目录导出（`ts-rest`）→ 映射到 `./dist/ts-rest` → Node.js 尝试 `./dist/ts-rest.js`（不存在）→ 尝试 `./dist/ts-rest/index.js` → 成功
- TypeScript types 同理：`./dist/ts-rest` → 尝试 `./dist/ts-rest.d.ts`（不存在）→ 尝试 `./dist/ts-rest/index.d.ts` → 成功

**优点：**
- 改动最小，只需修改 `package.json` 中的 `exports` 字段
- 不改变源码/目录结构
- 向后兼容（已有的文件导出不受影响）
- Node.js 12+ CJS 均支持

**缺点：**
- 依赖 Node.js 的模块解析算法，非显式匹配
- ESM 消费者（`"type": "module"`）不受影响，因为 infra 包均为 CJS

**影响包列表（10 个包）：**

| 包名 | 当前 default 目标 | 修改后 default 目标 |
|---|---|---|
| `common` | `./dist/*.js` | `./dist/*` |
| `clients` | `./dist/internal/*.js` | `./dist/internal/*` |
| `prisma` | `./dist/*.js` | `./dist/*` |
| `shared-services` | `./dist/*.js` | `./dist/*` |
| `contracts` | `./dist/*.js` | `./dist/*` |
| `docker` | `./dist/*.js` | `./dist/*` |
| `i18n` | `./dist/*.js` | `./dist/*` |
| `jwt` | `./dist/*.js` | `./dist/*` |
| `module-registry` | `./dist/*.js` | `./dist/*` |
| `rabbitmq` | `./dist/*.js` | `./dist/*` |
| `redis` | `./dist/*.js` | `./dist/*` |
| `shared-db` | `./dist/*.js` | `./dist/*` |
| `vector` | `./dist/*.js` | `./dist/*` |

**额外处理：**
- `utils` 包：为 `"./*"` 添加 wildcard 模式（当前只有显式列表）
- `clients` 包：除 `internal/` 外还有 `plugin/` 子目录，需确认是否也需导出

### 方案 B：使用条件数组（Node.js 18.6+）

利用 Node.js 18.6+ 支持的条件数组，为文件和目录分别提供匹配模式：

```json
"./*": {
  "types": ["./dist/*.d.ts", "./dist/*/index.d.ts"],
  "default": ["./dist/*.js", "./dist/*/index.js"]
}
```

**优点**：显式匹配，语义清晰
**缺点**：需要 Node.js ≥ 18.6；实际上当前所有包已要求 Node.js ≥ 18（通过 `@nestjs/common ^11` 间接要求）

### 方案 C：扁平化目录模块

将目录模块（如 `ts-rest/`）改为单文件 barrel 模块（如 `ts-rest.ts`）。

**优点**：无需修改 exports 机制
**缺点**：改动量大，影响源码组织结构，不推荐

### 推荐方案：方案 A

改动最小，风险最低，不改源码结构，只需修改 `package.json` 的 `exports` 字段。

---

### 传递依赖问题的修复

将 `@alicloud/openapi-core` 和 `@darabonba/typescript` 从 `dependencies` 移至 `peerDependencies`。

**修改前（`packages/shared-services/package.json`）：**
```json
"dependencies": {
  "@alicloud/openapi-core": "^1.0.7",
  "@darabonba/typescript": "^1.0.4",
  "@dofe/infra-clients": "workspace:*",
  "@dofe/infra-common": "workspace:*",
  ...
}
```

**修改后：**
```json
"dependencies": {
  "@dofe/infra-clients": "workspace:*",
  "@dofe/infra-common": "workspace:*",
  ...
},
"peerDependencies": {
  "@alicloud/openapi-core": "^1.0.7",
  "@darabonba/typescript": "^1.0.4",
  ...
}
```

这与 `@dofe/infra-clients` 的做法一致（其 `@alicloud/dysmsapi20170525`、`@alicloud/openapi-client` 等均声明为 `peerDependencies`）。

---

## 实施步骤

### 第一步：修改 infra.dofe.ai 各包的 `exports` 字段

对于以下每个包，将 `exports["./*"].default` 中的扩展名 `.js` 移除，`exports["./*"].types` 中的扩展名 `.d.ts` 移除：

1. `packages/common/package.json`
2. `packages/clients/package.json`
3. `packages/prisma/package.json`
4. `packages/shared-services/package.json`
5. `packages/shared-db/package.json`
6. `packages/contracts/package.json`
7. `packages/docker/package.json`
8. `packages/i18n/package.json`
9. `packages/jwt/package.json`
10. `packages/module-registry/package.json`
11. `packages/rabbitmq/package.json`
12. `packages/redis/package.json`
13. `packages/vector/package.json`
14. `packages/utils/package.json`（添加 `"./*"` 模式）

**示例（common 包）：**
```diff
  "./*": {
-   "types": "./dist/*.d.ts",
+   "types": "./dist/*",
-   "default": "./dist/*.js"
+   "default": "./dist/*"
  }
```

**示例（clients 包）：**
```diff
  "./*": {
-   "types": "./dist/internal/*.d.ts",
+   "types": "./dist/internal/*",
-   "default": "./dist/internal/*.js"
+   "default": "./dist/internal/*"
  }
```

### 第二步：修改 `shared-services` 依赖声明

`packages/shared-services/package.json`：
- 将 `@alicloud/openapi-core` 和 `@darabonba/typescript` 从 `dependencies` 移至 `peerDependencies`

### 第三步：构建验证

```bash
cd infra.dofe.ai
pnpm build
```

确认所有包构建成功。

### 第四步：发布 & 消费端更新

1. 在 infra.dofe.ai 发布新版本
2. 在 sso.dofe.ai 更新 `@dofe/infra-*` 版本
3. 运行 `pnpm install`

---

## 消费端（sso.dofe.ai）需要的变更

### 1. 移除 tsconfig.json 中的别名

以下别名可以被移除（infra 包的 exports 修复后不再需要）：

```diff
- // === @dofe/infra-* 子路径（moduleResolution: Node 不识别 exports 字段） ===
- "@dofe/infra-utils/*": ["node_modules/@dofe/infra-utils/dist/*"],
- "@dofe/infra-common/*": ["node_modules/@dofe/infra-common/dist/*"],
- "@dofe/infra-clients/*": ["node_modules/@dofe/infra-clients/dist/internal/*"],

- // === @/ 别名（供 @dofe/infra-* 编译后 JS 内部 require('@/...') 解析用） ===
- "@/common/*": ["node_modules/@dofe/infra-common/dist/*"],
- "@/config/*": ["node_modules/@dofe/infra-common/dist/config/*"],
- "@/filter/*": ["node_modules/@dofe/infra-common/dist/filter/*"],
- "@/decorators/*": ["node_modules/@dofe/infra-common/dist/decorators/*"],
- "@/interceptor/*": ["node_modules/@dofe/infra-common/dist/interceptor/*"],
- "@/middleware/*": ["node_modules/@dofe/infra-common/dist/middleware/*"],
- "@/utils/*": ["node_modules/@dofe/infra-utils/dist/*"],
- "@/prisma/*": ["node_modules/@dofe/infra-prisma/dist/prisma/*"],
- "@/prisma-read/*": ["node_modules/@dofe/infra-prisma/dist/prisma-read/*"],
- "@/prisma-write/*": ["node_modules/@dofe/infra-prisma/dist/prisma-write/*"]
```

### 2. 更新源码中的 `@/` 导入

**注意**：`apps/api/src/` 和 `generated/db/` 中的 TypeScript 源码直接使用了 `@/common/*`、`@/utils/*` 等别名导入。这些需要改为直接使用包名：

| 当前导入 | 改为 |
|---|---|
| `@/common/utils/prisma-error.util` | `@dofe/infra-common/utils/prisma-error.util` |
| `@/utils/*` | `@dofe/infra-utils/*` |
| ... | ... |

**重要**：`generated/db/` 目录下的文件是自动生成的，需要修改代码生成器（`scripts/generate-db-crud.js`）以使用包名而非 `@/` 别名。

### 3. 保留的 `@app/*` 别名

以下别名仍需要保留（它们指向 sso.dofe.ai 项目内部的库）：

```json
"@app/prisma": ["node_modules/@dofe/infra-prisma/dist/prisma"],
"@app/redis": ["node_modules/@dofe/infra-redis/dist"],
"@app/shared-db": ["node_modules/@dofe/infra-shared-db/dist"],
"@app/auth": ["./libs/domain/auth/src"],
"@app/auth/*": ["./libs/domain/auth/src/*"],
"@app/services/*": ["./libs/domain/services/*"],
"@app/tenant-management": ["./libs/domain/tenant-management"],
"@app/tenant-management/*": ["./libs/domain/tenant-management/*"],
"@app/db": ["./generated/db"],
"@app/db/*": ["./generated/db/modules/*"]
```

### 4. 保留 `@alicloud/openapi-core` 和 `@darabonba/typescript` 依赖

这两个包已添加为 `apps/api/package.json` 的 `dependencies`。shared-services 改为 `peerDependencies` 后，消费端必须自行安装，当前已满足。

---

## 风险与验证

### 风险点

1. **bundler 兼容性**：移除扩展名后，某些 bundler（webpack、esbuild）的实现可能与 Node.js 原生的模块解析有细微差异。需在 sso.dofe.ai 实际编译验证。
2. **TypeScript 类型解析**：`types` 条件移除 `.d.ts` 扩展名后，需确认 TypeScript 能正确解析目录模块的类型（`ts-rest/index.d.ts`）。
3. **`utils` 包**：当前 `utils` 使用显式导出列表，改为 wildcard 后可能暴露原本不打算公开的内部模块。

### 验证步骤

1. infra.dofe.ai 各包 `pnpm build` 通过
2. sso.dofe.ai `pnpm install` 后 `pnpm dev:api` 编译通过
3. sso.dofe.ai `pnpm type-check` 通过
4. sso.dofe.ai `pnpm build:api` 通过
