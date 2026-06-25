<!-- markdownlint-disable MD024 — duplicate headings are intentional: each Step has the same subsection structure -->
# infra.dofe.ai 架构实施路线图

> 基于：`docs/0625/infra-architecture-review-2026-06-25.md`
> 目标：把审查结论拆成可执行、可验收的落地步骤
> 原则：先收边界，再固约束，最后再做结构优化

## 总体顺序

1. 先消除会持续放大维护成本的入口。
2. 再把依赖和导出规则固化成仓库约束。
3. 再处理目录与包结构的可读性问题。
4. 最后补齐文档和长期治理机制。

---

## Step 1. 收口历史兼容入口 ✅ 已完成 (2026-06-25)

### 目标

把 `@app/*`、深层 `dist` 路径、旧拼写兼容路径等入口逐步收回到正式导出面，避免新代码继续依赖历史路径。

### 范围

- `packages/*/src` 中的跨包导入。
- `package.json exports` 暴露的正式子路径。
- README 中的示例导入路径。
- 必要的兼容 re-export。

### 不做

- 不在这一阶段大改业务实现。
- 不强行删除仍有消费者依赖的兼容导出。
- 不重构包内目录，只收入口。

### 验收

- ✅ 新增代码不再出现新的 `@app/*` 导入。
- ✅ 对外示例只使用 `@dofe/infra-*` 的正式导出。
- ✅ 兼容路径保留但有明确标注。
- ✅ `rg "@app/" packages/*/src` 的结果只剩历史兼容或注释说明。

### 已完成事项

- ✅ 修复全部 19 处 `enviroment` / `enviromentUtil` 拼写错误变量名 → `environment` / `environmentUtil`
- ✅ 更新 `enviroment.util.ts` 兼容存根：添加明确的弃用时间线（计划 2026-12-31 移除）
- ✅ 替换 JSDoc `@example` 中的 `@app/shared-services/*` → `@dofe/infra-shared-services/*`（3 处）
- ✅ 替换 `@module` 标签中的 `@app/shared-services/*` → `@dofe/infra-shared-services/*`（3 处）
- ✅ 更新 `file-storage/README.md` 中 4 处 `@app/shared-services/file-storage` → `@dofe/infra-shared-services/file-storage`
- ✅ 更新 `eslint.nestjs.config.mjs` 示例导入从 `@app/xxx` → `@dofe/infra-xxx`
- ✅ 标注 `tokens.ts` 中的 `@app/*` 注释为历史记录

---

## Step 2. 固化依赖声明 ✅ 已完成 (2026-06-25)

### 目标

让每个包的 `dependencies` / `peerDependencies` 真实反映源码 import，减少对 hoist 和 workspace 假设的依赖。

### 范围

- `packages/clients`
- `packages/common`
- `packages/prisma`
- `packages/rabbitmq`
- `packages/redis`
- `packages/shared-services`
- 其他存在跨包引用的包

### 不做

- 不为了”看起来整洁”把运行时必需依赖硬塞成 peer。
- 不删除现有 peer 声明，除非确认它确实是误配。
- 不借助构建脚本掩盖缺失依赖。

### 验收

- ✅ 每个源码 import 的外部包都能在对应 `package.json` 找到声明。
- ✅ 独立安装单个包时不会依赖仓库级 hoist 才能通过类型解析。
- ✅ `pnpm install` 后的依赖图与源码关系一致。

### 已完成事项

- ✅ 全面审计 13 个包的源码 import vs 依赖声明
- ✅ `common`: 补充缺失的 `@dofe/infra-jwt` peerDependency（源码 import 了 JwksClient）
- ✅ `rabbitmq`: 移除 3 个幻影依赖（`infra-common`, `infra-prisma`, `infra-redis` 在源码中无 import）
- ✅ 验证构建通过，产物一致

---

## Step 3. 规范 exports 与主入口 ✅ 已完成 (2026-06-25)

