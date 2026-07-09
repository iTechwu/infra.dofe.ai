# 0709 Next Step Overview

日期：2026-07-09

## 扫描范围

本目录基于 `docs/` 下全部 13 份 Markdown 文档与当前仓库关键配置复核整理：

- `docs/0427/*`
- `docs/0505/*`
- `docs/0508.md`
- `docs/0625/*`
- `docs/0627/*`
- `docs/0708/*`
- 当前 `.npmrc`、`pnpm-workspace.yaml`、各包 `package.json`、`packages/shared-services/src/volcengine-speech/README.md`

结论：早期 P0/P1/P2 架构项大多已在 2026-06-25 的路线图中闭环。当前真正需要继续优化的内容集中在三类：

1. `volcengine-speech` 与旧 `volcengine-tts` 的测试保护、真实联调和渐进委托。
2. pnpm 安装/构建治理与发布回读。
3. 跨仓消费端复验，包括 exports、别名移除、SSO contracts-base 可选迁移。

## 本轮实施状态

- 已完成：`allowBuilds` 占位清理、pnpm settings 迁移、标准 pnpm wrapper 验证恢复、`shamefully-hoist=true` 移除。
- 已完成：统一 retry helper 的耗尽重试/非重试错误 smoke 补强。
- 已完成：旧 `volcengine-tts` 的 TOS/NDJSON/HTTP mock 链路本地 smoke，覆盖上游错误、空音频、上传成功/失败/异常、401 非重试、503 retry 耗尽和新增 exports。
- 已完成：新增 `pnpm verify:package-exports`，覆盖 package self-reference exports smoke；发布脚本已接入该 smoke；根构建改用 `pnpm exec tsc`，避免 npm 读取 pnpm `.npmrc` 的无关 warning。
- 已完成：新增 `pnpm verify:shared-primitives-boundary`，把 runtime/workspace/docker/redis 的产品语义边界复验脚本化。
- 仍需继续：真实火山 API 联调、跨仓 consumer install/build 复验、发布后 npm metadata readback。

## 优先级

### P0

- 真实火山 API 联调使用有效 SAUC/豆包语音凭证重跑 checklist。

### P1

- 复验 package exports 与消费端别名移除，确保不再需要 `dist/*` 或消费端 path alias 绕路。
- 发布后执行 npm metadata readback 与 consumer install smoke。

### P2

- 复核 SSO `@repo/contracts/base.ts` 到 `@dofe/infra-contracts-base` 的可选迁移。
- 继续收窄剩余 `any`/外部 SDK 响应边界，但不作为当前阻塞项。
- 对历史文档中已完成事项做归档标注，减少重复扫描噪音。

## 文档索引

- [infra-next-steps.md](./infra-next-steps.md)：仓库级待优化项。
- [volcengine-speech-next-steps.md](./volcengine-speech-next-steps.md)：Volcengine speech/shared-services 专项待优化项。
- [doc-scan-index.md](./doc-scan-index.md)：源文档到待办项的映射。
- [implementation-log.md](./implementation-log.md)：本轮 5 次循环实施记录。

## 建议执行顺序

1. 先做 P0：真实联调凭证复测。
2. 再做 P1：跨仓 consumer 复验、发布回读。
3. 最后做 P2：跨仓低风险迁移和文档归档。
