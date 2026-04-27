# infra.dofe.ai 优化方案

> 审查日期: 2026-04-27
> 基于 infra 提取完成后的全面审查

---

## 一、当前状态概览

infra.dofe.ai 已成功将 10 个 infra 包从 `models.dofe.ai/apps/api/libs/infra/` 提取为独立 monorepo。API 编译零错误。但仍存在以下问题需解决。

| 包 | 名称 | 源文件数 | dist 完整 | 备注 |
|---|------|---------|----------|------|
| common | `@dofe/infra-common` | 66 | ✅ | root index 导出过少 |
| utils | `@dofe/infra-utils` | 25 | ✅ | 较干净 |
| prisma | `@dofe/infra-prisma` | 15 | ✅ | db-metrics 目录结构异常 |
| redis | `@dofe/infra-redis` | 5 | ✅ | CacheService 已导出 |
| rabbitmq | `@dofe/infra-rabbitmq` | 6 | ✅ | bullmq peerDep 未使用 |
| jwt | `@dofe/infra-jwt` | 3 | ✅ | 干净 |
| shared-db | `@dofe/infra-shared-db` | 5 | ✅ | 最干净 |
| shared-services | `@dofe/infra-shared-services` | 32 | ✅ | FIXES_SUMMARY.md 遗留在 src |
| clients | `@dofe/infra-clients` | 76 | ✅ | 依赖声明最差 |
| i18n | `@dofe/infra-i18n` | 1 + 4 JSON | ⚠️ | JSON 未进入 dist |

---

## 二、问题分类与优化方案

### P0 — 必须修复（阻塞正常开发/测试）

#### 2.1 src/ 目录被编译产物污染（765 个文件）

**问题**: 每个 package 的 `src/` 目录存在 `.js`、`.d.ts`、`.js.map` 编译产物，共计 765 个文件。IDE 索引混乱，可能误引 `src/` 而非 `dist/`。

**原因**: `build-all.sh` 使用 `rootDir: "packages"` 编译所有包，tsc 在 `packages/*/src/` 下生成了 `.ts` 编译中间产物。

**方案**:
1. 清理所有 src/ 中的编译产物:
   ```bash
   find packages -path "*/src/*.js" -o -path "*/src/*.d.ts" -o -path "*/src/*.js.map" | xargs rm
   ```
2. 在 `.gitignore` 添加: `packages/*/src/**/*.js`、`packages/*/src/**/*.d.ts`、`packages/*/src/**/*.js.map`
3. 改进 `build-all.sh`，使用 `--outDir` 确保输出只进 `_dist_tmp/`

---

#### 2.2 Jest 配置指向已删除的 libs/infra/

**问题**: `models.dofe.ai/apps/api/jest.config.json` 的 `moduleNameMapper` 仍全部指向 `<rootDir>/libs/infra/*`，该目录已不存在。所有涉及 infra 导入的测试均会失败。

**方案**: 更新 `jest.config.json`，将所有 `libs/infra/*` 映射改为 `node_modules/@dofe/infra-*/dist/*`：

```json
{
  "moduleNameMapper": {
    "^@app/redis$": "<rootDir>/node_modules/@dofe/infra-redis/dist",
    "^@app/redis/dto/(.*)$": "<rootDir>/node_modules/@dofe/infra-redis/dist/dto/$1",
    "^@app/prisma$": "<rootDir>/node_modules/@dofe/infra-prisma/dist/prisma",
    "^@app/shared-db$": "<rootDir>/node_modules/@dofe/infra-shared-db/dist",
    "^@app/jwt$": "<rootDir>/node_modules/@dofe/infra-jwt/dist",
    "^@app/jwt/(.*)$": "<rootDir>/node_modules/@dofe/infra-jwt/dist/$1",
    "^@app/clients/(.*)$": "<rootDir>/node_modules/@dofe/infra-clients/dist/$1",
    "^@app/shared-services/(.*)$": "<rootDir>/node_modules/@dofe/infra-shared-services/dist/$1",
    "^@app/services/(.*)$": "<rootDir>/node_modules/@dofe/infra-shared-services/dist/$1",
    "^@app/infra/common$": "<rootDir>/node_modules/@dofe/infra-common/dist",
    "^@/prisma/(.*)$": "<rootDir>/node_modules/@dofe/infra-prisma/dist/prisma/$1",
    "^@/prisma-read/(.*)$": "<rootDir>/node_modules/@dofe/infra-prisma/dist/prisma-read/$1",
    "^@/prisma-write/(.*)$": "<rootDir>/node_modules/@dofe/infra-prisma/dist/prisma-write/$1",
    "^@/utils/(.*)$": "<rootDir>/node_modules/@dofe/infra-utils/dist/$1",
    "^@/config/(.*)$": "<rootDir>/node_modules/@dofe/infra-common/dist/config/$1",
    "^@/middleware/(.*)$": "<rootDir>/node_modules/@dofe/infra-common/dist/middleware/$1",
    "^@/filter/(.*)$": "<rootDir>/node_modules/@dofe/infra-common/dist/filter/$1",
    "^@/decorators/(.*)$": "<rootDir>/node_modules/@dofe/infra-common/dist/decorators/$1",
    "^@/interceptor/(.*)$": "<rootDir>/node_modules/@dofe/infra-common/dist/interceptor/$1",
    "^@/pipes/(.*)$": "<rootDir>/node_modules/@dofe/infra-common/dist/pipes/$1",
    "^@/common/(.*)$": "<rootDir>/node_modules/@dofe/infra-common/dist/$1",
    "^@/(.*)$": "<rootDir>/node_modules/@dofe/infra-common/dist/$1"
  }
}
```

