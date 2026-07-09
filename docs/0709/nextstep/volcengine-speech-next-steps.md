# Volcengine Speech Next Steps

日期：2026-07-09

## NS-SPEECH-01: 旧 TTS mock HttpService + mock TOS 兼容测试

**状态**：本地 smoke 已完成（循环 3、5、66、67、68、70-72）。已抽出 `tts-stream-result`、`tts-stream-processor` 与 `tts-http-request` 纯/可 mock 模块，并用无密钥 smoke 覆盖上游错误、空音频、分片 NDJSON、尾部缓冲、TOS 上传成功/失败/异常、HTTP 请求成功路径、timeout 透传、logId 捕获、非重试 401、503 retry 耗尽和正式 package exports；循环 71-72 已沉淀为根命令 `pnpm verify:package-exports`。剩余仅为真实 `HttpService`/Nest DI 集成测试或真实联调，不纳入默认 smoke。

**目标**：为 `volcengine-tts` 主链路建立无真实密钥的兼容保护，覆盖 HTTP 请求、显式 retry、NDJSON 解析和 TOS 上传结果。

**范围**：旧 `packages/shared-services/src/volcengine-tts`；mock `HttpService` 返回 NDJSON chunk；mock TOS 上传成功/失败；覆盖 `maxRetries` 显式开启、非重试 4xx、5xx/超时重试、`X-Tt-Logid` 参与对象 key 的路径。

**不做**：不直接把旧 TTS 主链路替换为统一 `ttsStreaming`；不改 public 方法签名、返回结构或异常语义；不依赖真实火山密钥。

**受益**：后续推进 NDJSON+TOS 主链路委托时有回归网，避免把“底层复用”变成线上行为重写。

**验收**：

```bash
pnpm --filter @dofe/infra-shared-services verify:volcengine-speech
pnpm --filter @dofe/infra-shared-services typecheck
git diff --check
```

**来源**：`docs/0708/volcengine-speech-delegation-audit.md`、`docs/0708/shared-services-volcengine-speech-plan.md`。

## NS-SPEECH-02: NDJSON+TOS 主链路委托评估

**目标**：在 NS-SPEECH-01 通过后，重新评估 `volcengine-tts` 的 NDJSON 解析、TOS 上传、错误传播能否继续复用 `volcengine-speech` 的 protocol/errors/retry/config 底座。

**范围**：`tts-stream-reducer.ts`、`tts-payload.ts`、`readVolcengineHeader`、`executeVolcengineRetry`、`normalizeVolcengineHttpError` 与旧 TTS client 的组合方式；输出一个“可委托/仍保留/需要新抽象”的清单。

**不做**：不把统一 `ttsStreaming.synthesizeStream` 直接作为旧 TTS 替代，因为统一入口当前返回裸流，不承担旧 TTS 的 NDJSON+TOS 语义。

**受益**：把旧模块继续收敛到统一底座，同时保留旧调用方的 TOS 落盘和返回契约。

**验收**：

```bash
pnpm --filter @dofe/infra-shared-services verify:volcengine-speech
pnpm --filter @dofe/infra-shared-services typecheck
```

**来源**：`docs/0708/volcengine-speech-delegation-audit.md`。

## NS-SPEECH-03: 真实火山 API 联调复测

**目标**：使用有效、未过期且匹配应用/资源的凭证完成真实火山语音 API checklist，确认统一 client 与官方服务端协议兼容。

**范围**：音频生成、HTTP 流式 TTS、TTS WebSocket、端到端实时语音、播客 v3、妙记、voice 资源；记录 `X-Api-Request-Id` 与 `X-Tt-Logid`；重点复测 SAUC bigmodel WebSocket 鉴权。

**不做**：不把真实密钥写入仓库；不在 CI 中跑付费/配额型 E2E；不把联调探针脚本提交为默认执行脚本。

**受益**：把当前无密钥 smoke 覆盖不到的服务端握手、事件格式、错误帧和 endpoint 差异补齐。

