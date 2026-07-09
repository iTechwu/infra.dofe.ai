# Next Step Implementation Log

日期：2026-07-09

## 循环 1：pnpm allowBuilds 收口

**实施**：将 `pnpm-workspace.yaml` 中 `allowBuilds` 的占位字符串替换为明确布尔值；保留 `@scarf/scarf: false`，其余当前验证链路需要构建脚本的依赖显式允许。

**标注文档**：`infra-next-steps.md` 的 NS-INFRA-01 从“待实施”推进为“已完成”。

**审查待实施项**：下一步继续推进无密钥 smoke 覆盖，优先减少对真实火山凭证和 Nest/TOS DI 的依赖。

**受益**：避免 pnpm workspace 配置继续保留人工占位，降低 `ignored-builds` 策略阻塞标准验证命令的概率。

**验证**：已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与 `git diff --check`。

## 循环 2：retry helper smoke 边界补强

**实施**：扩展 `scripts/verify-volcengine-speech.mjs`，新增两条无密钥断言：可重试错误在 `maxRetries` 耗尽后抛出最后错误；非重试错误即使 `maxRetries > 0` 也只执行一次。

**标注文档**：`volcengine-speech-next-steps.md` 的 NS-SPEECH-05 标注为“推进中”，并写明 retry 边界已覆盖。

**审查待实施项**：下一步继续把旧 TTS 的 NDJSON/TOS 结果映射抽成纯 helper，覆盖 TOS 成功/失败路径。

**受益**：固定统一 retry 底座的关键边界，保护旧 `volcengine-tts` 显式 retry 委托不发生隐性重试放大。

**验证**：已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与 `git diff --check`。

## 循环 3：旧 TTS TOS 结果映射纯模块化

**实施**：新增 `volcengine-tts/tts-stream-result.ts`，把旧 TTS 流归约后的结果映射、文件名生成、TOS 上传成功/失败/异常分支抽成可无密钥验证的纯边界；`processStreamResponse` 保留事件读取和日志，委托该 helper 产出 legacy `TtsResultDto`。

**标注文档**：`volcengine-speech-next-steps.md` 的 NS-SPEECH-01 标注为“部分完成”，说明已覆盖 TOS 结果映射，仍缺 mock `HttpService` 整体链路。

**审查待实施项**：下一步需要同步 README/nextstep，让后续待办聚焦 mock HTTP 整体链路和真实联调，而不是已纯化的结果映射。

**受益**：不依赖真实 TOS 或 NestJS DI 即可覆盖旧 TTS 主链路最关键的结果契约，降低后续 NDJSON+TOS 委托风险。

**验证**：已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与 `git diff --check`。

## 循环 4：pnpm 11 settings 迁移

**实施**：审查循环 1/2/3 验证输出，发现 pnpm 11 已忽略根 `package.json` 的 `pnpm.peerDependencyRules` 与 `pnpm.onlyBuiltDependencies`；已迁移到 `pnpm-workspace.yaml` 并从根 `package.json` 删除旧位置。

**标注文档**：`infra-next-steps.md` 的 NS-INFRA-01 扩展为安装治理已包含 pnpm settings 迁移；`doc-scan-index.md` 校准当前事实，不再说 `allowBuilds` 仍有占位。

**审查待实施项**：当时下一步为最终验证和待办复扫；其中本地 mock HTTP 链路与 hoist 退场已在循环 66-69 完成。

**受益**：消除 pnpm 11 的 ignored settings warning，使 peer 规则和 built dependency 规则真正被当前 pnpm 读取。

**验证**：已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与 `git diff --check`；pnpm ignored settings warning 已消失。

## 循环 5：最终复扫与文档状态校准

**实施**：复扫 `docs/0709/nextstep` 与 `docs/0708` 的待办关键词，确认本轮已完成标准 pnpm 验证恢复、pnpm settings 迁移、retry smoke 边界补强、旧 TTS TOS 结果映射纯模块化和 exports 更新。