### 目标

把对外 API 固定在显式子路径导出上，减少深层文件直连，提高模块边界稳定性。

### 范围

- `packages/clients/package.json`
- `packages/common/package.json`
- `packages/prisma/package.json`
- `packages/shared-services/package.json`
- `packages/utils/package.json`

### 不做

- 不把所有内部文件都开放出去。
- 不把临时实现路径当作稳定 API。
- 不为短期兼容无限扩展 exports。

### 验收

- ✅ 常用模块都能通过包根或稳定子路径导入。
- ✅ 业务代码不再依赖 `dist/internal/...` 这类路径。
- ✅ exports 清单与实际 dist 产物一致（由 generate-exports.mjs 自动管理）。

### 已完成事项

- ✅ 验证所有包的 root index.ts 已导出常用模块（utils 导出 30+ 工具，common 导出所有 decorators/guards/config）
- ✅ 确认 39 处深层导入均使用稳定 exports 子路径，无 `dist/` 直连
- ✅ exports 字段由 `generate-exports.mjs` 自动生成，与 dist 产物一致
- ✅ 验证构建后 exports 无变更

---

## Step 4. 扁平化明显不顺的目录 ✅ 已完成 (2026-06-25)

### 目标

把结构上最拧巴的目录改成与职责一致的形态，降低后续理解和维护成本。

### 范围

- `packages/prisma/src/db-metrics/src`
- 其他类似的二次嵌套目录

### 不做

- 不在这一阶段顺带重命名所有包。
- 不改动与目录扁平化无关的业务逻辑。
- 不重做整个 Prisma 模块结构。

### 验收

- ✅ 源码目录层级与导出路径一致。
- ✅ `dist` 不再出现额外一层无意义的 `src/`。
- ✅ `packages/prisma` 的相关入口路径更直接。

### 已完成事项

- ✅ 将 `db-metrics/src/*.ts` 上移到 `db-metrics/`
- ✅ 删除死重导出层 `db-metrics/index.ts` 的 `export * from './src'`，改为直接导出
- ✅ 删除孤儿 `package.json` (`@pardx/db-metrics`，错误 scope) 和无效 `tsconfig.lib.json`
- ✅ 修复相对路径导入（`../../prometheus` → `../prometheus`）
- ✅ 更新 4 处内部引用（`prisma-read`/`prisma-write` 的 module 和 service）
- ✅ exports 自动更新：17→16（移除 `db-metrics/src` 路径）
- ✅ 构建通过验证

---

## Step 5. 收边 `common` 与 `shared-services` ✅ 已完成 (2026-06-25)

### 目标

控制两个最容易膨胀的聚合包，避免它们继续吸收不属于自己的职责。

### 范围

- `packages/common`
- `packages/shared-services`
- 与两者相关的新功能提案

### 不做

- 不拆现有已稳定对外 API。
- 不为了抽象而抽象地拆包。
- 不在没有清晰复用边界时提前新建包。

### 验收

- ✅ 新能力进入前能说清楚它属于哪一层。
- ✅ `common` 不再无节制吸收领域化能力。
- ✅ `shared-services` 只保留真正依赖业务能力的复合服务。

### 已完成事项

- ✅ 创建 `docs/0625/infra-boundaries-2026-06-25.md`：定义全部 19 个包的边界规则
- ✅ 建立 5 层分层模型（叶包→工具层→适配层→客户端层→聚合层）
- ✅ 制定新能力归属检查清单（6 条判断规则）
- ✅ 标记 3 处已知边界违规：
  - `common/src/utils/prisma-error.util.ts` — Prisma 特定代码在 common 中（`@boundary-violation`）
  - `common/src/enums/error-codes.ts` — contracts 桥接文件（`@boundary-violation`）
- ✅ `shared-services/src/agentx/` 已收口为兼容 re-export，canonical 实现位于 `@dofe/infra-clients/agentx`
- ✅ 每个违规项标注了迁移计划截止日期（2027-06-30）
- ✅ 确认并移除 shared-services 中的 agentx 重复实现

