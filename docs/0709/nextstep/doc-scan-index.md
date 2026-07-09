# Document Scan Index

日期：2026-07-09

| 源文档 | 当前判断 | 提炼出的待优化内容 |
| --- | --- | --- |
| `docs/0427/infra-optimization-plan.md` | 历史基线，多数项已由 0625 路线图闭环 | 仅保留依赖声明、构建契约、循环依赖治理作为复验背景 |
| `docs/0427/infra-optimization-plan-v2.md` | 历史 P0/P1/P2 大多已完成；当前配置复核显示 `pnpm-workspace.yaml` 已移除 `apps/*`，包 `main/types` 基本归到 `dist` | `shamefully-hoist=true` 已在循环 69 移除，仍保留 Prisma runtime 的 `public-hoist-pattern[]=@prisma/*` |
| `docs/0505/alias/optimization-plan.md` | exports 与 peer dependency 问题已在后续治理中大幅收口；本地 `pnpm verify:package-exports` 已覆盖代表入口 | 仍需用消费端 build/type-check 复验“不再需要 alias 绕路” |
| `docs/0505/infra-packages-redesign.md` | `openspeech`、`volcengine-tts`、`transcode` 迁入 shared-services 的方向已落地 | 继续复验 clients 不反向依赖 shared-services；旧模块委托必须保持 public API 兼容 |
| `docs/0508.md` | Phase 7-9 已完成；agents/models 集成已标记 PASS | sso.dofe.ai 的 contracts-base 迁移是可选后续，不阻塞当前 |
| `docs/0625/infra-architecture-review-2026-06-25.md` | 标记全部 P0/P1/P2 完成 | 保留边界治理和“不要继续膨胀 shared-services/common”的约束 |
| `docs/0625/infra-architecture-roadmap-2026-06-25.md` | 17 轮架构收口已完成 | 当前只需对新变化做回归扫描，尤其是 pnpm 安装策略和发布流程 |
| `docs/0625/infra-boundaries-2026-06-25.md` | 作为包边界合同继续有效 | 新增 shared-services 能力必须继续满足“聚合服务层，不承载原子客户端”的边界 |
| `docs/0627/publish-readback-checklist.md` | 发布流程待持续执行；本地 package exports smoke 已脚本化并接入发布脚本 | 每次发布继续执行 npm metadata readback 与 consumer install/build smoke |
| `docs/0627/shared-primitives-boundary.md` | 新 primitives 边界合同继续有效；本地边界扫描已脚本化 | 新增 product 语义词必须通过 `pnpm verify:shared-primitives-boundary` 复验 |
| `docs/0708/shared-services-volcengine-speech-plan.md` | 统一 client 与大量补强已推进到循环 80 | 剩余：真实联调、跨仓 consumer 复验、发布回读 |
| `docs/0708/volcengine-speech-delegation-audit.md` | 委托状态清晰，config/retry 与旧 TTS 本地 mock/smoke 保护已完成 | 剩余：真实 `HttpService`/Nest DI 集成测试或真实火山联调 |
| `docs/0708/volcengine-speech-integration-checklist.md` | 联调 checklist 可用；已有 SAUC 探针记录 | 剩余：换有效凭证重跑真实 WebSocket/API 联调 |

## 当前不建议立即做

- 不建议一次性迁移所有旧 `volcengine-tts`/`openspeech`/`streaming-asr` 调用方。
- 不建议把真实火山 API E2E 放进默认 CI。
- 不建议为了安装策略调整直接改变大量依赖版本。
- 不建议开放所有深层源码路径作为 package exports。

## 当前已复核的事实

- `pnpm-workspace.yaml` 当前只包含 `packages/*`；`allowBuilds` 占位值已在循环 1 收口，pnpm settings 已在循环 4 从根 `package.json#pnpm` 迁移到 workspace 配置。
- 当前包 `main/types` 除 `config` 这种配置包外基本指向 `dist/index.js` 与 `dist/index.d.ts`。
- 当前没有发现空目录。
- `volcengine-speech` README 已说明统一 client、request options、validation/upstream error、legacy TTS retry opt-in。
- 旧 `volcengine-tts` 已新增 `tts-stream-result` 纯模块，TOS 结果映射已有无密钥 smoke 覆盖。
- `pnpm verify:package-exports` 已覆盖当前代表性 package self-reference exports；根 `pnpm build` 已改用 `pnpm exec tsc`。
- `pnpm verify:shared-primitives-boundary` 已覆盖 runtime/workspace/docker/redis 的产品语义边界扫描；当前命中均为 README 边界说明或历史 Docker/OpenClaw 兼容 allowlist。