**标注文档**：同步更新 nextstep README、scan index、0708 计划和委托审计，把标准 pnpm 验证恢复从剩余项移除，把旧 TTS 主链路剩余项收窄为 mock `HttpService` 整链路与真实联调。

**审查待实施项**：当时剩余待办为 hoist 退场演练、旧 TTS mock HTTP 链路、真实火山 API 联调；前两项已在循环 66-69 完成，真实联调需要有效凭证和配额，不纳入默认 CI。

**受益**：文档状态与代码状态一致，后续循环不会重复处理已经闭环的 pnpm/纯模块保护事项。

**验证**：已通过 `pnpm --filter @dofe/infra-shared-services typecheck`、`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与 `git diff --check`。

## 循环 66：旧 TTS HTTP stream 处理纯模块化

**实施**：新增 `volcengine-tts/tts-stream-processor.ts`，把旧 TTS response stream 的行缓冲、NDJSON 解析、reducer 更新和最终结果映射从私有 `processStreamResponse` 抽出；`VolcengineTtsClient` 只保留日志与依赖注入回调。

**标注文档**：`volcengine-speech-next-steps.md` 的 NS-SPEECH-01/05 标注为 stream 处理已覆盖，剩余 mock HTTP 请求阶段。

**审查待实施项**：下一轮继续抽 HTTP request runner，让 `HttpService.post`、logId 捕获、retry 与 stream processor 能一起 mock。

**受益**：用无密钥 Node `Readable` 即可覆盖分片 NDJSON、尾部缓冲、上游错误和 TOS 结果映射，旧 TTS 主链路测试保护进一步靠近真实 HTTP stream。

**验证**：已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与 `git diff --check`。

## 循环 68：旧 TTS HTTP request runner 失败路径

**实施**：扩展 `verify-volcengine-speech`，覆盖 `executeTtsHttpRequest` 的非重试 401 只调用一次，以及 503 在 `maxRetries=2` 时调用三次后抛出。

**标注文档**：`volcengine-speech-next-steps.md` 标注 NS-SPEECH-01 的 HTTP 请求阶段主要 retry/非 retry 行为已覆盖。

**审查待实施项**：下一步执行 hoist 退场演练，确认当前依赖声明是否还需要 hoist 兜底。

**受益**：旧 TTS 的 HTTP 请求阶段已经具备无密钥成功、非重试失败、可重试耗尽三类保护。

**验证**：已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与 `git diff --check`。

## 循环 67：旧 TTS HTTP request runner 成功路径

**实施**：新增 `volcengine-tts/tts-http-request.ts`，把旧 TTS 的 HTTP post、retry、`X-Tt-Logid` 捕获和 stream resolver 串联成可 mock 的 helper；`VolcengineTtsClient.executeTtsRequest` 委托该 helper。

**标注文档**：`volcengine-speech-next-steps.md` 标注 mock HTTP 成功路径已覆盖，剩余非重试/重试失败路径。

**审查待实施项**：下一轮补非重试 4xx 与 5xx retry 的 mock 断言，确认 retry 次数和错误传播。

**受益**：无需实例化 Nest `HttpService` 即可验证旧 TTS 请求阶段的 URL、headers、timeout、logId 与 stream resolver 串联。

**验证**：已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与 `git diff --check`。

## 循环 69：shamefully-hoist 退场演练

**实施**：移除 `.npmrc` 中已标注 deprecated 的 `shamefully-hoist=true`，保留 Prisma 所需的 `public-hoist-pattern[]=@prisma/*`、`auto-install-peers=true` 与 `strict-peer-dependencies=false`。

**标注文档**：`infra-next-steps.md` 的 NS-INFRA-02 标注为完成；`doc-scan-index.md` 从当前事实中移除 shamefully-hoist 残留。

**审查待实施项**：下一轮最终复扫 exports、文档状态和验证命令，确认没有新的安装 warning 或依赖缺失。

**受益**：去掉会掩盖依赖声明问题的 blunt hoist 兜底，让本地安装更接近真实消费端环境。

**验证**：已通过 `pnpm install --lockfile-only`、`pnpm --filter @dofe/infra-shared-services typecheck` 与 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech`。

## 循环 70：exports smoke 与最终状态校准

**实施**：扩展 `verify-volcengine-speech`，通过 package subpath require 验证新增 `volcengine-tts/tts-http-request`、`tts-stream-processor`、`tts-stream-result` 均已进入 `@dofe/infra-shared-services` exports。

**标注文档**：同步 nextstep、0708 plan 和 delegation audit，把旧 TTS mock HTTP 保护标记为本地 smoke 基本完成；剩余项收窄到真实火山联调、跨仓 consumer 复验和发布回读。

**审查待实施项**：后续如继续推进，需要有效火山凭证或进入 consumer 仓库执行安装/build 验证。

**受益**：新增测试 helper 不只是 dist 直连可用，也能通过正式 package exports 被消费端解析。

**验证**：已通过 `pnpm --filter @dofe/infra-shared-services typecheck`、`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech`、`pnpm build` 与 `git diff --check`。

## 循环 71：package exports smoke 脚本化

**实施**：新增 `scripts/verify-package-exports.mjs`，使用 package-local `createRequire(package.json)` 验证 workspace package 的 self-reference exports；根 `package.json` 新增 `pnpm verify:package-exports`。

**标注文档**：`infra-next-steps.md` 的 NS-INFRA-03 标注本地 exports smoke 已开始脚本化。

**审查待实施项**：首次 require 顶层 `volcengine-speech` 暴露出运行时入口会加载 `@dofe/infra-common`/Prisma；下一轮需要区分“可解析”与“可无副作用加载”。

**受益**：把散落的 `node -e require(...)` 升级成可复用命令，后续新增子路径可用同一脚本复验。

**验证**：首次 `pnpm verify:package-exports` 按预期暴露顶层重入口加载 Prisma client 的限制，已在循环 72 调整。

## 循环 72：exports smoke 分层与能力入口覆盖

**实施**：扩展 `verify-package-exports` 支持 `:resolve` 与默认 `require` 两种模式；默认列表覆盖 `volcengine-speech` 的 `asr/audio-generation/tts-streaming/voice/realtime/podcast/memo/protocol/errors`、旧 `volcengine-tts` helper、`@dofe/infra-clients/sso` 与 `@dofe/infra-common/ts-rest`。

**标注文档**：`infra-next-steps.md` 的 NS-INFRA-03 标注本地 package self-reference exports smoke 已完成，重运行时入口做 resolve，轻量纯模块做 require。

**审查待实施项**：本地脚本已覆盖发布前 exports 解析；仍需在消费端仓库执行 install/type-check/build，确认 alias 退场不会被消费端 bundler 或 tsconfig 差异影响。

**受益**：既能发现 exports 缺失，也避免无真实 Prisma client 的本地环境误判 runtime-heavy Nest 入口。

**验证**：已通过 `pnpm verify:package-exports`，共验证 16 个 package exports。

## 循环 73：发布回读 checklist 接入 exports smoke

**实施**：更新 `docs/0627/publish-readback-checklist.md`，发布前要求执行 `pnpm build` 与 `pnpm verify:package-exports`；新增未覆盖子路径的显式脚本调用示例。

**标注文档**：`infra-next-steps.md` 的 NS-INFRA-04 标注本地发布前 smoke 已补齐，发布后仍需 npm metadata readback 与 consumer install smoke。

**审查待实施项**：后续发布版本时仍需运行 `pnpm verify:published-package <package> <version>`，并在实际消费端仓库使用 npm 包重装后构建。

**受益**：发布流程从“记得手写 require”变成固定命令，减少新增子路径遗漏进入消费端的概率。

**验证**：文档更新后由循环 75 统一执行 `git diff --check`。

## 循环 74：根构建 warning 来源处理

**实施**：将 `scripts/build-all.sh` 的 TypeScript 编译命令从 `npx tsc` 改为 `pnpm exec tsc`，保持 pnpm workspace 下的工具解析与安装策略一致。

**标注文档**：`README.md` 与 `doc-scan-index.md` 标注根构建已使用 `pnpm exec tsc`，不再触发 npm 对 pnpm `.npmrc` 配置项的 warning。

**审查待实施项**：本地构建 warning 已消除；后续 CI 若仍直接调用 npm/npx，需要按同一原则迁移到 pnpm 命令。

**受益**：构建输出更干净，减少把 npm warning 误判成 pnpm 安装策略问题的噪音。

**验证**：已通过 `pnpm build && pnpm verify:package-exports`，构建输出未再出现 npm `.npmrc` warning。

## 循环 75：最终复扫与文档校准

**实施**：复扫 `docs/0709/nextstep`、发布 checklist、0708 计划表与新增脚本，将本轮状态校准为：本地 package exports smoke 和构建 warning 清理已完成；跨仓 consumer 复验、发布后 readback、真实火山联调仍需对应外部环境。

**标注文档**：同步 `README.md`、`doc-scan-index.md`、`infra-next-steps.md` 与 `docs/0708/shared-services-volcengine-speech-plan.md` 的循环 71-75 记录。

**审查待实施项**：剩余项不再是 infra 本地脚本缺口，而是需要有效火山凭证、npm 发布版本或进入消费端仓库才能继续验证。

**受益**：文档仪表盘与当前代码事实一致，后续循环不会重复实现已闭环的本地 exports smoke 或根构建 warning 清理。

**验证**：已通过 `pnpm install --lockfile-only`、`pnpm --filter @dofe/infra-shared-services typecheck`、`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech`、`pnpm build`、`pnpm verify:package-exports`、`git diff --check` 与待办关键词复扫；复扫剩余命中均为历史标题或本轮已完成记录。

## 循环 76：exports smoke workspace 自动发现

**实施**：`scripts/verify-package-exports.mjs` 从硬编码 package 目录改为扫描 `packages/*/package.json`，并新增 `--list-defaults` 输出默认 smoke 覆盖面。

**标注文档**：`infra-next-steps.md` 的 NS-INFRA-03 标注 package exports smoke 已支持 workspace 自动发现和默认清单查看。

**审查待实施项**：exports 默认覆盖仍是代表性入口；新增高风险子路径时仍应显式传入脚本参数或补入默认列表。

**受益**：后续新增 workspace package 不需要先改脚本目录列表，降低发布前 smoke 漏包概率。

**验证**：已通过 `pnpm verify:package-exports` 与 `node scripts/verify-package-exports.mjs --list-defaults`。

## 循环 77：发布脚本接入 exports smoke

**实施**：`scripts/publish-single.sh` 在包构建后、commit/tag/publish 前运行 `pnpm verify:package-exports`；`scripts/publish-all.sh` 在全量 build 后运行同一 smoke，`--publish-only` 重试路径也会先执行 smoke。

**标注文档**：`infra-next-steps.md` 的 NS-INFRA-04 与 `docs/0627/publish-readback-checklist.md` 标注发布脚本已接入本地 package exports smoke。

**审查待实施项**：真实发布后仍需执行 npm metadata readback 和消费端 install/build；脚本不会替代 npm 传播检查。

**受益**：发布流程不再只依赖人工记忆 checklist，子路径 exports 缺失会在真实 publish 前失败。

**验证**：已通过 `bash -n scripts/publish-single.sh`、`bash -n scripts/publish-all.sh` 与 `bash scripts/publish-single.sh shared-services --dry-run --no-commit`；`publish-all --dry-run` 因当前工作树非 clean 被既有发布 guard 拦截，符合发布策略。

## 循环 78：shared primitives 边界扫描脚本化

**实施**：新增 `scripts/check-shared-primitives-boundary.mjs` 与根命令 `pnpm verify:shared-primitives-boundary`，扫描 `runtime/workspace/docker/redis` 的 `Bot/OpenClaw/Loop/Gateway/Review/model-routing` 命中；当前历史 Docker/OpenClaw 兼容文件和 README 边界说明被显式 allowlist。

**标注文档**：`infra-next-steps.md` 的 NS-INFRA-05 标注本地边界 smoke 已完成，`doc-scan-index.md` 记录当前 allowlist 事实。

**审查待实施项**：如果未来新增 product 语义词命中非 allowlist 文件，应优先迁回消费端或补充边界 ADR，而不是扩大 allowlist。

**受益**：shared primitives 边界从人工 `rg` 检查变成可 CI 化的稳定命令，减少 runtime/workspace/docker/redis 再次吸收产品编排语义的风险。

**验证**：已通过 `pnpm verify:shared-primitives-boundary`；当前 75 个命中均为已知兼容层或边界说明。

## 循环 79：0708 循环编号去噪

**实施**：修正 `docs/0708/shared-services-volcengine-speech-plan.md` 中重复的循环 51 记录，将第二条标为 `52a` 并说明仅修正文档编号，不改历史实现证据。

**标注文档**：`volcengine-speech-next-steps.md` 的 NS-SPEECH-06 所列“循环 51 重复编号”已处理，并在 0708 计划表原位留下注释。

**审查待实施项**：0708 长表仍保留历史“下一轮/后续”语句作为审计轨迹；后续扫描应以 nextstep 状态段为当前事实。

**受益**：避免后续自动或人工扫描把重复编号误判成缺失循环，同时不丢失当时验证记录。

**验证**：文档变更由循环 80 的最终 `git diff --check` 和关键词复扫统一验证。

## 循环 80：最终复扫与状态校准

**实施**：复扫 `docs/0709/nextstep`、发布 checklist、0708 计划表与新增脚本，将本轮状态校准为：exports smoke 自动发现、发布脚本接入、shared primitives 边界扫描和循环编号去噪已完成。

**标注文档**：同步 `README.md`、`doc-scan-index.md`、`infra-next-steps.md`、`docs/0627/publish-readback-checklist.md` 与 `docs/0708/shared-services-volcengine-speech-plan.md`。

**审查待实施项**：剩余项继续收窄为真实火山 API 联调、跨仓 consumer install/build、发布后 npm metadata readback、SSO contracts-base 可选跨仓评估。

**受益**：本地可执行的后续事项继续转为稳定命令，文档仪表盘能区分“本地已闭环”和“需要外部环境”的事项。

**验证**：首次完整验证暴露 shared-services `ignoreDeprecations` 仍为 `5.0`，已在循环 81 修复；最终完整验证见循环 81。

## 循环 81：TypeScript 6 与 ASR smoke 分层修正

**实施**：将 `packages/shared-services/tsconfig.json` 的 `ignoreDeprecations` 从 `5.0` 调整为 `6.0`，与仓库其他 package 和 `tsconfig.build-all.json` 保持一致；同时从 `verify-volcengine-speech` 移除 runtime-heavy 的 ASR client 直接导入，保留纯 `task-result` 归一化断言，并把 `@dofe/infra-shared-services/volcengine-speech/task-result` 加入 `verify-package-exports` 的 `require` 覆盖。

**标注文档**：本日志补充记录循环 81；0708 计划表同步追加该修正，避免把验证中发现的 TypeScript 6/Prisma client smoke 问题留成隐性状态。

**审查待实施项**：ASR client 真实运行时路径仍需要 Nest/Prisma/真实火山或更完整 DI mock 环境；默认无密钥 smoke 只覆盖纯 task-result 和 ASR subpath resolve。

**受益**：恢复标准 `pnpm --filter @dofe/infra-shared-services typecheck`，并让无密钥 smoke 避免误加载 Prisma client，同时仍保护 ASR 相关纯结果契约和 package exports。

**验证**：已通过 `pnpm --filter @dofe/infra-shared-services typecheck`、`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech`、`pnpm build`、`pnpm verify:package-exports`、`node scripts/verify-package-exports.mjs --list-defaults`、`pnpm verify:shared-primitives-boundary`、`bash -n scripts/publish-single.sh`、`bash -n scripts/publish-all.sh`、`git diff --check` 与待办关键词复扫；`verify-package-exports` 当前覆盖 17 个默认 exports，`shared-services` 当前生成 129 个 exports。
