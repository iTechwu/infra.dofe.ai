# Volcengine Speech Next Execution Plan

## Context

Source README: `packages/shared-services/src/volcengine-speech/README.md`.

Current unified client already exposes these capability groups:
`audioGeneration`, `ttsStreaming`, `asr`, `voice`, `realtime`,
`interpretation`, `podcast`, `memo`, `protocol`, and `errors`.

The next work should optimize around the README contract: new integrations use
`volcengine-speech`; legacy `volcengine-tts`, `openspeech`, and `streaming-asr`
stay compatible and migrate only through gradual delegation with compatibility
tests.

## Step 1: Lock README Contract Against Public Types

**状态**：已完成。Loop 1 到 Loop 7 已同步 README、public exports、client smoke 和
package export smoke。

**目标**：确保 README 中声明的 capability groups、examples、request options
和实际 TypeScript public API 完全一致。

**范围**：检查 `volcengine-speech/index.ts` exports、`types.ts`、
`volcengine-speech.client.ts`、`volcengine-speech.factory.ts`、
`volcengine-speech.module.ts`，补齐缺失导出、构造注入、示例中涉及的类型和方法。

**不做**：不改变 README 已承诺的调用方式；不重命名现有 public 方法；不移除 legacy
入口。

**受益**：消费方可以直接按 README 使用，减少“文档能跑、代码不能导入”的集成风险。

## Step 2: Harden Request Options And Reserved Headers

**状态**：已完成。Loop 1 已同步 README 与 auth 注释；Loop 2 已补 client 级 mock
覆盖；Loop 7 已修复 export smoke 的懒加载边界。

**目标**：把 README 中“认证头、request id、resource id 由 client 管理”的规则固化成测试保护。

**范围**：覆盖 `requestId`、`resourceId`、`sequence`、`timeoutMs` 和 custom
headers 校验；确认 `X-Api-Key`、`X-Api-App-Key`、`X-Api-Access-Key`、
`X-Api-Request-Id`、`X-Api-Resource-Id`、`X-Api-Sequence` 不能被 custom
headers 覆盖。

**不做**：不开放任意覆盖认证头的 escape hatch；不在 validation 层做真实凭证有效性校验。

**受益**：避免租户侧误传 header 造成鉴权串扰、request id 丢失或 ASR sequence 被污染。

## Step 3: Complete Recording File ASR HTTP Compatibility

**状态**：已完成。Loop 2 已补 ASR client fake transport 覆盖；Loop 3 已收敛
task result 归一化。

**目标**：让 README 中的 `client.asr.submitTask` 和 `client.asr.queryTask`
成为标准版、极速版、闲时版录音文件识别 HTTP 的稳定兼容入口。

**范围**：对照三份官方 HTTP 文档复核 submit/query endpoint、resource id、
`X-Api-Sequence`、`X-Tt-Logid`、header status code、请求体字段和响应归一化；
补充 mock transport tests 覆盖三种 mode 的 submit/query happy path 和失败路径。

**不做**：不在默认 CI 中调用真实火山 API；不把三种 ASR mode 合并成无法区分的单一配置；
不假设所有租户 endpoint 永远相同。

**受益**：ASR 三个商品形态能共享统一调用体验，同时保留 endpoint/resource 的差异化配置能力。

## Step 4: Expand WebSocket Capability Matrix

**状态**：已完成。Loop 4 已为 realtime 和 podcast 增加本地 WebSocket session smoke；
Loop 24 已补 TTS WebSocket 和 interpretation entry；Loop 26 已补产品级客户端
post-connect sendJson/sendAudio、onOpen/onClose 与关闭后 `isOpen()` 保护。

**目标**：把 README 中的 TTS WebSocket、realtime、podcast 与协议层能力建立可验证矩阵。

**范围**：复核 `VolcengineWebSocketCodec` 和 `VolcengineWebSocketSession`
对 gzip、JSON、audio-only、sequence、last packet、error frame、closed-session
状态的支持；为 TTS WebSocket、realtime、podcast、interpretation 增加最小 mock
WebSocket session smoke，并覆盖连接后发送 JSON/音频帧与关闭回调。

