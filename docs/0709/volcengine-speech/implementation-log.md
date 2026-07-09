# Volcengine Speech Implementation Log

## Loop 1: Request Options Contract

**审查待实施项**：`next-execution-plan.md` Step 2 要求 README 的 request
options 与 client 管理 header 的规则一致。代码已支持 `resourceId` 和
`sequence`，但 README 仍只描述 `requestId`、custom headers 和 timeout；
认证 helper 注释也仍写着旧头名 `X-Api-App-Id`。

**实施**：更新 README 的 Request Options，明确 `resourceId`、`sequence`、
`X-Api-Sequence` 和校验规则；同步修正 auth helper 注释为
`X-Api-App-Key`（注：`X-Api-App-Key` 实为旧版控制台头，新版应为 `X-Api-Key`；
该误标在后续 X-Api-Key-only 迁移 loop 中彻底纠正）。

**标注文档**：Step 2 已完成文档契约修正，后续仍需补 client 级 mock 覆盖，证明
reserved headers 不能被绕过。

**验证**：待后续循环统一运行 `typecheck` 与 `verify:volcengine-speech`。

## Loop 2: ASR Client Mock Coverage

**审查待实施项**：`next-execution-plan.md` Step 3 要求 ASR 三种 HTTP mode 的
submit/query 行为有 mock transport tests。现有 smoke 只覆盖 header builder，没有证明
`VolcengineAsrClient` 自身会选择正确 endpoint、resource id、sequence 和 query
log id。

**实施**：扩展 `scripts/verify-volcengine-speech.mjs`，新增
`VolcengineAsrClient` fake transport 覆盖：fast submit、off-peak submit 自定义
resource、standard query、query 保留自定义 header、空 taskId 拒绝。

**标注文档**：Step 3 已完成 client 级无密钥覆盖的主体部分；Loop 4 前复查确认该
ASR mock 已实际落入当前 smoke 脚本。后续仍需 task result
归一化，避免 ASR/memo 结果语义分散。

**验证**：待后续循环统一运行 `typecheck` 与 `verify:volcengine-speech`。

## Loop 3: Task Result Normalization

**审查待实施项**：`next-execution-plan.md` Step 5 要求统一 ASR、memo、未来任务型接口
的 task result 语义。审查发现 memo 的 body-status 归一化在 `memo.normalizer.ts`，
ASR 的 header-status 归一化在 transport 中内联，语义分散。

**实施**：新增 `volcengine-speech/task-result.ts`，提供
`normalizeBodyTaskResult`、`normalizeHeaderStatusTaskResult` 和
`extractTaskError`；`memo.normalizer.ts` 保留旧导出但委托共享 helper；
`VolcengineSpeechTransport.postHeaderStatus` 委托 header-status helper。

**标注文档**：Step 5 已完成共享 helper 抽取和 smoke 覆盖；后续如新增音频任务型接口，
应直接复用该模块。

**验证**：待后续循环统一运行 `typecheck` 与 `verify:volcengine-speech`。

## Loop 4: Realtime And Podcast WebSocket Smoke

**审查待实施项**：`next-execution-plan.md` Step 4 要求为 realtime 和 podcast 增加
最小 mock WebSocket session smoke。现有 smoke 只验证 codec 和 closed session，
没有真实走 `connect()`、headers、init frame 和 callback。

**实施**：扩展 `scripts/verify-volcengine-speech.mjs`，使用本地
`WebSocketServer` 分别验证 `VolcengineRealtimeSpeechClient` 与
`VolcenginePodcastClient`：client 发起连接、携带 auth header、发送 gzip JSON init
frame、接收 gzip JSON server event，并触发 `onEvent`。

**标注文档**：Step 4 已完成最小 WS session smoke；后续如果接入同声传译独立 client，
应复用同一类本地 WS smoke 模式。

**验证**：待后续循环统一运行 `typecheck` 与 `verify:volcengine-speech`。

## Loop 5: Package Export Smoke

**审查待实施项**：`next-execution-plan.md` Step 8 要求 README、exports 和 smoke
同步更新。新增 `asr` 与 `task-result` 后，如果 package exports 漏生成，消费方会在发布包中
无法导入。

**实施**：扩展 `scripts/verify-volcengine-speech.mjs`，通过
`createRequire` 验证 `@dofe/infra-shared-services/volcengine-speech`、
`@dofe/infra-shared-services/volcengine-speech/asr` 与
`@dofe/infra-shared-services/volcengine-speech/task-result` 的关键导出。

**标注文档**：Step 8 的 package export 护栏已补齐；后续每新增公开子路径都应添加同类
require smoke。

**验证**：待后续循环统一运行 `typecheck` 与 `verify:volcengine-speech`。

## Loop 6: Real API Checklist

**审查待实施项**：`next-execution-plan.md` Step 7 要求建立真实火山 API 联调清单，
同时保持默认 smoke/CI 无密钥。当前目录缺少可执行 checklist，真实联调证据字段也没有统一模板。