---

#### 2.3 i18n 包运行时资源缺失

**问题**: `packages/i18n/src/` 包含 JSON 语言文件（`en/errors.json` 等），但 `dist/` 中没有。`index.ts` 使用 `__dirname + '/en'` 引用路径，运行时 `__dirname` 指向 `dist/`，路径不存在。

**当前变通**: `nest-cli.json` 中配置了 `assets` 复制 `node_modules/@dofe/infra-i18n/src/**/*`，依赖消费方构建工具。

**方案**: 在 `i18n/package.json` 添加 `files` + 构建脚本复制资源文件：

```json
{
  "files": ["dist", "src/**/*.json"],
  "scripts": {
    "build": "bash scripts/build-all.sh",
    "postbuild": "cp -r src/en dist/en && cp -r src/zh-CN dist/zh-CN"
  }
}
```

或更优雅地，在 `build-all.sh` 末尾增加：
```bash
cp -r packages/i18n/src/en packages/i18n/dist/en
cp -r packages/i18n/src/zh-CN packages/i18n/dist/zh-CN
```

---

### P1 — 重要优化（影响可维护性和 CI/CD）

#### 2.4 缺失的 peerDependencies 声明

**问题**: 多个 npm 包在源码中被 import 但未在 package.json 中声明，运行时依赖 monorepo 的 `shamefully-hoist` 提升机制。

**缺失统计**:

| npm 包 | 缺失于 | 影响程度 |
|--------|--------|---------|
| `nest-winston` | clients, common, rabbitmq, redis, shared-services | 高 — Logger 核心依赖 |
| `winston` | clients, common, rabbitmq, redis, shared-services | 高 |
| `class-validator` | clients, common, prisma, redis, shared-services | 中 |
| `zod` | clients, common, shared-services | 中 |
| `uuid` | clients, common, redis, shared-services | 中 |

**方案**: 为每个包补充 `peerDependencies`。创建脚本自动扫描：

```bash
# 检查未声明的 import
for pkg in packages/*/; do
  name=$(basename "$pkg")
  echo "=== $name ==="
  # 扫描 import 语句中的包名，与 package.json 的 deps/peerDeps 对比
  grep -roh "from '[@][^/]*\/[^/]*\|from '[^@/][^/]*" "$pkg/src/" 2>/dev/null | sort -u
done
```

推荐补充方式（以 common 为例）:
```jsonc
// packages/common/package.json - peerDependencies
{
  "cls-hooked": "^4.2.2",
  "crypto-js": "^4.2.0",
  "js-yaml": "^4.1.0",
  "nestjs-i18n": "^10.4.5",
  "accept-language-parser": "^1.5.0",
  "uuid": "^11.1.0",
  "zod": "^4.3.6",
  "class-validator": "^0.14.1",
  "nest-winston": "^1.9.7",
  "winston": "^3.13.0"
}
```

---

#### 2.5 tsconfig 硬编码相对路径（CI/CD 不友好）

**问题**: 8 个 tsconfig 文件包含 `../../../models.dofe.ai/` 硬编码路径，在 CI/CD 环境（repos 不在同一目录）或 Docker 构建中会失败。

**涉及文件**:
- `tsconfig.json`（IDE 用）
- `tsconfig.build-all.json`（构建用）
- 5 个 package 的 `tsconfig.build.json`
- `tsconfig.build-base.json`（已废弃）

**方案**:
1. **短期**: 在 CI/CD 中使用 symlink 确保目录结构一致
2. **长期**: 将 `@repo/contracts`、`@repo/utils` 等也发布为 npm 包或 Git submodule，tsconfig 只引用 workspace 包名

```jsonc
// 理想的 tsconfig.build-all.json（无硬编码路径）
{
  "paths": {
    "@repo/contracts/*": ["../models.dofe.ai/packages/contracts/src/*"],
    // 或使用 tsconfig references:
    "@repo/contracts/errors": ["../../models.dofe.ai/packages/contracts/src/errors/index"]
  }
}
```