**不做**：不把各业务协议的事件字段强行抽象成同一个结构；不引入跨请求 WebSocket 连接池；
不改变 callback 语义。

**受益**：协议层稳定后，端到端实时语音、播客 v3、同声传译类 WebSocket 能减少重复解析代码。

## Step 5: Normalize Task-Style Result Shapes

**状态**：已完成。Loop 3 已抽出共享 `task-result` helper，并保留 memo 旧导出兼容。

**目标**：统一 ASR、memo、未来音频任务型接口的 task result 语义。

**范围**：梳理 `VolcengineSpeechTaskResult` 的 `taskId`、`status`、
`statusCode`、`statusMessage`、`result`、`error`、`requestId`、`logId` 字段；
提取通用 helper 处理 header-status task 与 body-status task 的成功/失败归一化。

**不做**：不抹平供应商原始响应；不删除 `raw`；不强制所有 task API 都具备相同 status
枚举。

**受益**：上层服务可以用一致字段记录任务、轮询状态和排查火山 log id，同时仍能访问原始响应。

## Step 6: Delegate Legacy Entrypoints Incrementally

**状态**：已完成本轮边界收口。Loop 7 已新增 `delegation-matrix.md`；实际 legacy
代码迁移继续遵守兼容测试优先，不做 breaking rewrite。

**目标**：按 README migration rule，让 `volcengine-tts`、`openspeech`、
`streaming-asr` 逐步复用统一底座，而不破坏旧调用方。

**范围**：优先复用 config validation、headers、retry、error normalization、
WebSocket codec；每迁移一个边界都补无密钥 compatibility smoke，确保旧返回结构不变。

**不做**：不一次性替换 legacy public API；不改变旧默认 retry 策略；不删除旧模块 package
exports。

**受益**：减少重复协议实现，降低新版火山文档变更时多处补丁不一致的风险。

## Step 7: Add Real-API Checklist With Credentials Gate

**状态**：已完成。Loop 6 已新增 `real-api-checklist.md`，默认验证仍保持无密钥。

**目标**：建立真实火山 API 联调清单，但让默认本地和 CI 仍然无密钥可跑。

**范围**：新增 opt-in 脚本或文档 checklist，覆盖 audio generation、HTTP streaming
TTS、TTS WebSocket、ASR 三模式、realtime、podcast、memo、voice；记录
`X-Api-Request-Id`、`X-Tt-Logid`、resource id、失败码和官方文档 URL。

**不做**：不把真实密钥写入仓库；不让默认 `verify:volcengine-speech` 依赖外网供应商成功率；
不把联调失败简单归类为代码失败。

**受益**：需要上线前复测时有明确路径，平时 CI 仍保持稳定、快速、无凭证。

## Step 8: Update README And Package Verification Together

**状态**：已完成。Loop 5 已补 package export smoke；Loop 6 已补真实 API checklist。

**目标**：每次能力补齐后同步更新 README、exports 和 smoke，避免文档再次漂移。

**范围**：维护 `packages/shared-services/src/volcengine-speech/README.md`、
`packages/shared-services/package.json` exports、`scripts/verify-volcengine-speech.mjs`
和必要的 package export smoke。

**不做**：不把 README 写成完整官方文档镜像；不在 README 中暴露内部 helper 的不稳定细节。

**受益**：README 成为稳定契约入口，验证脚本成为契约护栏，发布包不会漏导出新能力。

## Checkpoints

### Checkpoint A: Contract And ASR