**实施**：新增 `real-api-checklist.md`，覆盖 README 中的 audio generation、HTTP
streaming TTS、TTS WebSocket、ASR 三模式、realtime、podcast、memo、voice；
为每项列出官方文档 URL、方法入口、request id、log id、resource id、状态和结果记录字段。

**标注文档**：Step 7 已完成 checklist 文档；真实供应商调用仍需有效凭证显式执行，不进入默认
`verify:volcengine-speech`。

**验证**：待后续循环统一运行 `typecheck` 与 `verify:volcengine-speech`；真实 API
checklist 本轮仅文档化，未执行真实供应商请求。

## Loop 7: Verification Fixes And Delegation Matrix

**审查待实施项**：执行 `verify:volcengine-speech` 时发现两类阻塞：根脚本直接
`import 'ws'` 导致根依赖解析失败；导入 speech/asr export 会过早加载
`@dofe/infra-common` 并触发 Prisma runtime。另一个待实施项是 Step 6 需要明确 legacy
delegation 边界，避免误做 breaking rewrite。

**实施**：将 smoke 中的 `ws` 改为通过 shared-services package context 的
`createRequire` 加载；将 `VolcengineSpeechConfigService` 的 `@dofe/infra-common`
加载改为仅在默认 keys 解析或抛配置错误时懒加载；移除
`packages/shared-services/tsconfig.json` 中触发 TypeScript 6 弃用错误的
`baseUrl`，保留既有 `paths`；新增
`delegation-matrix.md` 记录 legacy delegation 状态和后续候选边界。

**标注文档**：Step 6 已完成边界矩阵；Step 8 的 package export smoke 已能在无 Prisma
generated client 的默认环境中运行。

**验证**：`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 已通过。

## Loop 8: ASR Mode Runtime Validation

**审查待实施项**：审查 `VolcengineAsrClient` 时发现 `VolcengineAsrMode` 仅在
TypeScript 编译期约束；运行时如果传入非法 mode，会通过 `getBaseUrl` 的 fallback
默默走 standard endpoint，容易把极速版或闲时版请求误路由。

**实施**：新增 `validateAsrMode`，`validateAsrRequest` 和 `queryTask` 均调用该校验；
smoke 覆盖非法 submit mode 与非法 query mode。

**标注文档**：Step 3 的 ASR compatibility 现在包含 mode 运行时防护，非法 mode 不再降级成
standard。

**验证**：待本轮后续统一运行 `typecheck` 与 `verify:volcengine-speech`。

## Loop 9: Header Status Task Result Hardening

**审查待实施项**：审查 `normalizeHeaderStatusTaskResult` 时发现 header status
字段直接透传，空白 `statusMessage` 会导致失败任务没有可读 `error`；带空格的
`statusCode` 也不会被归一化。

**实施**：在 `task-result.ts` 中 trim `statusCode` 与 `statusMessage`；非成功状态且没有
有效 message 时返回稳定 fallback：`Volcengine speech task failed: <code>`；smoke
覆盖空白 message 与 trim 后的错误码。

**标注文档**：Step 5 的 task result 归一化补齐 header-status 失败文案保护。

**验证**：待本轮后续统一运行 `typecheck` 与 `verify:volcengine-speech`。

## Loop 10: WebSocket Request Options Passthrough

**审查待实施项**：Loop 4 的 WebSocket smoke 已覆盖 connect/init/event，但 fake
transport 未证明 `requestOptions` 会传入 `buildHeaders` 并出现在握手头中。

**实施**：扩展 realtime/podcast 本地 WebSocket smoke：传入 `requestId`、`resourceId`
和 custom trace header；fake transport 记录 `buildHeaders` 入参；本地 server 校验握手头。

**标注文档**：Step 4 与 Step 2 现在同时覆盖 WebSocket request options 透传，不只覆盖
HTTP header builder。

**验证**：待本轮后续统一运行 `typecheck` 与 `verify:volcengine-speech`。

## Loop 11: Documentation Directory Index

**审查待实施项**：`docs/0709/volcengine-speech` 已有执行计划、日志、delegation matrix
和真实 API checklist，但缺少目录级 README，后续读者需要逐个打开文件才能理解当前状态。

**实施**：新增目录 README，说明各文档用途、默认无密钥验证命令、真实 API checklist
边界和当前实现状态。

**标注文档**：文档目录现在有入口索引；后续新增该目录下的文档时应同步更新 README。

**验证**：待本轮后续统一运行 `git diff --check`。

## Loop 12: Real API Reference Coverage

**审查待实施项**：复查用户最初提供的火山 speech 文档列表时发现
`real-api-checklist.md` 覆盖了核心能力，但没有集中记录全部音频相关补充文档 URL。

**实施**：扩展 `real-api-checklist.md`，新增 `Official Reference Set`，列出核心能力文档
和用户给出的 10 个音频相关文档入口。

**标注文档**：真实联调 checklist 现在可作为完整文档入口索引；实际字段核对仍需在有效凭证下
按能力逐项执行。

**验证**：待本轮后续统一运行 `git diff --check`。

## Loop 13: Verification Closeout

**审查待实施项**：Loop 8 到 Loop 12 完成后，需要把实际验证结果回填文档，避免日志继续保留
“待后续循环统一运行”的过期状态。

**实施**：执行并确认通过 `pnpm --filter @dofe/infra-shared-services typecheck`、
`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与
`git diff --check`。

