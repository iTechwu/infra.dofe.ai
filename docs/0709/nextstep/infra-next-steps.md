# Infra Next Steps

日期：2026-07-09

## NS-INFRA-01: pnpm 安装治理与 allowBuilds 收口

**状态**：已完成（循环 1、4）。`pnpm-workspace.yaml` 的 `allowBuilds` 占位字符串已替换为明确布尔值；标准 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 已通过。循环 4 进一步把 pnpm 11 已忽略的根 `package.json#pnpm.peerDependencyRules/onlyBuiltDependencies` 迁移到 `pnpm-workspace.yaml`。

**目标**：恢复标准 `pnpm --filter ...` 验证链路，避免继续依赖直接调用 `tsc`/`node` 脚本绕过 pnpm 安装策略。

**范围**：`.npmrc`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、CI 中涉及安装与 built dependency 策略的配置；本轮已处理 `allowBuilds` 占位项和 pnpm 11 settings 迁移。

**不做**：不在本步骤升级 pnpm 大版本；不顺手改业务依赖版本；不删除当前为 Prisma 运行时保留的 `public-hoist-pattern[]=@prisma/*`。

**受益**：本地、CI 和发布前验证路径一致，`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 能重新作为正式验收命令使用。

**验收**：

```bash
pnpm install --lockfile-only
pnpm --filter @dofe/infra-shared-services verify:volcengine-speech
git diff --check
```

**来源**：`docs/0708/shared-services-volcengine-speech-plan.md`、当前 `pnpm-workspace.yaml`。

## NS-INFRA-02: shamefully-hoist 退场演练

**状态**：已完成（循环 69）。`.npmrc` 已移除 `shamefully-hoist=true`，保留 Prisma runtime 的 `public-hoist-pattern[]=@prisma/*`；`pnpm install --lockfile-only`、shared-services typecheck 与 `verify:volcengine-speech` 已通过。

**目标**：验证 `.npmrc` 中 `shamefully-hoist=true` 是否已经可以按计划移除，或者列出仍阻塞移除的真实缺失依赖。

**范围**：所有 `packages/*/package.json` 依赖声明、pnpm install、根构建、核心 smoke；移除演练只在独立分支或可回退修改中进行。

**不做**：不把运行时依赖错误压到 peerDependencies；不通过新增 path alias 绕过依赖声明；不改变发布包 API。

**受益**：减少 hoist 对依赖缺失的掩盖，让发布包更接近真实消费环境。

**验收**：

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm --filter @dofe/infra-shared-services verify:volcengine-speech
```

**来源**：`docs/0427/infra-optimization-plan-v2.md`、`docs/0625/infra-architecture-roadmap-2026-06-25.md`、当前 `.npmrc`。

## NS-INFRA-03: package exports 与消费端别名复验

**状态**：本地 exports smoke 已完成（循环 71-72、76、81）。新增 `pnpm verify:package-exports`，默认覆盖 `volcengine-speech` 能力拆分入口、纯 `task-result`、旧 `volcengine-tts` helper、`@dofe/infra-clients/sso` 与 `@dofe/infra-common/ts-rest`；重运行时入口做 `resolve`，轻量纯模块做 `require`。循环 76 已改为自动发现 `packages/*/package.json`，并提供 `--list-defaults` 查看默认覆盖面；当前默认覆盖 17 个 exports。

**目标**：确认当前显式 exports 和生成脚本已经覆盖消费端需要的稳定入口，消费端不再需要 `dist/*` 深链或 `@dofe/infra-*` path alias 绕路。

**范围**：`scripts/generate-exports.mjs`、各包 `exports`、`sso.dofe.ai`/`models.dofe.ai`/`agents.dofe.ai` 中 infra 导入路径；重点复验目录型导出、`clients/internal` 剥离规则、`shared-services/volcengine-speech` 子路径。

**不做**：不开放临时内部文件；不把所有源码目录都变成 public API；不在 infra 中维护消费端私有别名。