**验收**：

```bash
pnpm --filter @dofe/infra-shared-services verify:volcengine-speech
```

并在 `docs/0708/volcengine-speech-integration-checklist.md` 或后续联调记录中补充每个能力的真实调用结果、log id、失败原因和是否需要代码修正。

**来源**：`docs/0708/volcengine-speech-integration-checklist.md`。

## NS-SPEECH-04: WebSocket 服务端事件兼容矩阵

**目标**：把 TTS WebSocket、realtime、podcast v3、openspeech/SAUC 的服务端帧形态整理成兼容矩阵，明确哪些解析可共享，哪些必须留在子 client。

**范围**：统一 `VolcengineWebSocketCodec`、`VolcengineWebSocketSession`、`openspeech` 的 `parseServerResponse`、realtime/podcast callbacks；记录 payload size 限制、错误帧、gzip、sequence、业务事件字段差异。

**不做**：不为了统一而删除 openspeech 现有 size 校验、说话人分离、ASR 结果归一化；不引入跨进程连接池。

**受益**：下一步若继续委托 openspeech 的响应解析，可以知道边界在哪里，避免把业务归一化误放进 protocol 层。

**验收**：新增或更新文档中至少列出 4 类 WebSocket 协议的帧头、payload、错误、session 生命周期差异，并给出可复用结论。

**来源**：`docs/0708/volcengine-speech-delegation-audit.md`、`docs/0708/shared-services-volcengine-speech-plan.md`。

## NS-SPEECH-05: 统一 client 发布前 smoke 扩展

**状态**：推进中（循环 2、3、66、67、68、70）。已补 retry helper 的耗尽重试与非重试错误立即失败断言；旧 TTS TOS 结果路径、response stream 处理、HTTP 请求成功/失败路径和新增 subpath exports 已覆盖；后续继续补 WS happy path。

**目标**：在现有无密钥 smoke 基础上覆盖更多 public contract，减少发布后才发现子路径、配置或错误类型破裂。

**范围**：`scripts/verify-volcengine-speech.mjs`；增加 mock HTTP/WS 的最小 happy path、validation error、upstream error、legacy auth、reserved header、防空字符串、防非字符串 header、closed session `isOpen()`。

**不做**：不把真实火山 API 调用放进默认 smoke；不在 smoke 中依赖 Prisma generate，除非已经隔离成可稳定执行的前置步骤。

**受益**：统一 client 的 public API 变化能在本地和 CI 早失败，减少人工联调成本。

**验收**：

```bash
node scripts/verify-volcengine-speech.mjs
pnpm --filter @dofe/infra-shared-services verify:volcengine-speech
```

**来源**：`docs/0708/shared-services-volcengine-speech-plan.md`、`packages/shared-services/src/volcengine-speech/README.md`。

## NS-SPEECH-06: 文档状态去噪与循环编号修正

**状态**：部分完成（循环 79）。重复循环 51 已修正为 `52a`，并保留历史实现与验证证据；历史“下一轮/后续”语句仍作为审计轨迹保留，当前事实以本目录 nextstep 状态段为准。

**目标**：清理 `shared-services-volcengine-speech-plan.md` 中循环记录的重复编号和历史“下一轮”噪音，让当前待办只指向真实剩余工作。

**范围**：循环 51 重复编号、已经完成但仍含“后续需真实联调保护”的旧描述、验证命令从 pnpm wrapper 到直接命令的临时状态说明。

**不做**：不改动已完成实现；不删除历史审计证据；不重写整份长计划。

**受益**：后续扫描时不会把已闭环事项误判为待实施项，文档能继续作为执行仪表盘使用。

**验收**：

```bash
rg -n "下一轮|后续|待补|暂不委托|循环 51" docs/0708
git diff --check
```

命中项应只剩真实待办或历史记录中已解释的状态。

**来源**：`docs/0708/shared-services-volcengine-speech-plan.md`。
