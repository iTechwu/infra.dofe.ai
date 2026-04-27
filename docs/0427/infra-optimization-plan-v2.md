# infra.dofe.ai 优化方案 v2（第二轮深度审查）

> 审查日期: 2026-04-27
> 基于 v1 方案执行完成后的第二轮全面审查
> 审查范围: infra.dofe.ai + models.dofe.ai/apps/api

---

## 一、v1 执行结果回顾

v1 方案共 10 项优化，执行情况：

| # | 任务 | 状态 |
|---|------|------|
| 2.1 | 清理 src/ 编译产物 + .gitignore | ✅ 已完成 |
| 2.2 | 更新 jest.config.json 路径映射 | ✅ 已完成 |
| 2.3 | i18n 资源文件复制到 dist | ✅ 已完成（build-all.sh 末尾） |
| 2.4 | 补全 peerDependencies | ✅ 已完成（5 个包） |
| 2.5 | 消除硬编码路径（tsconfig.build-all.json） | ✅ 已完成（Node16 moduleResolution） |
| 2.6 | 循环依赖处理 | ✅ 方案 B（统一构建） |
| 2.7 | 完善 common index 导出 | ✅ 已完成（32 个 re-export） |
| 2.8 | 清理废弃文件 | ✅ 已完成 |
| 2.9 | prisma db-metrics 扁平化 | ⚠️ 未执行（仍存在嵌套） |
| 2.10 | clients 依赖补全 | ✅ 已完成 |

---

## 二、第二轮审查发现

### P0 — 关键问题

#### 3.1 @app/ 路径别名跨包引用未声明依赖

**问题**: 多个 infra 包通过 `@app/` 路径别名引用了其他 infra 包的代码，但未在 `package.json` 的 `dependencies` 中声明。虽然统一构建绕过了这个问题，但：
- IDE 跳转和类型推断可能不正确
- 独立使用任何包时会失败
- 依赖关系不透明，难以维护

**实际跨包引用**:

| 包 | 引用了 | 声明在 deps? |
|---|--------|-------------|
| `clients` | `@app/redis` → `@dofe/infra-redis` | ❌ 未声明 |
| `clients` | `@app/shared-services` → `@dofe/infra-shared-services` | ✅ 已声明 |
| `common` | `@app/redis` → `@dofe/infra-redis` | ✅ 已声明 |
| `prisma` | `@app/redis` → `@dofe/infra-redis` | ❌ 未声明 |
| `rabbitmq` | `@app/prisma` → `@dofe/infra-prisma` | ❌ 未声明 |
| `rabbitmq` | `@app/redis` → `@dofe/infra-redis` | ❌ 未声明 |
| `shared-db` | `@app/prisma` → `@dofe/infra-prisma` | ✅ 已声明 |
| `shared-services` | `@app/clients` → `@dofe/infra-clients` | ✅ 已声明 |
| `shared-services` | `@app/jwt` → `@dofe/infra-jwt` | ❌ 未声明 |
| `shared-services` | `@app/rabbitmq` → `@dofe/infra-rabbitmq` | ❌ 未声明 |
| `utils` | `@app/clients` → `@dofe/infra-clients` | ❌ 未声明 |

**方案**: 在对应包的 `package.json` → `dependencies` 中添加缺失的 `@dofe/infra-*` 声明：

```jsonc
// packages/clients/package.json - 添加
{ "dependencies": { "@dofe/infra-redis": "workspace:*" } }

// packages/prisma/package.json - 添加
{ "dependencies": { "@dofe/infra-redis": "workspace:*" } }

// packages/rabbitmq/package.json - 添加
{
  "dependencies": {
    "@dofe/infra-prisma": "workspace:*",
    "@dofe/infra-redis": "workspace:*"
  }
}

// packages/shared-services/package.json - 添加
{
  "dependencies": {
    "@dofe/infra-jwt": "workspace:*",
    "@dofe/infra-rabbitmq": "workspace:*"
  }
}

// packages/utils/package.json - 添加
{ "dependencies": { "@dofe/infra-clients": "workspace:*" } }
```

**影响**: 补全后 `pnpm install` 会正确建立 symlink，IDE 类型推断更准确。

---

#### 3.2 pnpm-workspace.yaml 包含不必要的 apps/*

**问题**: `pnpm-workspace.yaml` 包含 `apps/*`，但 infra.dofe.ai 没有 `apps/` 目录。这个条目来自 monorepo 模板残留。

```yaml
# 当前
packages:
  - 'apps/*'          # ← 不存在，应移除
  - 'packages/*'
  - '../infra.dofe.ai/packages/*'
```

**方案**: 移除 `'apps/*'`：

```yaml
packages:
  - 'packages/*'
  - '../infra.dofe.ai/packages/*'
```

**影响**: 消除 pnpm 无效目录扫描，避免警告信息。

---

### P1 — 重要优化

#### 3.3 tsconfig.json（IDE）与 tsconfig.build-all.json（构建）严重不一致

**问题**: 两个 tsconfig 配置已严重分歧：