3. **替代方案**: 在 `pnpm-workspace.yaml` 中添加 `../models.dofe.ai/packages/*`（已有），然后 tsconfig 使用 `node_modules/@repo/contracts/` 路径而非相对路径

---

#### 2.6 循环依赖：common ↔ redis, clients ↔ shared-services

**问题**: 
- `common` 依赖 `redis`（`RedisModule`、`RedisService`）→ `redis` 依赖 `common`（`@/config`、`@/filter`）
- `clients` 依赖 `shared-services`（`FileStorageService`）→ `shared-services` 依赖 `clients`（`@app/clients/internal/*`）

**当前处理**: `build-all.sh` 统一编译所有包，避免独立编译时的循环问题。

**方案**:

**方案 A（推荐 — 拆分提取接口）**:
```
infra.dofe.ai/packages/
├── common/          # 不依赖 redis
├── redis/           # 依赖 common
├── redis-types/     # 纯类型/接口，common 和 redis 都依赖它
├── shared-services/ # 不直接 import clients，通过 interface 解耦
├── clients/         # 依赖 common，不依赖 shared-services
```

将 `common` 对 `redis` 的依赖改为仅依赖类型/接口（如 `IRedisService`），定义在 `common` 内部。

**方案 B（维持现状 — 文档化）**:
保持 `build-all.sh` 统一编译方式，在 README 中明确说明：infra 包不可独立编译，必须通过根级 `pnpm build` 编译所有包。

---

### P2 — 改善（提升代码质量）

#### 2.7 common 包 root index 导出过少

**问题**: `common/src/index.ts` 仅导出 5 个符号（`CommonModule`、`EncryptionService`、3 个 decorator、`JwtConfig`），但包内有 66 个源文件、数百个导出。消费方必须使用深层路径如 `@dofe/infra-common/config/validation`。

**方案**: 完善根 `index.ts`，添加关键 re-export：

```typescript
// common/src/index.ts
export * from './common.module';
export * from './encryption.service';

// Decorators
export * from './decorators/device-info.decorator';
export * from './decorators/team-info.decorator';
export * from './decorators/rate-limit';
export * from './decorators/ts-rest-controller.decorator';
export * from './decorators/validation.decorator';
export * from './decorators/transaction/transactional.decorator';

// Config
export * from './config/dto/config.dto';
export * from './config/validation';

// Enums
export * from './enums/action.enum';
export * from './enums/error-codes';
export * from './enums/role.enum';
// ... 其他 enum

// Filter
export * from './filter/exception/api.exception';
export * from './filter/exception/http.exception';

// Guards
export * from './guards/auth.guard';
export * from './guards/team.guard';

// Interceptors
export * from './interceptor/transform.interceptor';
export * from './interceptor/logging.interceptor';

// Middleware
export * from './middleware/request.middleware';

// Pipes
export * from './pipes/sanitize-html.pipe';

// ts-rest
export * from './ts-rest/response.helper';
export * from './ts-rest/ts-rest.config';

// Adapters
export * from './adapters/fastify.adapter';

// Types
export type { JwtConfig } from './config/validation';
```

---

#### 2.8 清理废弃文件

| 文件 | 问题 | 方案 |
|------|------|------|
| `tsconfig.build-base.json` | 不被任何配置引用 | 删除 |
| `common/src/file.util.ts` | 被排除在构建外，无对应 dist | 删除（已有 `utils/src/file.util.ts` 替代） |
| `shared-services/src/FIXES_SUMMARY.md` | 文档遗留在 src/ | 移至 docs/ |
| `rabbitmq` 的 `bullmq` peerDep | 未被 import | 移除 |

---

#### 2.9 prisma 包 db-metrics 目录结构优化

**问题**: `src/db-metrics/src/db-metrics.module.ts` 存在多余嵌套，导致 `dist/db-metrics/src/*.js`。

**方案**: 扁平化为 `src/db-metrics/db-metrics.module.ts`，同步更新 `index.ts` 引用路径。

---

#### 2.10 clients 包依赖声明补全

**问题**: `clients` 包 import 了 20+ 第三方 SDK（AWS S3、Google Cloud、阿里云、七牛、火山引擎等），但无一声明在 package.json 中。

**方案**: 将所有实际 import 的第三方包加入 `peerDependencies`：