**标注文档**：本轮 closeout 记录最终验证结果；早期 loop 的“待统一验证”以本条记录为准。

**验证**：已通过：

```bash
pnpm --filter @dofe/infra-shared-services typecheck
pnpm --filter @dofe/infra-shared-services verify:volcengine-speech
git diff --check
```

## Loop 14: Header Status Success Assertion Hardening

**审查待实施项**：Loop 9 已强化 task result 的 header-status 归一化，但
`assertVolcengineHeaderStatusSuccess` 仍直接比较原始 header 字符串。若供应商或 mock
返回带空格的 `X-Api-Status-Code:  20000000 `，transport 会误判为失败。

**实施**：在错误断言层 trim `statusCode` 与 `statusMessage`；空白 message 不再覆盖默认错误
文案；smoke 覆盖 trim 后的成功码和失败消息。

**标注文档**：Step 5 的 header-status 保护现在覆盖 transport 成功断言和 task result
归一化两层。

**验证**：待本轮后续统一运行 `typecheck` 与 `verify:volcengine-speech`。

## Loop 15: ASR Payload Reserved Keys

**审查待实施项**：审查 `VolcengineAsrClient.submitTask` 时发现 `request.options`
会与核心请求体字段合并；如果调用方传入 `options.audio` 或 `options.callback`，可能覆盖
`audioUrl` / `callbackUrl` 生成的权威字段。

**实施**：新增 ASR reserved option keys 校验，拒绝 `options.audio` 和 `options.callback`；
payload 组装改为先展开 options、再写入核心字段，形成双重保护；smoke 覆盖 reserved key
拒绝与正常 payload 顺序。

**标注文档**：Step 3 的 ASR submit 请求体现在明确保护核心字段，避免调用方通过扩展 options
绕过高级 API 的字段语义。

**验证**：待本轮后续统一运行 `typecheck` 与 `verify:volcengine-speech`。

## Loop 16: WebSocket Error Callback Smoke

**审查待实施项**：现有 smoke 覆盖 WebSocket codec 错误帧解码，也覆盖 realtime/podcast
正常事件路径，但没有验证 `VolcengineWebSocketSession` 收到错误帧后会转成
`VolcengineSpeechError` 并调用 `onError`。

**实施**：新增本地 WebSocket error callback smoke：server 收到 init frame 后发送
ERROR_RESPONSE 帧，session 应触发一次 `onError`，错误类型为 `VolcengineSpeechError`，
code/message 与帧内容一致。

**标注文档**：Step 4 的 WebSocket matrix 现在覆盖正常事件路径和错误帧回调路径。

**验证**：待本轮后续统一运行 `typecheck` 与 `verify:volcengine-speech`。

## Loop 17: Simultaneous Interpretation Boundary

**审查待实施项**：复查最初文档列表时发现“同声传译 2.0”被列入官方参考，但当前 unified
client 没有 dedicated `interpretation` capability group。若不标注边界，读者可能误以为已完整实现。

**实施**：在 `real-api-checklist.md` 中新增 Simultaneous Interpretation 2.0 条目，明确当前
只有协议级 WebSocket foundation 可复用、仍缺产品级 client；在 `delegation-matrix.md`
记录为显式 future capability，并列出实现前需要的 fake WebSocket 保护。

**标注文档**：同声传译 2.0 已从“隐含覆盖”调整为“明确待实现能力”，避免能力声明过度。

**验证**：待本轮后续统一运行 `git diff --check`。

## Loop 18: Follow-Up Plan Reopened For Interpretation

**审查待实施项**：`next-execution-plan.md` 的 checkpoint 已标为完成，但 Loop 17 明确了一个新的
真实能力缺口：同声传译 2.0 尚无 dedicated client。计划文档需要反映这个后续项。

**实施**：在 `next-execution-plan.md` 新增 Follow-Up Step 9，定义 dedicated simultaneous
interpretation client 的目标、范围、不做和受益；同步更新目录 README 的当前状态说明。

**标注文档**：后续实施项重新打开且范围明确，不再把 protocol foundation 等同于完整产品能力。

**验证**：待本轮后续统一运行 `git diff --check`。

## Loop 19: Verification Closeout

**审查待实施项**：Loop 14 到 Loop 18 完成后，需要确认新增校验、WebSocket error smoke
和文档边界调整没有破坏构建与无密钥验证。