| 配置项 | tsconfig.json（IDE） | tsconfig.build-all.json（构建） |
|--------|---------------------|-------------------------------|
| `module` | `CommonJS` | `Node16` |
| `moduleResolution` | `Node` | `Node16` |
| `strict` | `false` | `false` |
| `declaration` | `true` | `true` |
| `noEmit` | (未设) | `false` |
| `outDir` | (未设) | `./_dist_tmp` |
| `rootDir` | (未设) | `./packages` |
| `forceConsistentCasingInFileNames` | `true` | (未设) |
| `strictNullChecks` | `false` | (未设) |
| `strictPropertyInitialization` | `false` | (未设) |
| `noImplicitAny` | `false` | (未设) |
| `types` | `["node"]` | (未设) |

IDE 用 `tsconfig.json` 使用旧配置（`module: CommonJS`, `moduleResolution: Node`），构建用 `tsconfig.build-all.json` 使用新配置（`module: Node16`）。IDE 的类型检查可能与实际构建不一致。

**方案**: 让 `tsconfig.json` 继承 `tsconfig.build-all.json`，仅覆盖 IDE 特有选项：

```jsonc
// tsconfig.json
{
  "extends": "./tsconfig.build-all.json",
  "compilerOptions": {
    "noEmit": true,              // IDE 不输出文件
    "strictNullChecks": false,
    "strictPropertyInitialization": false,
    "noImplicitAny": false,
    "types": ["node"]
  },
  "exclude": [
    "node_modules",
    "packages/*/node_modules",
    "packages/*/dist",
    "**/*.spec.ts",
    "**/*.test.ts"
  ]
}
```

这样 IDE 和构建使用相同的 `module: Node16`、`moduleResolution: Node16`、`paths` 映射，确保一致性。

---

#### 3.4 生产代码中的调试 console.log

**问题**: 以下文件包含 `console.log('techwu ...')` 风格的调试语句，不应出现在生产代码中：

| 文件 | 行号 | 内容 |
|------|------|------|
| `clients/src/internal/sse/sse.client.ts` | 146 | `console.log('techwu sendToClient', data)` |
| `clients/src/internal/file-storage/file-tos.client.ts` | 406 | `console.log('techwu parseError', ...)` |
| `clients/src/internal/file-storage/file-tos.client.ts` | 629 | `console.log('techwu bucket', ...)` |

另有多个文件有裸 `console.log`（非注释、非 JSDoc 示例）：
- `file-storage/file-qiniu.client.ts` — 6 处裸 console.log
- `common/src/config/configuration.ts` — 6 处（启动日志，可接受）
- `rabbitmq/src/rabbitmq-events.module.ts` — 5 处
- `rabbitmq/src/rabbitmq.module.ts` — 5 处
- `redis/src/redis.module.ts` — 1 处

**方案**:
1. 删除所有 `console.log('techwu ...')` 调试语句
2. 将 `file-qiniu.client.ts` 中的 `console.log` 替换为 Winston Logger 调用
3. `rabbitmq` 和 `redis` 模块中的连接/重试日志可保留，但建议统一为注入的 Logger
4. `common/config/configuration.ts` 中的启动日志可保留（NestJS 启动阶段无 Logger）

---

#### 3.5 clients/src/internal/auth/ 空目录

**问题**: `packages/clients/src/internal/auth/` 目录存在但包含 0 个文件。这是提取残留或未完成的功能。

**方案**: 删除空目录。如果 auth client 功能后续需要，重新创建即可。

```bash
rmdir packages/clients/src/internal/auth/
```

---

### P2 — 改善优化

#### 3.6 prisma 包 db-metrics 目录嵌套过深

**问题**: `packages/prisma/src/db-metrics/src/db-metrics.module.ts` 存在多余的 `src/` 嵌套，构建后产生 `dist/db-metrics/src/*.js`。v1 已识别但未执行。

**方案**:
```bash
# 扁平化
mv packages/prisma/src/db-metrics/src/* packages/prisma/src/db-metrics/
rmdir packages/prisma/src/db-metrics/src/
```
同步更新 `packages/prisma/src/index.ts` 中的引用路径。

---

#### 3.7 enviroment.util.ts 文件名拼写错误

**问题**: `packages/utils/src/enviroment.util.ts` — "enviroment" 应为 "environment"。

**方案**:
1. 重命名文件: `enviroment.util.ts` → `environment.util.ts`
2. 更新 `packages/utils/src/index.ts` 中的 re-export 路径
3. 更新 `tsconfig.build-all.json` 和 `tsconfig.json` 中的路径映射（如果有直接引用）
4. 在旧路径创建 re-export 桩（兼容期）:
   ```typescript
   // enviroment.util.ts (compatibility stub)
   export * from './environment.util';
   ```

---

#### 3.8 package.json 中 main/types 仍指向 src/（部分包）

**问题**: 部分包的 `package.json` 中 `main` 和 `types` 仍指向 `src/index.ts` 而非 `dist/index.js` / `dist/index.d.ts`。v1 声称已修复，但需验证。

