# Volcengine TTS 实施循环记录

本记录只标注已经由代码和本地验证证明的状态；真实供应商结果单独记录在凭证门控联调中。

## 循环 1：官方契约冻结与清单纠偏

**实施**：通过官方 `getDocDetail` 内容接口读取 11 篇目标文档；新增
[`volcengine-tts-contract-register.md`](./volcengine-tts-contract-register.md)，登记 endpoint、
鉴权族、关键限制和 TTS WebSocket 事件。纠正了原有 real API checklist 将音频生成、
HTTP 流、单向 WS 和长文本的文档编号互相错配的问题。

**审查待实施项**：异步长文本当前官方文档只列 legacy
`X-Api-App-Id` + `X-Api-Access-Key`；音色管理使用 Volc API 签名而非 openspeech API。
二者不能被 API-key-only transport 自动实现。单向 HTTP 的 chunk 终止 framing 和单向 WS
二进制帧也未在正文中得到足够证据，不能复用双向 WS 帧格式。

**验证**：官方内容接口返回各文档当前内容；`git diff --check` 通过。

## 循环 2：TTS/音色错误分类底座

**实施**：新增 `volcengine-tts-error-codes.ts` 的 typed capability/category 和
`classifyVolcengineTtsFailure`。分类只覆盖官方错误表已经确认的 provider code：训练次数上限
归为 `quota`，音色状态归为 `voice_state`，审核归为 `content_policy`，`55000000`/
`550013xx` 的已知服务端故障归为可重试 `upstream`。HTTP 401/403/429/5xx 也有明确分类。

**审查与修正**：独立审查发现初版错误地回退到了 ASR 的“所有 5xxxxxxx 可重试”规则，且将
HTTP 600 归为 5xx。已增加先失败的 55xxxxxx/45000081/600 边界断言，并改成官方 TTS
错误表的可重试白名单和严格 `500..599` 判定。

**待实施项**：新分类函数目前是公共底座，尚未嵌入 transport 的通用错误构造；只有各新产品
client 取得 capability 上下文后才能安全地附加分类。未知码继续保留 `unknown` 且不重试。

**验证**：先观察到新增 export 缺失的预期红灯；审查修正又观察到未知 `55009999` 的预期红灯；
修正后 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与
`git diff --check` 通过。

## 循环 3：typed 单向 HTTP TTS 与统一入口

**实施**：新增 `volcengine-speech/tts` 子域。`VolcengineTtsHttpClient` 使用官方
`req_params` 请求形状调用已经验证的单向 HTTP endpoint；`VolcengineTtsApiClient` 将音频
生成与该 HTTP 流组合为统一 `client.tts.createAudio()` /
`client.tts.synthesizeHttpStream()`。factory 与 Nest module 已注入这个入口。为避免与 legacy
`VolcengineTtsClient` 的既有根导出冲突，统一域的公开类名为 `VolcengineTtsApiClient`，但
调用方仍使用 `client.tts`。

**审查与修正**：独立审查发现 `NaN`、数组 `audio_params` 与非字符串 speaker 会绕过或破坏
运行时校验，并且初版未挂入 factory；已先加红灯断言，再收紧外部输入校验并完成 DI/factory
整合。审查还提出 200 JSON 错误体检查；官方没有公开 HTTP chunk 终止 framing，若在 transport
中读取流将可能吞掉首段音频，故该项保持阻断而不是猜测实现。

**待实施项**：`client.tts` 还没有单向 WS、双向 WS 和长文本方法。单向 HTTP 的业务错误
chunk 需要官方 fixture 或真实联调记录后才能安全处理；旧 `ttsStreaming` 保持原有扁平 payload
以避免破坏调用方。

**验证**：先观察到 `tts` 子路径缺失的预期红灯；整合中又观察到 legacy 同名 export 的编译红灯，
改名后 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与
`git diff --check` 通过。

## 循环 4：typed 音色训练、查询与升级