**实施**：执行 `typecheck`、`verify:volcengine-speech` 和 `git diff --check`。

**标注文档**：本条记录作为 Loop 14 到 Loop 18 的统一验证结果；后续真正实现
Follow-Up Step 9 时应新增独立 loop。

**验证**：已通过：

```bash
pnpm --filter @dofe/infra-shared-services typecheck
pnpm --filter @dofe/infra-shared-services verify:volcengine-speech
git diff --check
```

## Loop 20: Interpretation Client Foundation

**审查待实施项**：Follow-Up Step 9 要求为同声传译 2.0 增加 dedicated capability
group。当前代码只有 protocol foundation，没有 endpoint 配置、client 入口或 public export。

**实施**：新增 `interpretation` endpoint 配置、`VolcengineInterpretationRequest` 类型、
`VolcengineInterpretationClient`、统一 client/factory/module 注入和 public export。

**标注文档**：同声传译从“未来能力”进入 dedicated client 实施阶段，但仍需校验、smoke、README
和 package export 收口。

**验证**：待本轮后续统一运行 `typecheck` 与 `verify:volcengine-speech`。

## Loop 21: Interpretation Validation And Smoke

**审查待实施项**：Loop 20 新增 client 后，还缺请求校验和无密钥路径证明。若不校验 init
payload，调用方可传空数组、空语言字段或非法采样率进入 WebSocket。

**实施**：新增 `validateInterpretationRequest`，校验 init payload 为对象、可选字符串非空、
`sample_rate` 为正数；扩展 smoke，覆盖校验、默认 endpoint、local WebSocket session、
主包导出和 `volcengine-speech/interpretation` 子路径导出。

**标注文档**：Follow-Up Step 9 的代码与无密钥 smoke 主体已完成；后续补 README/checklist
能力声明。

**验证**：待本轮后续统一运行 `typecheck` 与 `verify:volcengine-speech`。

## Loop 22: Interpretation Documentation Alignment

**审查待实施项**：Loop 20/21 已新增 dedicated interpretation client，但 README 与
`real-api-checklist.md` 仍描述为 future/protocol-only 能力，文档已经落后于代码表面。

**实施**：更新 package README 的 capability groups 和示例，新增
`client.interpretation.connect` 使用方式；更新目录 README 当前状态；将真实 API checklist
中的同声传译条目改为 dedicated client 可用、真实供应商验证仍需凭证。

**标注文档**：Follow-Up Step 9 的用户可见文档入口已同步。

**验证**：待本轮后续统一运行 `git diff --check`。

## Loop 23: Interpretation Plan And Matrix Closeout

**审查待实施项**：同声传译 dedicated client 已实现后，`delegation-matrix.md` 和
`next-execution-plan.md` 仍把它标成 future capability / 待实施状态。

**实施**：更新 delegation matrix，把同声传译标为 dedicated client implemented with local
smoke，并说明剩余真实联调和未来 typed normalization 边界；更新 Follow-Up Step 9 状态为
已完成无密钥实现，并新增 Checkpoint D。

**标注文档**：同声传译能力状态已从 future capability 收口为 no-secret implementation
complete、real API validation pending。

**验证**：待本轮后续统一运行 `git diff --check`。

## Loop 24: TTS WebSocket Entry Smoke

**审查待实施项**：Step 4 的 WebSocket matrix 包含 TTS WebSocket、realtime 和 podcast。
此前本地 session smoke 覆盖 realtime/podcast/interpretation，但没有覆盖
`ttsStreaming.connectWebSocket` 这个 dedicated entry。

**实施**：扩展本地 WebSocket smoke helper，支持自定义 connect method；新增
`VolcengineTtsStreamingClient.connectWebSocket` 覆盖，验证 init frame、request options
和 server event 回调。

**标注文档**：Step 4 的 WebSocket matrix 现在覆盖 TTS WebSocket、realtime、podcast、
interpretation 和错误帧路径。

**验证**：待本轮后续统一运行 `verify:volcengine-speech`。

## Loop 25: Interpretation Verification Closeout

**审查待实施项**：Loop 20 到 Loop 24 完成后，需要确认 dedicated interpretation client、
TTS WebSocket smoke、package exports 和文档同步没有破坏构建。

**实施**：执行 `typecheck`、`verify:volcengine-speech` 和 `git diff --check`。构建期间
`generate-exports` 更新了 package exports，新增 interpretation 子路径导出。

**标注文档**：本条记录作为 Loop 20 到 Loop 24 的统一验证结果；目录 README 的 latest
closeout 更新为 Loop 25。

**验证**：已通过：

```bash
pnpm --filter @dofe/infra-shared-services typecheck
pnpm --filter @dofe/infra-shared-services verify:volcengine-speech
git diff --check
```

## Loop 26: Product WebSocket Send And Close Smoke