**验证**:
```bash
for pkg in packages/*/; do
  name=$(basename "$pkg")
  main=$(jq -r '.main' "$pkg/package.json")
  types=$(jq -r '.types // empty' "$pkg/package.json")
  echo "$name: main=$main types=$types"
done
```

**期望**: 所有包 `main` 指向 `dist/index.js`，`types` 指向 `dist/index.d.ts`。

---

#### 3.9 .npmrc shamefully-hoist=true

**问题**: `.npmrc` 中 `shamefully-hoist=true` 是为了解决 pnpm 严格链接模型下的依赖解析问题。这在本地开发中掩盖了缺失的依赖声明，但部署到生产环境可能导致运行时错误。

**方案**:
1. 先完成 3.1（补全依赖声明）
2. 然后移除 `shamefully-hoist=true`
3. 运行 `pnpm install` + 构建验证
4. 如有报错，逐一补充缺失依赖
5. 保留 `auto-install-peers=false` 和 `strict-peer-dependencies=false`

---

#### 3.10 models.dofe.ai CLAUDE.md 中的过时引用

**问题**: `models.dofe.ai/CLAUDE.md` 仍大量引用 `libs/infra/*` 路径和 `apps/api/libs/infra/` 结构，已与实际代码不符。

**涉及内容**:
- 架构图中的 `libs/infra/` 目录结构
- Import aliases 中 `@/common/*` → `libs/infra/common/*` 的说明
- .cursorrules 和 docs/ 中的 infra 路径引用

**方案**: 更新 CLAUDE.md 架构说明：
- `libs/infra/common` → `@dofe/infra-common` (node_modules)
- `libs/infra/clients` → `@dofe/infra-clients`
- 其他 infra 包同理
- 标注路径映射: `@/common/*` → `node_modules/@dofe/infra-common/dist/*`

---

## 三、执行优先级

| 优先级 | 任务 | 预估工时 | 影响范围 |
|--------|------|---------|---------|
| **P0** | 3.1 补全 @app/ 跨包依赖声明 | 30min | 所有 infra 包 |
| **P0** | 3.2 修正 pnpm-workspace.yaml | 5min | monorepo 配置 |
| **P1** | 3.3 统一 tsconfig 配置 | 30min | IDE/构建一致性 |
| **P1** | 3.4 清理调试 console.log | 30min | clients, rabbitmq, redis |
| **P1** | 3.5 删除空 auth 目录 | 2min | clients 包 |
| **P2** | 3.6 db-metrics 扁平化 | 15min | prisma 包 |
| **P2** | 3.7 enviroment 拼写修正 | 15min | utils 包 |
| **P2** | 3.8 验证 main/types 指向 | 10min | 所有包 |
| **P2** | 3.9 移除 shamefully-hoist | 20min | .npmrc |
| **P2** | 3.10 更新 CLAUDE.md | 30min | 文档 |

**总计**: ~3 小时。建议先完成 P0（35min），再推进 P1 和 P2。

---

## 四、当前依赖关系图（基于实际 import 分析）

```
utils ──────────────────────→ @dofe/infra-clients (❌ 未声明)
  └── (无其他 @dofe 依赖)

common ──────────────────────→ @dofe/infra-redis ✅
  ├── @dofe/infra-i18n ✅
  └── @dofe/infra-utils ✅

jwt ─────────────────────────→ @dofe/infra-common ✅ (via peerDep path)

redis ───────────────────────→ @dofe/infra-common ✅

prisma ──────────────────────→ @dofe/infra-common ✅
  ├── @dofe/infra-utils ✅
  └── @dofe/infra-redis ❌ (未声明)

rabbitmq ────────────────────→ @dofe/infra-common ✅
  ├── @dofe/infra-prisma ❌ (未声明)
  └── @dofe/infra-redis ❌ (未声明)

shared-db ───────────────────→ @dofe/infra-common ✅
  └── @dofe/infra-prisma ✅

clients ─────────────────────→ @dofe/infra-common ✅
  ├── @dofe/infra-utils ✅
  ├── @dofe/infra-shared-services ✅
  └── @dofe/infra-redis ❌ (未声明)

shared-services ─────────────→ @dofe/infra-common ✅
  ├── @dofe/infra-clients ✅
  ├── @dofe/infra-prisma ✅
  ├── @dofe/infra-redis ✅
  ├── @dofe/infra-utils ✅
  ├── @dofe/infra-jwt ❌ (未声明)
  └── @dofe/infra-rabbitmq ❌ (未声明)
```

---

## 五、长期演进方向（与 v1 一致，重申）

1. **npm 发布**: 将 `@dofe/infra-*` 发布到私有 registry，消除 workspace symlink
2. **循环依赖消除**: 提取接口层，使 common 不再直接 import redis
3. **Changesets**: 管理跨 repo 包版本
4. **独立测试**: 每个 infra 包可独立 `pnpm test`
5. **CI/CD**: 独立的构建 + 测试流水线