**实施**：`VolcengineVoiceClient` 新增 `train()`、`get()` 和 `upgrade()`，分别使用官方
`voice_clone`、`get_voice`、`upgrade_voice` endpoint。新增 voice request/profile types，训练
输入要求 `speaker_id` 与 `audio.data/format`，查询和升级使用 `speaker_id` 及可选
`custom_speaker_id`。三个 endpoint 现在是独立配置键，不经旧字符串 action 拼接。

**审查与修正**：查询/升级初版对数组输入抛普通 `Error`；已添加先失败断言，并将该路径纳入
`VolcengineSpeechValidationError`。音色设计缺少官方成功 response schema，音色管理使用
Volc API 签名，均不与这三个 API-key HTTP 接口混合实现。

**待实施项**：`voice.design` 需要成功/失败 fixture 后才可定义响应类型；音色管理需要独立
签名 transport 和显式凭证模型，不能复用 `X-Api-Key`。

**验证**：新增 API/校验缺失的红灯与查询数组输入的红灯均已观察；修正后
`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与
`git diff --check` 通过。

## 循环 5：TTS WebSocket endpoint 去歧义

**实施**：配置新增 `ttsOneWayWebSocket` 和 `ttsDuplexWebSocket`。默认值严格对应官方
`/api/v3/tts/unidirectional/stream` 和 `/api/v3/tts/bidirection`；保留旧
`ttsWebSocket` 配置键和行为，避免静默改变调用方。

**审查待实施项**：单向 WS 的二进制 packet 字段和 HTTP chunk 终止规则尚无可用官方 fixture；
双向 WS 虽有官方 frame 附件，尚未实现其 event/session frame codec。因此新配置不能被误标为
产品级会话已可用。

**验证**：先观察到新 endpoint 值为 `undefined` 的预期红灯；修正后
`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与
`git diff --check` 通过。

## 循环 6：音频生成 HTTP 官方约束收紧

**实施**：`validateCreateAudioRequest` 现在只接受官方当前支持的
`seed-audio-1.0`，并拒绝超过 3000 字符的 `text_prompt`。这两个约束来自 `2550782`，
在请求到达供应商前失败。

**审查待实施项**：参考资源的字节大小、格式和图片尺寸限制仍需要将官方示例与限额拆成
可复现 fixture 后再实现；不以客户端猜测 Base64 解码后的资源类型。

**验证**：先观察到非法 model 的预期红灯；修正后
`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与
`git diff --check` 通过。

## 循环 7：双向 TTS WebSocket 事件 codec

**实施**：新增 `VolcengineTtsDuplexCodec`，按 `2532486` 官方协议的 event/session 布局
编码和解码双向 TTS 帧：4-byte header、event、连接事件外的 session id、payload length 和
JSON payload。已覆盖无 session 的 `StartConnection` 与带 session 的 `TaskRequest`。

**审查待实施项**：codec 不等于产品会话。`connectDuplex()` 仍需将
StartConnection/StartSession/TaskRequest/FinishSession/FinishConnection 状态机、服务端 event
分派、Error frame 和关闭语义组合为独立 client；在此之前不可把 generic WebSocket session
接到双向 endpoint。

**验证**：先观察到 codec export 缺失的预期红灯；实现后
`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与
`git diff --check` 通过。

## 循环 8：双向 TTS 本地会话状态机

**实施**：新增 `VolcengineTtsDuplexSession`，将官方 client 事件约束为
`StartConnection -> StartSession -> TaskRequest* -> FinishSession -> FinishConnection`。
关闭后或未建立 session 时发送文本会被本地拒绝，避免不合法帧抵达供应商。

**审查待实施项**：该状态机以 `sendFrame` 注入发送，尚未绑定真实 WebSocket；绑定时必须让
`VolcengineWebSocketSession` 支持双向 codec 的服务端事件解码，不能调用其通用 JSON/sequence
编码方法。