**审查待实施项**：复查 Step 4 与 README WebSocket 示例时发现，本地 WebSocket smoke
已覆盖 init frame 和 server event，但产品级 entry 返回 session 后的 `sendJson`、
`sendAudio(..., true)`、`onOpen`、`onClose` 和关闭后 `isOpen()` 语义没有一起覆盖。

**实施**：扩展 `verifyWebSocketClient`，对 TTS WebSocket、realtime、podcast、
interpretation 四类 client 统一验证：握手后触发一次 `onOpen`；收到 init frame 后由
server 回发 event；client 再发送 JSON frame 与 last audio frame；server 收到音频后
主动 close；client 收到 `onClose` 且 `isOpen()` 变为 `false`。

**标注文档**：Step 4 的 WebSocket matrix 不再只说明连接与事件，还覆盖连接后发送和关闭语义。

**验证**：`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 已通过。

## Loop 27: Reserved Header Case-Insensitive Smoke

**审查待实施项**：Step 2 要求认证头、request id、resource id、sequence 由 client
管理。已有 smoke 覆盖了大写保留头，但需要证明小写 custom header 也不能绕过保留头过滤。

**实施**：扩展 header smoke，传入 `x-api-request-id`、`x-api-key`、`x-api-sequence`
等小写保留头，确认输出仍使用可信 `requestId`、api key 和 `sequence`，且非保留
`x-trace` 仍保留。

**标注文档**：Step 2 的 reserved header 护栏覆盖大小写绕过场景。

**验证**：待本轮后续统一运行 `typecheck`、`verify:volcengine-speech` 和 `git diff --check`。

## Loop 28: Interpretation Direct Export Smoke

**审查待实施项**：Loop 25 的 `generate-exports` 已生成
`volcengine-speech/interpretation/interpretation.client` 子路径，但 smoke 只覆盖
`volcengine-speech/interpretation` 聚合导出。

**实施**：新增 direct subpath require smoke，验证
`@dofe/infra-shared-services/volcengine-speech/interpretation/interpretation.client`
可导出 `VolcengineInterpretationClient`。

**标注文档**：Follow-Up Step 9 的 package export 护栏覆盖聚合子路径和直接 client 子路径。

**验证**：待本轮后续统一运行 `typecheck`、`verify:volcengine-speech` 和 `git diff --check`。

## Loop 29: WebSocket Documentation Alignment

**审查待实施项**：README 的 WebSocket lifecycle 说明仍偏概括，没有反映现有 session
实际支持的 JSON/audio/last packet/open/close 回调，也没有说明同声传译事件字段暂不强行归一化。

**实施**：更新 package README，明确共享 WebSocket session 支持 JSON frame、audio frame、
last-packet audio frame、`onOpen`、`onEvent`、`onAudio`、`onError` 和 `onClose`；
同时标注产品事件 schema 仍通过泛型 callback 暴露，真实供应商 fixtures 足够后再考虑强类型归一化。

**标注文档**：README 与 Step 4/Follow-Up Step 9 的实现边界一致，避免过度承诺 typed
interpretation event schema。

**验证**：待本轮后续统一运行 `git diff --check`。

## Loop 30: Plan Matrix Alignment

**审查待实施项**：`next-execution-plan.md` 的 Step 4 和 Checkpoint B 仍主要描述
realtime/podcast 最小路径，没有纳入 Loop 24 与 Loop 26 已完成的 TTS WebSocket、
interpretation、post-connect send 和 close callback 覆盖。

**实施**：更新 Step 4 状态、范围和 Checkpoint B，明确当前 matrix 覆盖 TTS WebSocket、
realtime、podcast、interpretation、错误帧、连接后发送和关闭回调。

**标注文档**：执行计划已与代码和 smoke 当前状态同步。

**验证**：待本轮后续统一运行 `typecheck`、`verify:volcengine-speech` 和 `git diff --check`。

## Loop 31: WebSocket Matrix Verification Closeout

**审查待实施项**：Loop 27 到 Loop 30 完成后，需要确认 reserved header 大小写保护、
interpretation direct export smoke、WebSocket send/close smoke 和文档同步没有破坏构建。

**实施**：执行 `typecheck`、`verify:volcengine-speech` 和 `git diff --check`。

**标注文档**：本条记录作为 Loop 27 到 Loop 30 的统一验证结果；目录 README 的 latest
closeout 更新为 Loop 31。

**验证**：已通过：

```bash
pnpm --filter @dofe/infra-shared-services typecheck
pnpm --filter @dofe/infra-shared-services verify:volcengine-speech
git diff --check
```

## Loop 32: Header Reader Trim Hardening

**审查待实施项**：审查 `readVolcengineHeader` 时发现普通字符串和数组 header 会原样返回；
如果供应商或 axios-like mock 返回 `X-Tt-Logid: " log "` 或空白字符串，上层会记录带空格的
log id，甚至把空白 header 当作有效值。

**实施**：更新 `headers.ts`，对普通 header 值和数组项统一 `trim()`，空白值返回
`undefined`；数组值跳过空白项后取第一个有效项。

**标注文档**：新增 Follow-Up Step 10，记录 header/WebSocket resilience hardening 的目标、
范围、不做和受益。

**验证**：扩展 `verify:volcengine-speech` 的 header reader smoke，覆盖 trim 后的单值、
数组值和空白过滤；专用 smoke 已通过。

## Loop 33: WebSocket Client-Initiated Close Semantics

**审查待实施项**：README 已说明 `session.close()` 后 session 不可复用，但当前 API 不能为
正常客户端关闭传递 close code/reason，也没有无密钥 smoke 证明主动关闭会触发 `onClose`。

**实施**：将 `VolcengineWebSocketSession.close()` 扩展为兼容性新增签名：
`close(code?: number, reason?: string | Buffer)`；新增本地 WebSocket smoke，验证
`session.close(1000, 'client-done')` 后 server 和 client `onClose` 都收到 code/reason，
且 `isOpen()` 立即为 `false`。

**标注文档**：README 的 WebSocket lifecycle 说明补充 optional close code/reason。

**验证**：`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 已通过。