**受益**：减少消费端 webpack/tsconfig 兼容配置，降低发布后“能编译但消费端不能解析”的风险。

**验收**：

```bash
pnpm build
pnpm verify:package-exports
```

消费端复验：

```bash
pnpm install --lockfile-only
pnpm type-check
pnpm build:api
```

**来源**：`docs/0505/alias/optimization-plan.md`、`docs/0505/infra-packages-redesign.md`、`docs/0627/publish-readback-checklist.md`。

## NS-INFRA-04: 发布回读与 consumer install smoke

**状态**：本地发布前 smoke 已补齐（循环 73、77）。`docs/0627/publish-readback-checklist.md` 已改为要求先运行 `pnpm build && pnpm verify:package-exports`；`publish-single.sh`、`publish-all.sh` 已在真实 publish 前接入 `pnpm verify:package-exports`。发布后仍需 npm metadata readback 与 consumer install smoke。

**目标**：把发布后验证固定为流程，避免 npm metadata 延迟、tarball 缺失或子路径导出遗漏直接进入消费端升级。

**范围**：新增或更新的 `@dofe/infra-*` 包版本；`pnpm verify:published-package`；消费端 `pnpm_config_minimum_release_age=0 pnpm install --lockfile-only`；新增子路径的 Node smoke import。

**不做**：不使用本地 path dependency 绕过 npm 发布延迟；不把发布回读修复和产品业务改动混在同一个提交里。

**受益**：发布链路可回放，消费端升级失败时能快速区分是发布包问题、npm 传播问题还是消费端代码问题。

**验收**：

```bash
pnpm build
pnpm verify:package-exports
pnpm verify:published-package <package> <version>
pnpm_config_minimum_release_age=0 pnpm install --lockfile-only
```

**来源**：`docs/0627/publish-readback-checklist.md`。

## NS-INFRA-05: shared primitives 边界复验

**状态**：本地边界 smoke 已完成（循环 78）。新增 `pnpm verify:shared-primitives-boundary`，扫描 `runtime/workspace/docker/redis` 的产品语义词；当前命中均为 README 边界说明或历史 Docker/OpenClaw 兼容文件 allowlist。

**目标**：确认 0627 后新增的 runtime/workspace/docker/redis 能力仍是产品无关 primitives，没有把 agents/vibecoding/models 的编排语义迁入 infra。

**范围**：`packages/runtime`、`packages/workspace`、`packages/docker`、`packages/redis` 的新增 public API、README、测试命名；检查 Bot/OpenClaw/Loop/Gateway/Review/model-routing 等产品词是否只出现在兼容说明或示例中。

**不做**：不把消费者项目的业务状态机迁入 infra；不为了复用而统一不同产品的错误文案或 UX 诊断。

**受益**：保持 infra 包可被多个 Dofe 产品复用，避免共享包再次变成某个产品的隐藏实现层。

**验收**：

```bash
pnpm verify:shared-primitives-boundary
pnpm build
```

**来源**：`docs/0627/shared-primitives-boundary.md`、`docs/0625/infra-boundaries-2026-06-25.md`。

## NS-INFRA-06: SSO contracts-base 可选迁移评估

**目标**：评估 `sso.dofe.ai` 中高度相似的 `@repo/contracts/base.ts` 是否应迁移到 `@dofe/infra-contracts-base`，减少三方 contracts 基础模型漂移。

**范围**：仅评估和小步迁移 base schema、分页/响应包裹、版本元信息；覆盖 agents/models/sso 的类型检查。

**不做**：不迁移各项目自动生成的 constants；不统一项目特有 validators/types；不在本步骤改 OIDC/AuthGuard 领域逻辑。

**受益**：进一步降低 contracts 基础模型重复维护成本，同时保留项目私有 contract 扩展。

**验收**：

```bash
pnpm type-check
pnpm build:api
```

**来源**：`docs/0508.md`。