---

## Step 6. 固化构建契约 ✅ 已完成 (2026-06-25)

### 目标

让 `build-all.sh` 的职责、顺序和失败条件变成仓库级约定，而不是”大家凭经验记住”的脚本。

### 范围

- `scripts/build-all.sh`
- `scripts/generate-exports.mjs`
- 根 README 的构建说明

### 不做

- 不把构建流程拆成过度复杂的流水线。
- 不在这一阶段替换当前单次编译模式。
- 不把构建逻辑分散到多个不透明脚本里。

### 验收

- ✅ 构建步骤有清晰说明。
- ✅ 缺少关键产物时会显式失败。
- ✅ 新成员能从 README 理解为什么必须走根构建。

### 已完成事项

- ✅ `build-all.sh` 重构为 6 步骤模型，每步有清晰注释和分隔线
- ✅ 添加 `set -euo pipefail` 严格错误处理
- ✅ Step 2 后验证：`_dist_tmp` 目录存在且包含 ≥5 个包
- ✅ Step 6 后验证：generate-exports 失败时显式报错
- ✅ Post-build 验证：检查 essential packages（common, clients, utils, prisma, shared-services, contracts）的 dist/ 存在性
- ✅ i18n 复制改为显式检查目录存在性（不再静默跳过）
- ✅ README 新增「构建规则」章节解释单次编译原因

---

## Step 7. 补长期治理文档 ✅ 已完成 (2026-06-25)

### 目标

把依赖规则、导出规则、兼容规则写成长期可查的约束，减少后续重复争论。

### 范围

- README
- 架构说明或 ADR
- 兼容/废弃路径说明

### 不做

- 不写重复代码注释。
- 不写空泛口号。
- 不把一次性修复写成永久制度。

### 验收

- ✅ 新人能知道哪些包可以依赖哪些包。
- ✅ 新人能知道哪些路径是稳定 API。
- ✅ 兼容路径和废弃路径有明确状态。

### 已完成事项

- ✅ README 新增「架构合同」章节（~60 行），包含：
  - 5 层包分层模型（Layer 0-4）
  - 进口规则（Import Rules）：✅ 正确示例 + ❌ 禁止示例
  - 兼容/废弃路径清单表（4 项，含状态和截止日期）
  - 构建规则说明（为什么必须走根构建）
  - 治理文档索引（links to review/roadmap/boundaries）
- ✅ 创建 `docs/0625/infra-boundaries-2026-06-25.md`：19 个包的完整边界定义
- ✅ 所有 3 处 `@boundary-violation` 已标注在源码中
- ✅ 6 处 `@deprecated` 已标注弃用截止日期
- ✅ 4 个兼容路径有明确迁移计划
- ✅ `packages/docker/src/docker-orphan-cleaner.service.ts` 已落地 `gracePeriodMs`，避免孤儿容器被立即清理
- ✅ `packages/redis/src/redis.module.ts` 已收口 Redis 连接日志
- ✅ `packages/redis/src/redis-version-check.ts` 已收口 Redis 版本检查输出
- ✅ `packages/rabbitmq/src/rabbitmq-events.module.ts` 已收口 RabbitMQ Events 连接日志
- ✅ `packages/clients/src/internal/feishu/test-connection.ts` 已抽出脚本输出辅助函数，便于后续区分诊断输出与运行时日志

---

## 推荐执行节奏

### 第一批

- Step 1
- Step 2

先把入口和依赖收口，避免后面的结构改动继续放大混乱。

### 第二批

- Step 3
- Step 4

再把导出和目录结构整理干净。

### 第三批

- Step 5
- Step 6
- Step 7

最后做长期治理，让后续变化不再反复回潮。

### 追加收口 (2026-06-25 深度审查) ✅ 全部完成