## Loop 34: WebSocket Connect Failure Cleanup

**审查待实施项**：审查 connect error path 时发现连接失败会调用 `ws.close()`，但内部
`this.ws` 依赖后续 close event 清理；失败场景应在 reject path 立即把 session 标为不可用。

**实施**：在 `rejectConnect` 中确认当前 ws 后立即清空 `this.ws`；新增 connect failure
smoke：关闭本地 server 后连接该端口，断言 `connect()` reject、`onError` 调用一次且
`session.isOpen()` 为 `false`。

**标注文档**：Follow-Up Step 10 的范围包含 connect failure cleanup，不把它混入业务协议能力。

**验证**：`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 已通过。

## Loop 35: Resilience README Alignment

**审查待实施项**：实现 Loop 32 到 Loop 34 后，package README 的本地验证范围和 WebSocket
lifecycle 说明还没有反映 connection failure cleanup、close reason 与 header trim smoke。

**实施**：更新 package README：说明 `session.close()` 可带 code/reason，连接失败会触发
`onError` 并保持 session unusable；本地验证范围补充 connection failure cleanup 与
auth/header generation。

**标注文档**：用户可见契约与新增 resilience smoke 对齐。

**验证**：待本轮后续统一运行 `git diff --check`。

## Loop 36: Resilience Plan Alignment

**审查待实施项**：`next-execution-plan.md` 的后续项已收口到 Interpretation Client，但本轮
新增的 header/WebSocket resilience hardening 需要在计划中留下独立范围，避免被误读成真实
API 能力扩展。

**实施**：新增 Follow-Up Step 10 和 Checkpoint E，明确目标、范围、不做、受益：
header trim、主动 close code/reason、connect failure cleanup 和无密钥 smoke 均已完成；
同时修正 Context 中 capability group 漏列 `interpretation` 的漂移。

**标注文档**：执行计划准确记录本轮 hardening 的完成状态与真实供应商验证边界。

**验证**：待本轮后续统一运行 `typecheck`、`verify:volcengine-speech` 和 `git diff --check`。

## Loop 37: Resilience Verification Closeout

**审查待实施项**：Loop 32 到 Loop 36 完成后，需要确认 header trim、WebSocket close
code/reason、connect failure cleanup、README 和计划同步没有破坏构建或无密钥 smoke。

**实施**：执行 `typecheck`、`verify:volcengine-speech` 和 `git diff --check`。

**标注文档**：本条记录作为 Loop 32 到 Loop 36 的统一验证结果；目录 README 的 latest
closeout 更新为 Loop 37。

**验证**：已通过：

```bash
pnpm --filter @dofe/infra-shared-services typecheck
pnpm --filter @dofe/infra-shared-services verify:volcengine-speech
git diff --check
```

## Loop 38: WebSocket Codec Header Guard

**审查待实施项**：审查 `VolcengineWebSocketCodec.decode` 时发现 frame version、header
size、serialization 和 compression 没有显式支持范围校验；异常帧会落入 Buffer offset、
gzip 或 JSON 的底层错误，诊断信息不稳定。

**实施**：新增 codec header guard，明确只支持 version `1`、header size 至少 4 且不超过
input length、serialization `none/json`、compression `none/gzip`；不支持的值抛出稳定错误。

**标注文档**：新增 Follow-Up Step 11，记录 WebSocket codec negative-path hardening 的目标、
范围、不做和受益。

**验证**：待本轮后续统一运行 `verify:volcengine-speech`。

## Loop 39: Gzip Error Frame And Malformed Frame Smoke

**审查待实施项**：Loop 38 增加 codec guard 后，需要无密钥 smoke 证明正常帧不受影响，
同时错误帧压缩与负例会走稳定路径。

**实施**：扩展 `verify-volcengine-speech.mjs`：新增 gzip-compressed error frame decode；
新增 unsupported version、invalid header size、unsupported serialization、unsupported
compression 四类 malformed frame 断言。

**标注文档**：Follow-Up Step 11 的 smoke 覆盖范围已包含正向 gzip error frame 和负向
malformed frame rejection。

**验证**：`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 已通过。

