# Shared Services Volcengine Speech Implementation Plan

日期：2026-07-08

## 背景

本计划用于第二步实施 `packages/shared-services` 中火山引擎豆包语音能力，参考现有 `transcode` 模块的组织方式：独立子域目录、NestJS Module + Client、DTO/types/config 分层、统一导出、配置缺失 fail-fast、日志和错误透传。第一步只产出执行计划，不改业务代码。

## 资料来源

| 文档 | 用途 |
| --- | --- |
| https://www.volcengine.com/docs/6561/2550782?lang=zh | 音频生成 HTTP，非流式多模态/参考音频生成 |
| https://www.volcengine.com/docs/6561/2528925?lang=zh | 单向流式语音合成 HTTP |
| https://www.volcengine.com/docs/6561/2534913?lang=zh | 语音合成 WebSocket 类协议 |
| https://www.volcengine.com/docs/6561/2532486?lang=zh | 语音合成 WebSocket 类协议补充 |
| https://www.volcengine.com/docs/6561/1829010?lang=zh | 长文本/异步类语音能力 |
| https://www.volcengine.com/docs/6561/2534906?lang=zh | 音色相关 API |
| https://www.volcengine.com/docs/6561/2535742?lang=zh | 音色相关 API |
| https://www.volcengine.com/docs/6561/2535751?lang=zh | 音色相关 API |
| https://www.volcengine.com/docs/6561/2277844?lang=zh | 音色/声音设计相关 API |
| https://www.volcengine.com/docs/6561/2235883?lang=zh | 音色/资源管理相关 API |
| https://www.volcengine.com/docs/6561/2534853?lang=zh | 豆包语音错误码 |
| https://www.volcengine.com/docs/6561/1594356?lang=zh | 端到端实时语音大模型 API |
| https://www.volcengine.com/docs/6561/1668014?lang=zh | 播客 API WebSocket v3 协议 |
| https://www.volcengine.com/docs/6561/1798094?lang=zh | 豆包语音妙记 API |

## 总体设计

结论：有必要建立统一 client，但不在第一阶段强迁移旧调用方。新增能力统一放在 `packages/shared-services/src/volcengine-speech`，作为火山语音大模型主入口；已有 `volcengine-tts`、`openspeech`、`streaming-asr` 继续保留 public API，后续按兼容委托方式逐步收敛到底层统一实现。

统一 client 的必要性来自三点：

1. 这些文档覆盖的能力已经从传统 TTS 扩展到音频生成、流式合成、WebSocket 合成、端到端实时语音、播客、妙记和音色资源管理，继续分散实现会重复鉴权、错误码、日志、request id、WebSocket 二进制协议、gzip 和 sequence 处理。
2. 新旧控制台鉴权、`X-Tt-Logid`、错误码、HTTP streaming 和 WebSocket session 都是横切能力，适合沉淀到 shared-services 的统一协议层。
3. 现有模块已经有生产调用方，直接替换会放大回归风险；新增统一 client + 旧模块渐进委托，可以同时获得一致性和兼容性。

内部按能力拆分为 `audio-generation`、`tts-streaming`、`voice`、`realtime`、`podcast`、`memo`、`protocol`、`errors`。其中 `protocol` 和 `errors` 是共享底座，业务能力子 client 只负责各自文档字段、请求/事件模型和结果映射。

鉴权优先支持新版控制台 `X-Api-Key`；兼容旧版 `X-Api-App-Id` + `X-Api-Access-Key` 时通过显式配置开启。HTTP 统一基于 `HttpModule`，WebSocket 统一基于 `ws`，协议编解码参考现有 `openspeech/providers/volcengine-streaming.provider.ts` 的二进制头、gzip、sequence、session 管理写法。

## 迁移策略

- 第一阶段：新建 `volcengine-speech`，所有新增 API 只进入统一 client；旧模块不改 public API。
- 第二阶段：在不改变方法签名的前提下，让 `volcengine-tts`、`openspeech`、`streaming-asr` 中可复用的底层逻辑委托到 `volcengine-speech` 的 `protocol`、`errors` 或对应子 client。
- 第三阶段：新增调用方默认使用 `@dofe/infra-shared-services/volcengine-speech`；旧入口只作为兼容层保留，并在文档中标记推荐迁移路径。
- 非目标：不做一次性大迁移，不批量改业务服务导入路径，不删除已有导出。

## 执行计划

### 1. 梳理现有边界与兼容入口