**验证**：先观察到 session export 缺失的预期红灯；实现后
`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与
`git diff --check` 通过。

## 循环 9：双向协议的原始帧发送边界

**实施**：`VolcengineWebSocketSession` 新增 `sendRaw(Buffer)`，复用既有 open-state 与
send-error 处理，供产品级协议发送官方自定义 frame；`sendJson` 和 `sendAudio` 保持不变。

**审查待实施项**：双向 TTS 仍需要独立的入站 duplex frame decoder/disptacher。通用 session
当前按既有 sequence codec 解码入站帧，不能直接监听双向 endpoint 的服务端事件。

**验证**：先观察到 `sendRaw` 缺失的预期红灯；实现后
`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与
`git diff --check` 通过。

## 循环 10：音色设计 typed 请求入口

**实施**：新增 `client.voice.design()` 和独立 `voiceDesign` endpoint。校验
`speaker_id`、`prompt`、文本或图片输入、`image_url`/`image_bytes` 互斥及 200 字
`text_prompt` 限制。

**审查待实施项**：官方页面没有稳定的成功 response schema，因此不把设计结果伪装成
`VolcengineVoiceProfile`；真实返回样本可用后再收紧 result type。旧双头鉴权说明亦需凭证
联调验证。

**验证**：先观察到 validator export 缺失的预期红灯；修正 fake transport endpoint 后，
`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与
`git diff --check` 通过。

## 循环 11：真实 API Key 联调与 HTTP 流业务错误修复

**联调证据**：使用用户提供的 Key 调用单向 HTTP TTS。标准 `X-Api-Key` 鉴权被服务端接受；
服务端返回 HTTP 200、`X-Tt-Logid=202607160750395F682B436507EAB1410B` 和业务码
`55000000`，消息为 resource id 与 speaker 不匹配。测试 Key、request id、文本和音频均未
写入仓库。

**实施**：真实响应证明流接口会以 HTTP 200 + JSON 错误 body 失败。transport 现在检查首个
完整 JSON chunk：业务 `code` 非成功时抛出统一错误；其他首包会被无损回放为 `Readable`。

**审查待实施项**：要验证成功音频流，仍需提供与该 Key 的资源 ID 相匹配的音色；训练、升级、
设计会创建/修改远端资源，须使用可清理的专用测试资源。异步长文本和音色管理不适用该 Key
的统一鉴权模型。

**验证**：无密钥 regression 覆盖 HTTP 200 JSON 业务错误；
`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` 与
`git diff --check` 通过。

## 循环 12：音色管理签名查询探针

**实施**：使用 `BatchListMegaTTSTrainStatus`、`Version=2023-11-07`、
`Service=speech_saas_prod`、`Region=cn-north-1` 发起只读音色管理查询；请求使用 SDK
Signer，未创建、升级、续费或删除远端资源。

**联调结果**：服务端三次均返回 `401 SignatureDoesNotMatch`，request id 分别为
`20260716080430F088C201F29FE945A226`、`2026071608045627ACDD4E13FE9C6B851F`、
`202607160805154D80DCACA67647EAC382`。原始 SK、一次 Base64 解码和二次 Base64 解码均
未通过；任何凭证内容均未写入仓库或日志。

**审查待实施项**：需要同一账号、区域和服务的有效原始 AK/SK，或确认当前凭证的权限边界。
认证成功后，API 还要求 `AppID` 才能列出可用/训练音色；该值不能从 AK/SK 推导。

### 更正（2026-07-16）

上一段的三次 `SignatureDoesNotMatch` 使用了转录时字符不同的 SK，不能作为当前用户提供的
凭证结论。使用本次消息的 AK/SK 原值重新签名后，服务端返回
`400 InvalidParameter: ListMegaTTSTrainStatusReq.AppID`，request id 为
`2026071611435856643CFD0C9BF5C4A44E`。这证明签名已被接受；查询可用音色当前只缺该账号
的 `AppID`。仓库与关联 models 工作区未发现可直接使用的 AppID 值。

## 循环 13：AppID 驱动的音色目录辨析与端到端 HTTP 合成

**实施**：在用户提供 AppID 后，使用已验证的 `speech_saas_prod` 签名查询
`BatchListMegaTTSTrainStatus`。该查询成功返回 12 条账号训练资源状态，资源族分布为
`seed-icl-1.0` 与 `seed-icl-2.0`。随后调用 `ListBigModelTTSTimbres`
（`Version=2025-05-20`）查询基础音色目录，成功返回 346 个音色。两次均为只读请求，未创建、
升级、训练或删除远端资源。

**审查与纠偏**：训练状态目录中的标识不是单向 HTTP TTS 可直接使用的基础音色目录。以其中一条
`seed-icl-2.0` 训练状态标识调用时，服务端返回业务码 `45000001`（speaker not found）；以基础
目录中的旧世代音色搭配 `seed-tts-2.0` 时，返回业务码 `55000000`（resource id 与音色不匹配）。
因此，调用方必须按音色族选择 resource id，不能从训练状态接口推断可合成的 speaker。

**联调结果**：使用基础音色与 `seed-tts-1.0` 的匹配组合，单向 HTTP TTS 返回 HTTP 200 和
约 186 KB PCM 音频，`X-Tt-Logid=2026071612441742F00C4AE1B7E2714BBA`。音色 ID、AppID、
凭证、请求文本与音频内容均未写入仓库。此前的两类 HTTP 200 业务错误也均由
`VolcengineSpeechTransport.postStream()` 的首包检查转为调用方可处理的异常。

**待实施项**：仍未用专用测试资源验证音色训练、升级、设计及异步长文本，因为它们会创建或修改
远端资源；单向/双向 WebSocket 仍须完成产品 client、入站 event dispatcher 和真实握手联调。
基础音色目录与训练状态目录的 typed API 仍应在后续迭代中明确拆分，不能复用当前 generic
`voice.listVoices()` 路径。

**验证**：真实 HTTP 成功音频与两种业务失败均已观察；随后运行 typecheck、无密钥 smoke、
package export 检查和 diff whitespace 检查。

## 循环 14：将 TTS 业务错误分类接入单向 HTTP 边界

**实施**：新增 `VolcengineTtsError` 和 `normalizeVolcengineTtsError()`；
`VolcengineTtsHttpClient` 现在将 shared transport 的业务/HTTP 错误转换为带
`capability=tts_http`、`category`、`providerCode`、request id、log id 和原始响应的 typed 异常。
重试标记只来自 `2534853` 已登记的分类表，不再让通用错误码范围覆盖该产品边界。

**审查待实施项**：该转换目前只覆盖 typed 单向 HTTP 入口。音频生成、音色 HTTP、长文本和
WebSocket 入站错误必须在各自的产品入口接入，不能由通用 transport 猜测 capability。

**验证**：先加入缺失 export 的失败断言；实现后无密钥 smoke 通过，并断言 `45000001` 归为
`validation`、不可重试且保留 `tts_http` 上下文。

## 循环 15：双向 WebSocket 入站事件与会话隔离

**实施**：`VolcengineTtsDuplexCodec` 新增仅限官方 server event 的编码辅助；
`VolcengineTtsDuplexSession.handleServerFrame()` 现在验证 Full Server Response 消息类型、连接
生命周期、事件白名单和 session id 一致性。服务端 `SessionFinished`、`SessionCanceled`、
`SessionFailed` 释放本地会话；连接失败或关闭进入 closed 状态。

**审查待实施项**：该能力仍是纯协议状态机，尚未绑定真实 `ws`。产品 client 必须把原始字节先交给
该方法，再分发音频/字幕/完成事件，且不能使用 generic session 的 JSON decoder 处理双向帧。

**验证**：先加入 `encodeServerEvent` 与 `handleServerFrame` 缺失的红灯；实现后覆盖正确的
`SessionStarted`/`SessionFinished`，并覆盖跨 session `TTSResponse` 与终态后重复消息的拒绝。

## 循环 16：双向 WebSocket 产品会话绑定

**实施**：新增 `VolcengineTtsDuplexWebSocketSession` 和 `client.tts.connectDuplex()`。
共享 `VolcengineWebSocketSession` 新增受控的 raw-message handler，只在该产品适配器中绕过通用
JSON codec；连接、鉴权 headers、超时、send error 和 close 仍由共享 session 负责。双向适配器
在 open 后发送 `StartConnection`，将原始服务端帧先交给循环 15 的状态机，确认合法后才触发
`onEvent`。

**审查待实施项**：本地 WebSocket 端到端已覆盖协议生命周期，但尚未用供应商 endpoint 执行真实
握手、音频回包和 usage 帧验证。服务端 `ConnectionFailed`/`SessionFailed` 目前作为事件回调，
下一轮应映射为带 `tts_duplex_ws` capability 的 typed 错误。

**验证**：先加入缺失产品 session 的红灯；实现后以本地 `ws` server 验证
`StartConnection -> StartSession -> TaskRequest -> FinishConnection`，并验证 server 的
`TTSResponse` 与 `SessionFinished` 能到达 typed event callback。

## 循环 17：单向 WebSocket typed 会话

**实施**：新增 `VolcengineTtsOneWayWebSocketSession` 与 `client.tts.connectOneWay()`。构造时
复用 HTTP TTS 请求校验，连接时仅发送一次 init payload；对外只提供 `connect()`、`isOpen()` 和
`close()`，不暴露 `sendJson()`/`sendAudio()`。服务端二进制音频与 `TTSSentenceStart`、
`TTSResponse`、`TTSSentenceEnd`、`TTSSubtitle`、`SessionFinished` JSON 事件分别回调。

**审查待实施项**：单向协议的本地帧和事件生命周期已覆盖，但尚未用供应商 WebSocket 做握手和
服务端业务错误联调；连接/错误尚依赖 shared WebSocket 的通用错误对象，后续可按循环 14 的模式
添加 `tts_one_way_ws` typed 错误转换。

**验证**：先加入缺失单向 session 的红灯；实现后以本地 server 验证一次 init payload、
`TTSResponse` 与 `SessionFinished` 分发及远端关闭后的 `isOpen()=false`。

## 循环 18：异步长文本请求契约

**实施**：新增 `VolcengineTtsLongTextSubmitRequest` 和
`validateTtsLongTextSubmitRequest()`，复用单向 TTS 的 text/ssml、speaker、audio 参数校验，
并按 `1829010` 增加 100,000 字符上限和可选 `unique_id` 的 20 至 64 字符范围。该类型只描述
submit request，不在 client 中启动隐式轮询。

**审查待实施项**：官方 submit/query 需要 `X-Api-App-Id` 与专用 `X-Api-Access-Key`（Access
Token），当前提供的 API Key/AKSK 不能替代。故本轮未实现会错误携带 API Key 的 HTTP client，
也未执行会消耗配额的远端长文本任务；取得专用 Access Token 后，下一步应新增显式 credential
config、submit/query client、任务结果 normalizer 和受控并发测试。

**验证**：先加入缺失 validator 的红灯；实现后验证合法 submit body、100,001 字符拒绝和短
`unique_id` 拒绝，`verify:volcengine-speech` 与 diff whitespace 检查通过。

## 循环 19：双向会话取消语义

**实施**：`VolcengineTtsDuplexSession` 和产品 WebSocket wrapper 新增 `cancelSession()`，发送
官方 `CancelSession` 事件后立即释放本地 session，后续文本发送被拒绝。

**审查待实施项**：供应商 `SessionCanceled` 帧仍需凭证门控的真实 WebSocket 联调；本地状态机已
避免重复任务发送，但无法替代远端取消确认。

**验证**：smoke 断言最后一帧为 `CancelSession`，并断言取消后文本发送失败。

## 循环 20：长文本专用鉴权边界

**实施**：新增 `buildVolcengineTtsLongTextHeaders()`，只构造 `X-Api-App-Id`、
`X-Api-Access-Key`、`X-Api-Resource-Id` 和可选 request id；缺任一必填值立即抛 validation
error，避免将 API Key 或 AK/SK 错用为长文本 Access Token。

**审查待实施项**：仍缺用户提供的专用 Access Token，故 submit/query client 和远端任务验证继续
保持门控。音色训练、升级、设计同样需要可清理的专用资源，不能在当前账号资源上自动执行。

**验证**：typecheck、无密钥 smoke 与 whitespace 检查通过。

## 循环 21：音频生成 typed 错误边界

**实施**：`VolcengineAudioGenerationClient.createAudio()` 现在将 transport 的业务或 HTTP 错误
转换为 `VolcengineTtsError(capability=audio_generation)`，保留供应商码、request/log id、原始响应和
官方错误分类。

**审查待实施项**：音色 HTTP、单向 WS 与双向 WS 仍各自需要同样的 capability 转换及对应的失败
fixture；这些是本地可继续实施的优化，不依赖供应商资源。

**验证**：typecheck 与无密钥 smoke 通过。

## 循环 22：音色训练 typed 错误

**实施**：`voice.train()` 的 transport 失败现在转换为 `capability=voice_training` 的
`VolcengineTtsError`。

**审查待实施项**：真实训练会创建远端资源，仍须可清理测试资源。

**验证**：无密钥 smoke 与 TypeScript build 通过。

## 循环 23：音色查询 typed 错误

**实施**：`voice.get()` 的失败现在转换为 `capability=voice_query` 的 typed 错误。

**审查待实施项**：需以专用音色验证真实响应 schema，不能用推测字段收紧 `VoiceProfile`。

**验证**：无密钥 smoke 与 TypeScript build 通过。

## 循环 24：音色升级 typed 错误

**实施**：`voice.upgrade()` 的失败现在转换为 `capability=voice_upgrade` 的 typed 错误。

**审查待实施项**：升级会改变远端音色版本，仅可在可回收测试资源上联调。

**验证**：无密钥 smoke 与 TypeScript build 通过。

## 循环 25：音色设计 typed 错误

**实施**：`voice.design()` 的失败现在转换为 `capability=voice_design` 的 typed 错误；四个
音色 API 共用局部 `postTyped()`，只消除重复的错误边界，不改变 endpoint 或 payload。

**审查待实施项**：设计接口缺稳定的真实成功 schema，仍保留 `unknown` 结果；真实设计会生成资源，
必须使用可清理测试账号。

**验证**：`verify:volcengine-speech` 与 `git diff --check` 通过。

## 循环 26：异步长文本真实 submit/query 联调

**实施**：使用用户提供的 AppId 与语音 Access Token 调用 `1829010` 的 submit 与 query；请求使用
`seed-tts-1.0` 的基础音色组合。未使用 API Key、IAM AK/SK 或 SecretKey，且没有在仓库写入任何
凭证、任务 ID、音频 URL、文本或音频数据。

**联调结果**：submit 返回 HTTP 200、业务码 `20000000`、任务状态 `1` 和服务端 log id
`2026071614183141AAE423B393C5081C6E`；随后 query 返回 HTTP 200、业务码 `20000000`、终态
`2` 和有效音频 URL。query 的 log id 为 `20260716141851DD66FAD47B6D4C742A93`。

**审查待实施项**：真实协议已确认，但 shared `VolcengineSpeechTransport` 仍默认 API Key 鉴权；
下一步应在不混合两套凭证的前提下实现显式 long-text credential config 和 submit/query client。
训练、升级、设计仍需要可清理远端资源。

**验证**：真实 submit/query 均成功；现有无密钥 smoke 保持通过。