- 状态：已完成。
- Step 1 到 Step 3 完成。
- `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 已通过。

### Checkpoint B: WebSocket And Task Normalization

- 状态：已完成。
- Step 4 到 Step 5 完成。
- WebSocket codec/session mock smoke 覆盖 TTS WebSocket、realtime、podcast、
  interpretation、错误帧、连接后发送和关闭回调最小路径。
- ASR 与 memo task result 字段语义有测试保护。

### Checkpoint C: Migration And Release Readiness

- 状态：已完成本轮无密钥收口。
- Step 6 到 Step 8 完成。
- legacy delegation 边界已记录在 `delegation-matrix.md`。
- README、exports、verify 脚本同步更新。
- 真实 API checklist 可由有效凭证显式触发。

## Follow-Up Step 9: Dedicated Simultaneous Interpretation Client

**状态**：已完成无密钥实现。Loop 20 到 Loop 23 已新增 dedicated client、校验、
local WebSocket smoke、exports 和文档；真实供应商联调仍按 `real-api-checklist.md`
显式执行。

**目标**：基于同声传译 2.0 官方文档，为统一 `volcengine-speech` 增加独立 capability
group，避免调用方直接拼产品级 WebSocket payload。

**范围**：新增 endpoint 配置、client 入口、类型定义、请求校验、本地 WebSocket smoke
和 README 示例；覆盖 init、translation event、audio/text payload、error frame 和 close
semantics。

**不做**：不复用 realtime/podcast 的业务事件类型；不在无凭证 smoke 中调用真实供应商；
不破坏现有 realtime/podcast/tts WebSocket 行为。

**受益**：同声传译从“协议可复用”推进到“产品能力可直接调用”，能力声明与代码表面一致。

### Checkpoint D: Interpretation Client

- 状态：已完成无密钥收口。
- Dedicated `client.interpretation.connect` 入口已提供。
- Local WebSocket session smoke 覆盖 init/event/request options。
- Package README、real API checklist 和 delegation matrix 已同步。

## Follow-Up Step 10: WebSocket And Header Resilience Hardening

**状态**：已完成无密钥实现。Loop 32 到 Loop 36 已补 header value trim、主动 close
code/reason、连接失败 session cleanup、对应 smoke 和 README 说明；真实供应商异常帧仍按
`real-api-checklist.md` 执行凭证门控验证。

**目标**：收紧 shared header reader 与 WebSocket session 在异常/关闭边界上的语义，避免
空白 trace header、连接失败残留 session 或无法记录 client-side close reason。

**范围**：`readVolcengineHeader` 对普通值和数组值做 trim；`VolcengineWebSocketSession`
在 connect failure 时清理内部连接引用；`close()` 支持可选 code/reason；无密钥 smoke
覆盖 header trim、client-initiated close callback 和 connect failure cleanup。

**不做**：不改变 WebSocket callback 名称；不引入自动重连；不把真实供应商断连行为纳入默认
CI；不删除已有 `close()` 无参数调用方式。

**受益**：调用方在失败、关闭和追踪字段异常时得到更稳定的本地语义，后续真实 API 联调时更容易
定位供应商断连与本地调用错误。

### Checkpoint E: Resilience Hardening

- 状态：已完成无密钥收口。
- Header reader trim 与空白过滤有 smoke 覆盖。
- WebSocket client 主动 close code/reason 和 `onClose` 有 smoke 覆盖。
- WebSocket connect failure 会触发 `onError` 并保持 session unusable。

## Follow-Up Step 11: WebSocket Codec Negative-Path Hardening

**状态**：已完成无密钥实现。Loop 38 到 Loop 41 已补 codec header guard、gzip error
frame support、malformed frame smoke、README 和计划说明；真实供应商未知扩展帧仍按
`real-api-checklist.md` 记录并决定是否扩大协议支持。

**目标**：让共享 WebSocket codec 在供应商异常帧、代理损坏帧或未来协议扩展帧下给出稳定、
可诊断的本地错误，而不是依赖 Buffer 越界、JSON parse 或 gzip 底层异常。

**范围**：校验 frame version、header size、serialization、compression；error frame 解析尊重
header size；支持 gzip-compressed error payload；无密钥 smoke 覆盖 gzip error frame 和
unsupported version/header/serialization/compression。

**不做**：不支持未知协议版本；不把未知 serialization/compression 静默透传；不在默认验证中
调用真实供应商；不改变已支持的 JSON/audio frame 编码格式。

**受益**：realtime、podcast、TTS WebSocket、同声传译和 legacy openspeech 复用同一 codec
时，协议异常会以稳定错误进入 `onError` 或本地验证，减少线上排查的不确定性。

### Checkpoint F: Codec Negative Paths

- 状态：已完成无密钥收口。
- Gzip-compressed error frame 有 decode smoke 覆盖。
- Unsupported version/header size/serialization/compression 均有明确错误。
- README 的本地验证范围已包含 malformed frame rejection。