```jsonc
// packages/clients/package.json - 新增 peerDependencies
{
  "@aws-sdk/client-s3": "^3.978.0",
  "@aws-sdk/client-sts": "^3.1024.0",
  "@aws-sdk/s3-request-presigner": "^3.978.0",
  "@google-cloud/storage": "^7.12.0",
  "@alicloud/dysmsapi20170525": "^4.1.1",
  "@alicloud/openapi-client": "^0.4.15",
  "@volcengine/openapi": "^1.32.0",
  "@volcengine/tos-sdk": "^2.7.6",
  "nodemailer": "^7.0.3",
  "nodemailer-sendcloud-transport": "^0.0.2",
  "qiniu": "^7.12.0",
  "tencentcloud-sdk-nodejs-sms": "^4.0.859",
  "ws": "^8.18.3",
  "lodash": "^4.17.21",
  "uuid": "^11.1.0",
  "zod": "^4.3.6",
  "class-validator": "^0.14.1",
  "nest-winston": "^1.9.7",
  "winston": "^3.13.0"
}
```

---

## 三、执行优先级与排期建议

| 优先级 | 任务 | 预估工时 | 阻塞影响 |
|--------|------|---------|---------|
| **P0** | 2.1 清理 src/ 编译产物 + .gitignore | 15min | IDE 混乱 |
| **P0** | 2.2 更新 jest.config.json | 30min | 测试全挂 |
| **P0** | 2.3 i18n 资源文件复制到 dist | 15min | 运行时 i18n 失效 |
| **P1** | 2.4 补全 peerDependencies | 2h | 非本地环境运行失败 |
| **P1** | 2.5 消除硬编码路径 | 1h | CI/CD 失败 |
| **P1** | 2.6 循环依赖处理（方案 B） | 1h | 构建可维护性 |
| **P2** | 2.7 完善 common index 导出 | 1h | DX 改善 |
| **P2** | 2.8 清理废弃文件 | 30min | 代码整洁 |
| **P2** | 2.9 prisma 目录扁平化 | 15min | 结构清晰 |
| **P2** | 2.10 clients 依赖补全 | 1h | 依赖完整性 |

**总计**: ~8 小时。建议先完成 P0（1 小时），再推进 P1 和 P2。

---

## 四、架构总览图

```
infra.dofe.ai (独立 monorepo)
├── packages/
│   ├── utils/            ← 无 infra 依赖（叶子节点）
│   ├── common/           ← 依赖 utils
│   ├── i18n/             ← 独立（资源文件）
│   ├── jwt/              ← 依赖 common（peerDep）
│   ├── redis/            ← 依赖 common  ←→ common 依赖 redis（循环）
│   ├── prisma/           ← 依赖 common, utils
│   ├── rabbitmq/         ← 依赖 common, prisma, redis
│   ├── shared-db/        ← 依赖 common, prisma
│   ├── clients/          ← 依赖 common, utils  ←→ shared-services（循环）
│   └── shared-services/  ← 依赖 common, prisma, redis, clients, utils
│
├── scripts/
│   └── build-all.sh      ← 统一编译（处理循环依赖）
│
└── tsconfig.build-all.json ← 单一 tsc 编译配置

依赖方向: utils → common → {jwt, redis, prisma} → {rabbitmq, shared-db} → {clients, shared-services}
循环: common ↔ redis, clients ↔ shared-services
```

```
models.dofe.ai (消费方 monorepo)
├── pnpm-workspace.yaml   ← 包含 ../infra.dofe.ai/packages/*
├── apps/api/
│   ├── package.json      ← 10 个 @dofe/infra-* workspace:* 依赖
│   ├── tsconfig.json     ← paths 映射到 node_modules/@dofe/infra-*/dist/*
│   ├── tsconfig.build.json ← declaration: false（避免 TS2742）
│   ├── jest.config.json  ← ⚠️ 需更新 moduleNameMapper
│   └── libs/domain/      ← 业务代码（保留）
```

---

## 五、CI/CD 构建流程建议

```yaml
# .github/workflows/build.yml (infra.dofe.ai)
name: Build & Test
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          path: infra.dofe.ai
      - uses: actions/checkout@v4
        with:
          repository: iTechwu/models.dofe.ai
          path: models.dofe.ai
          token: ${{ secrets.PAT }}
      - uses: pnpm/action-setup@v4
      - run: cd infra.dofe.ai && pnpm install
      - run: cd infra.dofe.ai && pnpm build
      - run: cd infra.dofe.ai && find packages -path "*/src/*.js" -delete  # 防泄漏
```

关键点：CI 中需要两个 repo 并列检出，或使用 npm publish + registry 方式解耦。

---

## 六、长期演进方向

1. **npm 发布**: 将 `@dofe/infra-*` 包发布到私有 npm registry，消除 workspace symlink 和硬编码路径依赖
2. **循环依赖消除**: 采用方案 A（接口提取），使每个包可独立编译和测试
3. **版本管理**: 使用 Changesets 管理跨 repo 包版本
4. **独立测试**: 为每个 infra 包添加独立单元测试，不再依赖 API 项目环境