## Loop 40: Codec Error Frame Offset And Compression Support

**审查待实施项**：`decodeErrorFrame` 固定从 offset 4 读取 error code 和 payload size；
虽然当前编码 header size 为 4，但共享 codec 已公开 `headerSize`，错误帧解析应尊重该字段并支持
gzip payload。

**实施**：调整 `decodeErrorFrame`，使用 `frame.headerSize` 作为 error code 起始 offset；
对 gzip error payload 执行 `gunzipSync` 后再归一化 `payload/json`。

**标注文档**：Follow-Up Step 11 的范围记录 error frame 解析尊重 header size 与 gzip payload。

**验证**：`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 已通过。

## Loop 41: Codec README Alignment

**审查待实施项**：实现 codec negative-path hardening 后，README 的本地验证范围仍只写
frame encoding/decoding 和 error frame parsing，没有说明 malformed frame rejection 和 gzip
error payload。

**实施**：更新 package README：说明 shared codec 会拒绝 unsupported frame version、
invalid header size、unknown serialization/compression，并支持 plain/gzip error frame；
本地验证范围补充 malformed frame rejection。

**标注文档**：用户可见契约与 codec hardening 的实际行为一致。

**验证**：待本轮后续统一运行 `git diff --check`。

## Loop 42: Codec Plan Alignment

**审查待实施项**：`next-execution-plan.md` 已有 WebSocket matrix 和 resilience hardening，
但没有独立记录 codec 负向协议保护，后续读者可能把这轮理解成纯测试补丁。

**实施**：新增 Follow-Up Step 11 和 Checkpoint F，明确目标、范围、不做、受益：
frame header guard、gzip error frame、malformed frame smoke 均已完成；真实供应商未知扩展帧仍按
checklist 记录。

**标注文档**：执行计划准确记录 codec negative-path hardening 的完成状态与真实供应商边界。

**验证**：待本轮后续统一运行 `typecheck`、`verify:volcengine-speech` 和 `git diff --check`。

## Loop 43: Codec Hardening Verification Closeout

**审查待实施项**：Loop 38 到 Loop 42 完成后，需要确认 codec header guard、gzip error
frame、malformed frame smoke、README 和计划同步没有破坏构建或无密钥验证。

**实施**：执行 `typecheck`、`verify:volcengine-speech` 和 `git diff --check`。

**标注文档**：本条记录作为 Loop 38 到 Loop 42 的统一验证结果；目录 README 的 latest
closeout 更新为 Loop 43。

**验证**：已通过：

```bash
pnpm --filter @dofe/infra-shared-services typecheck
pnpm --filter @dofe/infra-shared-services verify:volcengine-speech
git diff --check
```

## Loop 44: Unified Transport HTTP Contract Smoke

**审查待实施项**：复查 smoke 覆盖时发现 `VolcengineSpeechTransport` 作为统一 HTTP 底座，
目前主要通过 helper、ASR fake transport 和 legacy TTS helper 间接覆盖；缺少直接证明
`post`、`postStream`、`postHeaderStatus` 会正确传递 request id、timeout、custom header 和
trim 后 log id 的无密钥测试。

**实施**：在 `verify-volcengine-speech.mjs` 中导入 `VolcengineSpeechTransport`，使用 fake
`HttpService.post` 覆盖：JSON 成功、body code 失败、stream 返回、header-status 成功和
header-status 失败。

**标注文档**：新增 Follow-Up Step 12，记录 unified HTTP transport contract smoke 的目标、
范围、不做和受益。

**验证**：`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 已通过。

## Loop 45: Unified Transport Retry Smoke

**审查待实施项**：统一 retry executor 已有独立 smoke，legacy TTS HTTP request 也有 retry
smoke，但 `VolcengineSpeechTransport.executeWithRetry` 还没有直接证明 5xx HTTP 错误会归一化并重试。

**实施**：新增 retrying transport fake：第一次 `post` 抛 axios-like 503，第二次返回成功；
以 `{ ...resolved, maxRetries: 1 }` 创建 transport，断言调用两次并返回第二次的 trim 后 log id。

**标注文档**：Follow-Up Step 12 的范围包含 5xx retry 的 transport 层 smoke。

**验证**：`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 已通过。

## Loop 46: Transport Direct Export Smoke

**审查待实施项**：`VolcengineSpeechTransport` 被 unified client 和业务 client 复用，且
package exports 由生成脚本维护；新增直接使用后应确认发布包 direct subpath 不会漏导出。

**实施**：扩展 package export smoke，验证
`@dofe/infra-shared-services/volcengine-speech/volcengine-speech.transport`
可 require 且导出 `VolcengineSpeechTransport`。

**标注文档**：Follow-Up Step 12 的范围包含 direct transport package export smoke。

**验证**：`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 已通过。