**状态**：已完成（循环 1）。已审查 `volcengine-tts`、`openspeech`、`streaming-asr`、`transcode/modules/volcengine-tos` 的模块组织、配置解析、导出方式和 WebSocket 协议实现，确认新能力进入 `volcengine-speech`，旧入口保持兼容。

**目标**：确认 `shared-services` 中已有火山相关能力的复用点，明确“统一 client 是新能力主入口，旧模块是兼容入口”的边界。

**范围**：阅读 `volcengine-tts`、`openspeech`、`streaming-asr`、`transcode/modules/volcengine-tos` 的 config、client、module、DTO、导出方式；形成新目录命名、公共类型命名、导出路径约定；列出哪些逻辑可立即复用，哪些只能后续委托。

**不做**：不删除或重命名现有 public API；不迁移调用方；不改配置文件结构；不在本阶段把旧模块改成 wrapper。

**受益**：第二步实施时不会破坏已有 TTS、ASR、转码调用方，也能沿用项目已有的 NestJS DI 和 fail-fast 配置风格。

### 2. 建立 `volcengine-speech` 模块骨架

**状态**：已完成（循环 1）。已创建 `volcengine-speech` 顶层模块、统一 client、transport、config、errors 和 public index，并从 `packages/shared-services/src/index.ts` 导出。

**目标**：新增统一的火山豆包语音模块，提供稳定的 Client/Module/Factory 基础。

**范围**：创建 `volcengine-speech.module.ts`、`volcengine-speech.client.ts`、`volcengine-speech.factory.ts`、`index.ts`、`types.ts`、`dto/`、`config/`；创建 `audio-generation/`、`tts-streaming/`、`voice/`、`realtime/`、`podcast/`、`memo/`、`protocol/`、`errors/` 子目录；接入 `ConfigModule`、`HttpModule`、`WINSTON_MODULE_PROVIDER`；在 `packages/shared-services/src/index.ts` 中导出。

**不做**：不实现具体接口请求；不引入业务层概念；不写数据库持久化。

**受益**：后续每个 API 能力可以作为小步提交接入，公共鉴权、协议、日志、错误处理不会重复散落，也为旧模块后续委托提供稳定底座。

### 3. 实现配置与鉴权模型

**状态**：已完成（循环 1）。已支持新版 `X-Api-Key` 与旧版 `X-Api-App-Id` + `X-Api-Access-Key` 头生成，配置解析优先读取显式/统一 speech 配置，并兼容现有 `tts.volcengine`。

**补充状态**：已完成（循环 6）。`maxRetries` 已接入 HTTP/stream transport，对 5xx、连接中断、超时和可重试火山错误执行指数退避重试。

**补充状态**：已完成（循环 16）。HTTP JSON 响应的 `code/message` 成功断言已移入 retry operation，可重试的火山业务错误现在会真正参与 `maxRetries`。

**补充状态**：已完成（循环 39）。request options 校验扩展到自定义 header 值，拦截空字符串与非字符串值，避免无效 header 直达供应商。

**目标**：支持新版/旧版控制台鉴权、默认 endpoint、请求追踪 ID 和多账号显式注入。

**范围**：定义 `VolcengineSpeechConfig`，包含 `apiKey`、`appId`、`accessKey`、`resourceId`、`region`、HTTP endpoint、WebSocket endpoint、timeout、retry；实现 DI 配置解析和 `create(config, deps)` 显式工厂；请求头统一生成 `X-Api-Key`、`X-Api-Request-Id` 或旧版双头。

**不做**：不在 shared-services 内读取数据库 ProviderKey；不把密钥写入日志；不做自动密钥轮换。

**受益**：能同时服务当前 keys/config.json 场景和 models.dofe.ai 这类多 ProviderKey 场景，避免多账号串扰。

### 4. 建立错误码与响应标准化

**状态**：已完成（循环 1）。已增加 `VolcengineSpeechError`、可重试判断、HTTP 响应 `code/message` 成功断言和 `X-Tt-Logid`/request id 透传。

**补充状态**：已完成（循环 36）。新增 `normalizeVolcengineHttpError` 与 `isRetryableHttpStatus`，把 axios 形态的 HTTP/网络错误（非 2xx、超时、`ECONNRESET` 等）统一归一化为 `VolcengineSpeechError`，保留原始错误于 `raw`，并补齐 HTTP 级失败缺失的 `requestId`/`logId`/`retryable`，确保所有失败响应都可拿到追踪标识。

**目标**：把官方错误码文档沉淀为共享错误模型，统一 HTTP/WebSocket 错误抛出形态。