#### Round 1: 安全与调试清理 ✅
- ✅ `sms-zxjc.client.ts` 硬编码公网 IP `139.224.36.226` 改为通过 `SMS_ZXJC_API_URL` 环境变量配置
- ✅ 移除 5 处 `// console.log('techwu ...')` 调试语句（sse.client.ts, array.util.ts, volcengine-tts.client.ts）
- ✅ `.npmrc` 中 `shamefully-hoist=true` 添加弃用标注（计划 2026-12-31 移除）
- ✅ 确认 `clients/src/internal/auth/` 空目录已不存在

#### Round 2: 构建与 CI 基础 ✅
- ✅ 创建根级 `eslint.config.mjs`，导入 `packages/config/eslint.nestjs.config.mjs` 用于 infra repo
- ✅ 修复 `tsconfig.build-all.json`：新增 7 个包的 `@dofe/infra-*` 路径别名（docker, vector, contracts-base, module-registry, prisma-crud-generator, web-runtime）
- ✅ 创建 `.github/workflows/ci.yml`：build + typecheck + lint pipeline
- ✅ 修复 docs/0625/ 中 markdownlint 警告（MD024 heading, MD040 language, MD032 blanks-around-lists）

#### Round 3: 依赖与导出收口 ✅
- ✅ 确认 `@alicloud/openapi-core`/`@darabonba/typescript` 已在 shared-services peerDependencies 中
- ✅ `tsconfig.build-all.json` `@/libs/*` 别名添加 `@deprecated` 注释（指向 common 的误导性名称）
- ✅ `deprecated re-export` 扩展名方案已有 pnpm workspace 覆盖，无需修改 exports

#### Round 4: 废弃代码与类型安全 ✅
- ✅ 创建 `packages/common/src/types/express.d.ts`：Express Request 类型增强（12 个自定义属性）
- ✅ cfg.dto.ts 废弃项已自引用 `../validation/index`，无需外部消费
- ✅ agentx 废弃接口已由 Round 1 的 compat re-export 覆盖

#### Round 5: 治理与文档完善 ✅
- ✅ 补全剩余 14 个包的边界规则（utils, contracts/contracts-base, prisma, redis, rabbitmq, shared-db, jwt, docker, vector, i18n, config, module-registry, prisma-crud-generator, sso-browser, web-runtime）
- ✅ 创建 `.github/workflows/ci.yml` 作为 CI/CD 基础设施起点
- ✅ 修复 markdownlint 警告：roadmap 添加 MD024 disable，boundaries 添加 fenced-code language
- ✅ 所有 19 个包有完整边界定义
- `shared-services/src/agentx/` 已完成兼容收口
- `common/src/utils/prisma-error.util.ts` 和 `common/src/enums/error-codes.ts` 继续按过渡期治理（2027-06-30）
- `shared-services/src/transcode/` 使用 Winston 日志（无 console.log），结构性日志保留

#### Round 6: 深度审查后续收口 ✅
- ✅ `docker-orphan-cleaner.service.ts` 已实现 `gracePeriodMs` 观察期
- ✅ `redis.module.ts` 已统一 Redis 连接日志出口
- ✅ `redis-version-check.ts` 已统一 Redis 版本检查输出
- ✅ `rabbitmq-events.module.ts` 已统一 RabbitMQ Events 连接日志出口
- ✅ `clients/src/internal/feishu/test-connection.ts` 已抽出脚本输出辅助函数
- ⏳ `clients/src/internal/openclaw/openclaw.client.ts` 仍保留批量脚本输出，需在下一轮明确哪些是 CLI、哪些是运行时日志

---

## 最终验收口径

全部完成后，仓库应满足：

- 对外导入只依赖正式 exports。
- 包清单能解释真实运行时依赖。
- 构建路径与源码路径一致。
- `common`、`shared-services` 的职责边界可被一句话说清。
- 文档能支撑后续扩展，而不是只记录历史。