## Loop 47: Transport README Alignment

**审查待实施项**：新增 transport 层 smoke 后，package README 的 local verification 仍只列出
auth/header、package exports、task result 和 legacy delegation，没有体现统一 HTTP transport
contract 已进入默认无密钥验证。

**实施**：更新 package README 的 Local Verification 说明，补充 unified HTTP transport behavior。

**标注文档**：用户可见验证范围与新增 transport smoke 对齐。

**验证**：待本轮后续统一运行 `git diff --check`。

## Loop 48: Transport Plan Alignment

**审查待实施项**：执行计划已有 codec 和 resilience hardening，但缺少统一 HTTP transport
contract 的独立后续项；这会让后续读者误以为 HTTP 底座仍只靠业务 client 间接覆盖。

**实施**：新增 Follow-Up Step 12 和 Checkpoint G，明确目标、范围、不做、受益：
`post`、`postStream`、`postHeaderStatus`、body-code failure、header-status failure、5xx retry 和
direct package export smoke 均已完成。

**标注文档**：执行计划准确记录 transport contract smoke 的完成状态和真实供应商 HTTP 调用边界。

**验证**：待本轮后续统一运行 `typecheck`、`verify:volcengine-speech` 和 `git diff --check`。

## Loop 49: Transport Contract Verification Closeout

**审查待实施项**：Loop 44 到 Loop 48 完成后，需要确认 unified transport JSON/stream/
header-status/retry smoke、direct export smoke、README 和计划同步没有破坏构建或无密钥验证。

**实施**：执行 `typecheck`、`verify:volcengine-speech` 和 `git diff --check`。

**标注文档**：本条记录作为 Loop 44 到 Loop 48 的统一验证结果；目录 README 的 latest
closeout 更新为 Loop 49。

**验证**：已通过：

```bash
pnpm --filter @dofe/infra-shared-services typecheck
pnpm --filter @dofe/infra-shared-services verify:volcengine-speech
git diff --check
```

## Loop 50: X-Api-Key-Only Migration And Unified Streaming ASR

**审查待实施项**：对照官方文档《大模型流式语音识别 API》
(https://www.volcengine.com/docs/6561/1354869) 深度审查发现，统一客户端虽默认走新版
`X-Api-Key`，但保留了旧版 `X-Api-App-Key` + `X-Api-Access-Key` 的 `legacy` 分支；
而该文档对应的 SAUC 流式识别能力只存在于 legacy `openspeech` provider，且仍在用旧版鉴权。
用户要求「只保留新版本」，即所有火山云调用统一使用 `X-Api-Key`。

**实施**：
- 统一 `volcengine-speech` 删除 `VolcengineSpeechAuthMode`、`authMode`、`appId`/`accessKey`/
  `appKey`/`appAccessKey` 字段与 `legacy` 分支；`buildVolcengineAuthHeaders` 只发 `X-Api-Key`。
- 新增 unified `streamingAsr` capability（`VolcengineStreamingAsrClient` + 校验 + endpoint
  `wss://.../api/v3/sauc/bigmodel` + factory/module/client/index 接线），复用共享 WebSocket
  session 与新版鉴权头。
- legacy `openspeech`（AUC + SAUC provider）、`streaming-asr` service、`openspeech.factory`
  全部从 `appKey`/`appAccessToken` 迁移到 `apiKey`（`X-Api-Key`），保留各自的领域逻辑不重写。
- `volcengine-tts` 改用 `{ apiKey, resourceId }` 调用统一 auth helper。
- `packages/common` 的 `openspeechVolcengineProviderSchema`/`openspeechProviderSchema`
  用 `apiKey` 替换 `appKey`/`appAccessToken`/`appAccessSecret`（破坏性配置变更，部署需改用
  新版控制台 APP Key）。
- smoke 移除 legacy 鉴权断言，新增 `streamingAsr` WebSocket smoke 与
  `volcengine-speech/streaming-asr` 子路径导出校验；`verify-package-exports` 补 streaming-asr。
- 文档：README 新增 Authentication 与 streamingAsr 示例；real-api-checklist 新增流式 ASR 条目
  并把鉴权前置条件改为新版 APP Key；修正 Loop 1 把 `X-Api-App-Key` 误标为「新版」的措辞。

**标注文档**：所有火山云调用统一走 `X-Api-Key`；旧版控制台凭据不再支持，属破坏性变更。
统一 `streamingAsr` capability 已就绪，真实供应商联调仍按 `real-api-checklist.md` 凭证执行。

**验证**：已通过：

```bash
pnpm --filter @dofe/infra-common build
pnpm --filter @dofe/infra-shared-services typecheck
pnpm --filter @dofe/infra-shared-services verify:volcengine-speech
git diff --check
```