**范围**：新增 `volcengine-speech.errors.ts`，定义错误码枚举、错误分类、可重试判断、`X-Tt-Logid`/request id 捕获；为 HTTP 响应体中的 `code/message` 和 WebSocket error frame 提供标准转换。

**不做**：不吞掉原始错误响应；不把所有错误统一成 `BadGatewayException`；不做用户可见文案国际化。

**受益**：调用方可以基于统一异常判断重试、降级、告警，排查时也能拿到火山侧 log id。

### 5. 接入音频生成 HTTP

**状态**：已完成（循环 2）。已实现 `VolcengineAudioGenerationClient.createAudio`，使用统一 transport 调用音频生成 HTTP endpoint，并标准化 `audio`、`url`、`duration`、`originalDuration`、`subtitle` 返回。

**补充状态**：已完成（循环 11）。已新增 `validation` 纯模块并在 client 中接入，拦截空模型/空文本、reference 数量、音频与图片 reference 混用等无效请求。

**补充状态**：已完成（循环 17）。`audio_config` 已增加运行时范围校验，覆盖输出格式、采样率、语速、音量和音调。

**目标**：实现非流式音频生成接口，覆盖纯文本、参考音频、参考图片三种生成模式。

**范围**：按文档实现 `POST /api/v3/tts/create` client 方法；DTO 支持 `model`、`text_prompt`、`references`、`speaker/audio_data/audio_url/image_data/image_url`、`audio_config`、`watermark`；返回 Base64 音频、临时 URL、duration、original_duration、subtitle。

**不做**：不负责上传参考资源到对象存储；不持久化返回音频；不突破文档限制，例如 120 秒输出、参考音频数量/大小/格式限制。

**受益**：业务层可以直接调用豆包新一代音频生成能力，替代只支持传统 TTS 的窄接口。

### 6. 接入单向流式语音合成 HTTP

**状态**：已完成（循环 2）。已实现 `VolcengineTtsStreamingClient.synthesizeStream`，返回 Node.js stream，并保留 request id 与火山 `X-Tt-Logid`。

**目标**：实现面向边生成边播放的单向流式 TTS 能力。

**范围**：实现 HTTP streaming 请求封装，输出 Node.js `Readable` 或 async iterator；支持 speaker、文本、音频格式、采样率、语速、音量、音调等参数；补齐超时、中断、日志和错误转换。

**不做**：不实现浏览器端播放器；不把流式响应强制缓存成文件；不和非流式接口共用不兼容的返回类型。

**受益**：调用方可以在服务端转发或消费音频流，降低首包延迟，适合对话和实时播报场景。

### 7. 接入语音合成 WebSocket 协议

**状态**：已完成（循环 3）。已实现 `protocol/websocket-codec.ts` 与 `protocol/websocket-session.ts`，覆盖 JSON/audio 帧编码、gzip、sequence、错误帧解码和通用 WebSocket session。

**补充状态**：已完成（循环 12）。WebSocket session 已支持 `VolcengineSpeechRequestOptions`，TTS WebSocket、实时语音和播客入口均可传 request id 与自定义 header。

**补充状态**：已完成（循环 38）。WebSocket session 新增 `isOpen()` 可观测方法，供调用方在发送前判断连接是否可用（连接前/关闭后返回 `false`），并由 `assertOpen` 统一复用，避免调用方依赖 try/catch 推断会话状态。

**目标**：实现 WebSocket 语音合成协议的连接、请求、分包响应和关闭流程。

**范围**：复用现有 streaming provider 的协议思路，抽出 `protocol/websocket-codec.ts`；支持 gzip/JSON、sequence、session id、二进制帧解析、错误帧处理；提供 `connectTtsSession`、`sendText`、`close` 等低层能力。

**不做**：不在本步骤包装成高层业务会话编排；不实现端侧播放；不做跨进程连接池。

**受益**：为后续实时 TTS、播客和端到端实时语音大模型提供统一 WebSocket 底座，减少协议实现重复。

### 8. 接入端到端实时语音大模型 API

**状态**：已完成（循环 3）。已实现 `VolcengineRealtimeSpeechClient.connect`，基于统一 WebSocket session 创建端到端实时语音会话，由调用方传入官方文档定义的 init payload 和事件 callbacks。

**目标**：提供实时语音输入、模型理解、语音输出的一体化会话 client。

**范围**：按文档实现实时会话配置、音频输入帧发送、服务端事件解析、文本/音频增量结果回调、会话中断与关闭；定义 `RealtimeSpeechSession`、callbacks、状态机和重连/超时策略。

**不做**：不实现前端麦克风采集；不做业务对话状态存储；不默认开启自动重连导致重复计费，重连策略由调用方显式开启。

**受益**：业务层可接入真正端到端的实时语音模型，而不是自行拼 ASR + LLM + TTS 三段链路。

### 9. 接入播客 API WebSocket v3

**状态**：已完成（循环 3）。已实现 `VolcenginePodcastClient.connect`，复用统一 WebSocket codec/session，支持播客会话事件和音频帧回调。

**目标**：实现播客生成协议的低层 client 和结果事件模型。

**范围**：按 v3 WebSocket 协议实现会话创建、脚本/角色/音色/风格参数发送、生成进度事件、音频片段或成品地址解析；复用 WebSocket codec 和错误模型。

**不做**：不提供播客脚本创作逻辑；不做音频拼接后处理；不持久化播客工程。

**受益**：上层可以基于统一接口编排播客生成流程，shared-services 负责协议可靠性和火山侧字段适配。

### 10. 接入豆包语音妙记 API

**状态**：已完成（循环 2）。已实现 `VolcengineMemoClient.submitTask/queryTask`，统一映射 `task_id/taskId`、状态、结果、错误、request id 与 log id。

**补充状态**：已完成（循环 11）。`submitTask` 已在本地校验 `audioUrl` 或 `resourceUrl` 至少提供一个，避免无效任务直达供应商 API。

**补充状态**：已完成（循环 37）。将任务结果归一化抽到纯模块 `memo/memo.normalizer.ts`，并修正错误映射：仅在显式错误字段（`error`/`err_msg`/`error_message`）或任务 `status` 为失败态时才把 `message` 视为错误，避免成功响应的 `message` 被误判为任务错误。

**目标**：实现语音妙记相关任务提交、查询和结果解析。

**范围**：根据文档定义妙记任务 DTO，支持音频 URL/资源引用、任务创建、状态查询、转写/摘要/章节/要点等结构化结果映射；按错误码文档处理失败原因。

**不做**：不实现会议业务模型；不做文件上传和权限校验；不把妙记结果写入数据库。

**受益**：视频、会议、播客等业务可以复用一套“长音频理解/整理”能力，而不需要各自直连火山 API。

### 11. 接入音色与声音资源 API

**状态**：已完成（循环 2）。已实现 `VolcengineVoiceClient` 的通用 `request`、`listVoices`、`submitVoiceTraining`、`queryVoiceTraining`，具体 action/path 仍由配置和调用方按官方文档传入。

**目标**：覆盖文档中音色查询、训练、管理、声音设计等资源型 API。

**范围**：实现 `voice` 子 client，提供音色列表/详情、训练任务创建、训练状态查询、资源删除或更新、声音设计相关请求；DTO 明确 speaker id、voice id、task id、参考音频、状态枚举。

**不做**：不在 shared-services 中保存音色资产元数据；不实现审核流程 UI；不封装业务定价或配额。

**受益**：TTS、音频生成、播客、实时语音可以共享同一套音色管理能力，减少调用方对不同文档字段的直接依赖。

### 12. 设计统一门面与能力分组

**状态**：已完成（循环 3）。`VolcengineSpeechClient` 已聚合 `audioGeneration`、`ttsStreaming`、`realtime`、`podcast`、`memo`、`voice` 能力分组，并导出 protocol/errors 共享层。

**目标**：让调用方既能使用低层 client，也能通过统一门面发现能力。

**范围**：在 `VolcengineSpeechClient` 中聚合 `audioGeneration`、`ttsStreaming`、`realtime`、`podcast`、`memo`、`voice`；保持子 client 可单独测试；导出稳定 public types；约定旧模块未来只依赖门面或共享子层，不反向依赖旧模块。

**不做**：不把所有方法塞进一个超大 client；不隐藏必要的协议级控制能力；不让统一 client 依赖 `volcengine-tts`、`openspeech`、`streaming-asr`，避免形成循环依赖。

**受益**：常规调用简单，高级场景可下钻，模块可维护性接近现有 `transcode` 的 strategy/client 分层。

### 13. 渐进委托旧模块

**状态**：已完成（循环 8）。已新增 [volcengine-speech-delegation-audit.md](/Users/techwu/Documents/codes/dofe.ai/infra.dofe.ai/docs/0708/volcengine-speech-delegation-audit.md)，明确旧模块可委托项、暂不委托项、前置条件和推荐顺序。

**目标**：在统一 client 稳定后，让旧模块逐步复用统一底座，降低重复实现。

**范围**：评估 `volcengine-tts` 可委托到 `audio-generation` 或 `tts-streaming` 的部分；评估 `openspeech`、`streaming-asr` 可复用 `protocol` 和 `errors` 的部分；每次委托保持原方法签名、返回类型和异常兼容。

**不做**：不批量替换所有旧实现；不改变旧模块导入路径；不在没有测试保护的情况下重写线上路径。

**受益**：新旧入口逐步共享鉴权、错误和协议实现，减少维护成本，同时保留现有业务稳定性。

### 14. 补齐测试与协议样例

**状态**：已完成（循环 5）。当前仓库没有测试框架，已用 typecheck/build 作为验证门槛；已补充 README 中的显式 client 样例，并完成协议层、配置层和 package exports 审查。

**补充状态**：已完成（循环 7）。已新增 `scripts/verify-volcengine-speech.mjs` 与 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech`，在无真实密钥环境下验证 WebSocket codec、错误帧、显式配置和鉴权头。

**目标**：保证 DTO、鉴权、协议编解码、错误映射在无真实密钥环境下可验证。

**范围**：增加单元测试覆盖请求头生成、请求体序列化、WebSocket frame 编解码、错误响应转换；使用 mock `HttpService` 和 mock WebSocket server；为每类能力提供最小调用样例；对旧模块委托增加兼容性测试。

**不做**：不把真实火山密钥放进测试；不依赖公网 API 做默认 CI 测试；不做完整 E2E 压测。

**受益**：第二步实现后可以在本地和 CI 中快速发现协议回归，真实联调只验证供应商连通性。

### 15. 文档、迁移说明与验收清单

**状态**：已完成（循环 4）。已新增 `packages/shared-services/src/volcengine-speech/README.md`，说明导入方式、能力分组、迁移规则和多 ProviderKey 显式工厂。

**补充状态**：已完成（循环 9）。README 已补充音频生成、HTTP 流式 TTS、TTS WebSocket、实时语音、妙记、音色资源和本地验证命令示例。

**补充状态**：已完成（循环 13）。已新增 [volcengine-speech-integration-checklist.md](/Users/techwu/Documents/codes/dofe.ai/infra.dofe.ai/docs/0708/volcengine-speech-integration-checklist.md)，明确真实 API 联调前置配置、样本准备、联调顺序和验收标准。

**目标**：给调用方明确接入方式、配置项和迁移路径。

**范围**：新增 README 或 docs 说明：配置示例、模块导入、非流式/流式/WebSocket 调用示例、错误处理、旧 `volcengine-tts`/`openspeech`/`streaming-asr` 与新模块关系；列出“新调用方优先使用统一 client，旧调用方保持兼容”的迁移指引；列出真实联调前置条件和验收 checklist。

**不做**：不写产品使用手册；不承诺所有历史调用方立即迁移；不在文档中暴露真实密钥；不把旧入口标记为立即废弃。

**受益**：后续实施完成后，上层服务可以按清单接入，维护者也能知道哪些接口已经覆盖、哪些仍需联调。

## 建议实施顺序

1. 先做步骤 1-4，建立骨架、配置、鉴权和错误模型。
2. 再做步骤 5-7，覆盖 TTS 和通用 WebSocket 底座。
3. 然后做步骤 8-10，接入实时语音、播客、妙记这类会话/任务型 API。
4. 再做步骤 11-12，补齐音色资源和统一门面。
5. 最后做步骤 13-15，渐进委托旧模块、补测试和文档。

## 验收标准

- 新增模块可以通过 `@dofe/infra-shared-services/volcengine-speech` 导入。
- `VolcengineSpeechClient` 提供 `audioGeneration`、`ttsStreaming`、`voice`、`realtime`、`podcast`、`memo` 能力分组。
- 无真实密钥时配置缺失报错清晰，mock 测试可通过。
- 每个 API 子能力都有独立 DTO、错误映射、日志上下文和最小调用示例。
- WebSocket 协议实现有 frame 编解码测试，能覆盖正常帧、错误帧、gzip 和 sequence。
- 旧 `volcengine-tts`、`openspeech`、`streaming-asr` public API 不被破坏；如发生委托，兼容性测试覆盖原方法签名和返回结构。

## 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 官方文档字段更新快 | DTO 与真实 API 不一致 | 实施时以最新文档再次校验，并保留原始响应字段 |
| WebSocket 协议差异较多 | 端到端实时、播客、TTS 无法完全复用 codec | codec 只抽公共二进制/压缩/sequence，业务事件解析放子 client |
| 新旧控制台鉴权并存 | 调用方配置复杂 | 默认新版 `X-Api-Key`，旧版鉴权需显式配置 |
| 真实 API 依赖密钥和配额 | CI 无法 E2E | CI 使用 mock；真实联调放手动 checklist |
| 旧模块已有相似能力 | 重复实现或迁移冲突 | 新模块先旁路新增，后续单独规划迁移 |
| 统一 client 过早承载旧路径 | 回归面过大 | 第一阶段只承载新增能力；旧模块委托必须逐个能力评估并补测试 |

## 真实联调待确认问题

以下问题不阻塞当前 shared-services SDK 层实现，需在具备真实火山 API Key、配额、样本资源和上层业务落地方案后确认：

- 真实生产优先使用新版 `X-Api-Key`，还是需要同时兼容旧版 appId/accessKey？
- 音频生成结果是否由 shared-services 直接落 TOS，还是只返回 Base64/URL 给调用方？
- WebSocket 会话是否需要跨请求长连接复用，还是每次调用创建独立 session？
- 妙记和播客结果是否需要由上层业务负责持久化？

## 实施循环记录

| 循环 | 实施 | 文档标注 | 审查待实施项 | 验证 |
| --- | --- | --- | --- | --- |
| 1 | 新增统一模块骨架、配置解析、鉴权头、错误模型、HTTP transport 和顶层导出 | 标注步骤 1-4 已完成 | 下一轮实施音频生成、HTTP 流式、voice/memo 任务型 HTTP client | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck` |
| 2 | 新增音频生成、HTTP 流式 TTS、voice 资源、memo 任务型 HTTP client，并挂到统一门面 | 标注步骤 5、6、10、11 已完成 | 下一轮实施 WebSocket codec、实时语音和播客会话 client | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck` |
| 3 | 新增 WebSocket codec/session、TTS WebSocket、实时语音、播客会话 client，并补齐统一门面能力分组 | 标注步骤 7、8、9、12 已完成 | 下一轮补显式工厂、导出路径、构建产物验证和 package exports | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck` |
| 4 | 新增显式工厂 `createVolcengineSpeechClient`、模块 README 和迁移说明 | 阶段性标注步骤 14，标注步骤 15 已完成 | 下一轮执行构建、审查导出与实现缺口，并修复发现的问题 | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck` 与 `pnpm --filter @dofe/infra-shared-services build` |
| 5 | 审查并修复显式配置读取、WebSocket error handler、codec payload 长度校验；确认 package exports 包含 `volcengine-speech` 全部入口 | 标注步骤 14 已完成 | 本轮计划项全部闭环；旧模块委托留作后续兼容迁移，不在本阶段强改 | 已通过最终 `pnpm --filter @dofe/infra-shared-services typecheck` 与 `pnpm --filter @dofe/infra-shared-services build` |
| 6 | 实现 transport retry：复用 `maxRetries`，对 5xx/网络中断/超时/可重试火山错误做指数退避 | 标注步骤 3 补充完成 | 下一轮补协议与错误映射的无密钥 smoke 验证脚本 | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck` |
| 7 | 新增 `verify-volcengine-speech` smoke 脚本，验证 codec encode/decode、错误帧、显式配置解析和鉴权头生成 | 标注步骤 14 补充完成 | 下一轮补旧模块委托评估文档，明确哪些能委托、哪些不能立即委托 | 已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` |
| 8 | 新增旧模块委托评估文档，拆分 `volcengine-tts`、`openspeech`、`streaming-asr` 的可委托/暂不委托项 | 标注步骤 13 已完成 | 下一轮补 README 能力示例和真实联调 checklist | 文档变更，无需运行代码验证 |
| 9 | 扩充 `volcengine-speech/README.md`，补齐各能力最小调用示例和本地验证命令 | 标注步骤 15 补充完成 | 下一轮最终深度审查，修正文档状态并执行完整验证 | 已在循环 10 统一验证 |
| 10 | 深度审查代码与文档，清理未使用参数，修正文档验证状态，确认 `auth/defaults/protocol` 纯模块 smoke 验证可在无 Prisma client 环境运行 | 标注循环记录全部闭环 | 本轮后续实施项闭环；真实火山 API 联调需生产密钥与配额 | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck`、`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech`、`git diff --check` |
| 11 | 新增 `validation` 纯模块，接入音频生成 reference 校验和妙记任务输入校验，并补 smoke 失败路径断言 | 标注步骤 5、10 补充完成 | 下一轮补 WebSocket request options，支持 request id/自定义 header 传入会话 | 已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` |
| 12 | 为 `VolcengineWebSocketSession` 和 TTS/realtime/podcast connect 入口接入 request options，支持 request id 与自定义 header | 标注步骤 7 补充完成 | 下一轮补 voice/memo endpoint/action 文档与真实联调 checklist | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck` |
| 13 | 新增真实火山 API 联调 checklist，覆盖配置、样本、调用顺序、错误和日志验收 | 标注步骤 15 补充完成 | 下一轮补 smoke 脚本对 legacy auth、validation 成功路径和 WebSocket request options 的覆盖 | 文档变更，无需运行代码验证 |
| 14 | 扩展 smoke 脚本，覆盖 legacy 鉴权头、自定义 header 合并和 validation 成功路径 | 标注步骤 14 补充完成 | 下一轮最终审查所有新增代码/文档并跑完整验证 | 已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` |
| 15 | 深度审查代码与文档，确认无未闭环状态，验证 typecheck、smoke、exports 和 diff whitespace | 标注循环 11-15 全部闭环 | 后续只剩真实火山 API 联调和旧模块逐项委托迁移 | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck`、`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech`、`git diff --check` |
| 16 | 修复 HTTP JSON 业务错误 retry：将 `assertVolcengineSpeechSuccess` 纳入 retry operation，并补大小写 header 读取 | 标注步骤 3 补充完成 | 下一轮补音频参数范围校验，避免文档范围外参数直达 API | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck` |
| 17 | 增加 `audio_config` 运行时范围校验，覆盖 format、sample_rate、speech_rate、loudness_rate、pitch_rate，并补 smoke 失败断言 | 标注步骤 5 补充完成 | 下一轮补 retry/header 行为 smoke 覆盖和文档验证状态 | 已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` |
| 18 | 扩展 smoke 脚本，覆盖可重试火山错误码分类和 `VolcengineSpeechError.retryable` 推导 | 标注步骤 4 补充完成 | 下一轮收紧错误/结果对象的非必要 any 类型 | 已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` |
| 19 | 收紧 config、memo、errors 中的非必要 any 为 `unknown`，并补供应商任务结果字段的安全字符串读取 | 标注步骤 4、10 的类型边界补强完成 | 下一轮做最终深度审查，清理未闭环状态并执行完整验证 | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck` |
| 20 | 深度审查新增代码与文档，清理历史审查噪音，确认无未闭环状态、无非必要 any、无 whitespace 问题 | 标注循环 16-20 全部闭环 | 后续只剩真实火山 API 联调和旧模块逐项委托迁移 | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck`、`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech`、`git diff --check` |
| 21 | 统一 HTTP JSON 与 stream 响应的 `X-Tt-Logid` 读取，支持大小写变化和 AxiosHeaders `.get()` | 标注步骤 3、4 的日志追踪补强完成 | 下一轮补 memo/voice 入参校验，避免空 task/action 直达供应商 API | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck` |
| 22 | 增加共享必填字符串校验，拦截空 `memo.queryTask` taskId、空 voice action 和空 voice training taskId，并补 smoke 断言 | 标注步骤 10、11 的入参边界补强完成 | 下一轮硬化鉴权 header 合并，避免调用方自定义 header 覆盖认证与 request id | 已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` |
| 23 | 将认证、resource id 与 request id 设为保留 header，自定义 header 仅允许补充非保留字段，并补 smoke 防覆盖断言 | 标注步骤 3 的鉴权安全补强完成 | 下一轮补 WebSocket 连接超时和失败清理，避免连接阶段悬挂 | 已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` |
| 24 | 为 WebSocket `connect()` 增加连接超时、失败清理和主动关闭，复用 request options timeout 或统一配置 timeout | 标注步骤 7、8、9 的会话生命周期补强完成 | 下一轮补文档中的真实联调待确认事项状态，执行最终审查与完整验证 | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck` |
| 25 | 将待确认问题改标为真实联调阶段事项，合并重复 import，并执行最终代码/文档审查 | 标注循环 21-25 全部闭环 | 后续只剩真实火山 API 联调和旧模块逐项委托迁移 | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck`、`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech`、`git diff --check` |
| 26 | 配置解析阶段校验 `timeoutMs` 为正数、`maxRetries` 为非负整数，并补 smoke 非法配置断言 | 标注步骤 3 的配置边界补强完成 | 下一轮统一 validation 错误类型，便于调用方区分本地入参错误与供应商错误 | 已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` |
| 27 | 新增 `VolcengineSpeechValidationError`，并让本地 validation 抛出专用错误类型，保留字段名用于调用方定位 | 标注步骤 4、14 的错误模型与测试补强完成 | 下一轮补 WebSocket send 回调错误处理，避免异步发送失败只落到全局 error | 已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` |
| 28 | 封装 WebSocket `sendFrame`，让 init、JSON 和 audio 帧发送失败统一回调 `onError` | 标注步骤 7、8、9 的发送错误处理补强完成 | 下一轮补 README 的保留 header、timeout/retry 和 validation error 说明 | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck` |
| 29 | README 增加 request options、保留 header、timeout/retry 和 validation/upstream 错误类型说明，并清理示例日志调用 | 标注步骤 15 的调用方文档补强完成 | 下一轮执行最终深度审查、smoke/typecheck/whitespace 验证并清理未闭环标记 | 文档变更，无需运行代码验证 |
| 30 | 深度审查代码与文档，清理审查噪音，确认循环 26-30 的实现、文档标注和验证状态一致 | 标注循环 26-30 全部闭环 | 后续只剩真实火山 API 联调和旧模块逐项委托迁移 | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck`、`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech`、`git diff --check` |
| 31 | 配置解析阶段校验所有 endpoint 为非空绝对 URL，并限制协议为 http/https/ws/wss，补 smoke 非法 endpoint 断言 | 标注步骤 3 的 endpoint 配置边界补强完成 | 下一轮校验 per-request options，避免请求级 timeout 或 request id 为空 | 已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` |
| 32 | 增加 request options 校验，拦截空 requestId、非正 timeoutMs 和空自定义 header 名，并接入统一 header 构造 | 标注步骤 3、14 的请求级配置和 smoke 覆盖补强完成 | 下一轮补 WebSocket close 后状态清理，避免关闭后误复用旧连接引用 | 已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` |
| 33 | WebSocket close 事件后清理当前连接引用，避免关闭后误复用旧 ws 对象 | 标注步骤 7、8、9 的会话状态管理补强完成 | 下一轮同步 README/checklist 中 endpoint、request options 与 close 后行为说明 | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck` |
| 34 | README 和真实联调 checklist 同步 endpoint 约束、request options 约束和 WebSocket close 后不可复用说明 | 标注步骤 15 的调用方文档补强完成 | 下一轮最终审查所有新增代码/文档并执行完整验证 | 文档变更，无需运行代码验证 |
| 35 | endpoint URL 解析失败时抛出带字段名的配置错误，并补 smoke 覆盖非 URL 输入 | 标注步骤 3、14 的配置错误可诊断性补强完成 | 后续只剩真实火山 API 联调和旧模块逐项委托迁移 | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck`、`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech`、`git diff --check` |
| 36 | 新增 `normalizeVolcengineHttpError`/`isRetryableHttpStatus`，将 axios 形态 HTTP/网络错误统一归一化为 `VolcengineSpeechError`，接入 transport retry 并清理冗余 `isRetryableError` 分支 | 标注步骤 4 的 HTTP 错误归一化补强完成 | 下一轮修正妙记任务结果把成功 `message` 误判为 `error` 的映射 | 已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` |
| 37 | 抽出纯模块 `memo/memo.normalizer.ts`，修正任务结果错误映射，避免成功 `message` 被误判为错误，并补 smoke 成功/失败/显式错误路径 | 标注步骤 10 的任务结果错误映射补强完成 | 下一轮补 WebSocket session 可观测性，提供 `isOpen()` 等查询能力 | 已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` |
| 38 | 为 `VolcengineWebSocketSession` 新增 `isOpen()`，并由 `assertOpen` 复用，便于调用方在发送前判断会话状态 | 标注步骤 7 的会话可观测性补强完成 | 下一轮收紧 request options 自定义 header 值校验 | 已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` |
| 39 | `validateRequestOptions` 扩展到自定义 header 值校验，拦截空字符串与非字符串值，并补 smoke 成功/失败路径 | 标注步骤 3 的 request options 边界补强完成 | 下一轮最终深度审查、同步 README/checklist 并执行完整验证 | 已通过 `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech` |
| 40 | 深度审查循环 36-39 的实现，抽纯模块 `memo.normalizer`、HTTP 错误归一化、`isOpen()` 与 header 值校验；同步 README 与联调 checklist | 标注循环 36-40 全部闭环 | 后续只剩真实火山 API 联调和旧模块逐项委托迁移 | 已通过 `pnpm --filter @dofe/infra-shared-services typecheck`、`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech`、`git diff --check` |
