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

新增能力建议放在 `packages/shared-services/src/volcengine-speech`，作为火山语音大模型统一入口；保留已有 `volcengine-tts`、`openspeech`、`streaming-asr` 的兼容导出，后续可逐步迁移到统一 client。内部按能力拆分为 `audio-generation`、`tts-streaming`、`voice`、`realtime`、`podcast`、`memo`、`protocol`、`errors`。

鉴权优先支持新版控制台 `X-Api-Key`；兼容旧版 `X-Api-App-Id` + `X-Api-Access-Key` 时通过显式配置开启。HTTP 统一基于 `HttpModule`，WebSocket 统一基于 `ws`，协议编解码参考现有 `openspeech/providers/volcengine-streaming.provider.ts` 的二进制头、gzip、sequence、session 管理写法。

## 执行计划

### 1. 梳理现有边界与兼容入口

**目标**：确认 `shared-services` 中已有火山相关能力的复用点，定义新模块与旧模块的关系。

**范围**：阅读 `volcengine-tts`、`openspeech`、`streaming-asr`、`transcode/modules/volcengine-tos` 的 config、client、module、DTO、导出方式；形成新目录命名、公共类型命名、导出路径约定。

**不做**：不删除或重命名现有 public API；不迁移调用方；不改配置文件结构。

**受益**：第二步实施时不会破坏已有 TTS、ASR、转码调用方，也能沿用项目已有的 NestJS DI 和 fail-fast 配置风格。

### 2. 建立 `volcengine-speech` 模块骨架

**目标**：新增统一的火山豆包语音模块，提供稳定的 Client/Module/Factory 基础。

**范围**：创建 `volcengine-speech.module.ts`、`volcengine-speech.client.ts`、`volcengine-speech.factory.ts`、`index.ts`、`types.ts`、`dto/`、`config/`；接入 `ConfigModule`、`HttpModule`、`WINSTON_MODULE_PROVIDER`；在 `packages/shared-services/src/index.ts` 中导出。

**不做**：不实现具体接口请求；不引入业务层概念；不写数据库持久化。

**受益**：后续每个 API 能力可以作为小步提交接入，公共鉴权、日志、错误处理不会重复散落。

### 3. 实现配置与鉴权模型

**目标**：支持新版/旧版控制台鉴权、默认 endpoint、请求追踪 ID 和多账号显式注入。

**范围**：定义 `VolcengineSpeechConfig`，包含 `apiKey`、`appId`、`accessKey`、`resourceId`、`region`、HTTP endpoint、WebSocket endpoint、timeout、retry；实现 DI 配置解析和 `create(config, deps)` 显式工厂；请求头统一生成 `X-Api-Key`、`X-Api-Request-Id` 或旧版双头。

**不做**：不在 shared-services 内读取数据库 ProviderKey；不把密钥写入日志；不做自动密钥轮换。

**受益**：能同时服务当前 keys/config.json 场景和 models.dofe.ai 这类多 ProviderKey 场景，避免多账号串扰。

### 4. 建立错误码与响应标准化

**目标**：把官方错误码文档沉淀为共享错误模型，统一 HTTP/WebSocket 错误抛出形态。

**范围**：新增 `volcengine-speech.errors.ts`，定义错误码枚举、错误分类、可重试判断、`X-Tt-Logid`/request id 捕获；为 HTTP 响应体中的 `code/message` 和 WebSocket error frame 提供标准转换。

**不做**：不吞掉原始错误响应；不把所有错误统一成 `BadGatewayException`；不做用户可见文案国际化。

**受益**：调用方可以基于统一异常判断重试、降级、告警，排查时也能拿到火山侧 log id。

### 5. 接入音频生成 HTTP

**目标**：实现非流式音频生成接口，覆盖纯文本、参考音频、参考图片三种生成模式。

**范围**：按文档实现 `POST /api/v3/tts/create` client 方法；DTO 支持 `model`、`text_prompt`、`references`、`speaker/audio_data/audio_url/image_data/image_url`、`audio_config`、`watermark`；返回 Base64 音频、临时 URL、duration、original_duration、subtitle。

**不做**：不负责上传参考资源到对象存储；不持久化返回音频；不突破文档限制，例如 120 秒输出、参考音频数量/大小/格式限制。

**受益**：业务层可以直接调用豆包新一代音频生成能力，替代只支持传统 TTS 的窄接口。

### 6. 接入单向流式语音合成 HTTP

**目标**：实现面向边生成边播放的单向流式 TTS 能力。

**范围**：实现 HTTP streaming 请求封装，输出 Node.js `Readable` 或 async iterator；支持 speaker、文本、音频格式、采样率、语速、音量、音调等参数；补齐超时、中断、日志和错误转换。

**不做**：不实现浏览器端播放器；不把流式响应强制缓存成文件；不和非流式接口共用不兼容的返回类型。

**受益**：调用方可以在服务端转发或消费音频流，降低首包延迟，适合对话和实时播报场景。

### 7. 接入语音合成 WebSocket 协议

**目标**：实现 WebSocket 语音合成协议的连接、请求、分包响应和关闭流程。

**范围**：复用现有 streaming provider 的协议思路，抽出 `protocol/websocket-codec.ts`；支持 gzip/JSON、sequence、session id、二进制帧解析、错误帧处理；提供 `connectTtsSession`、`sendText`、`close` 等低层能力。

**不做**：不在本步骤包装成高层业务会话编排；不实现端侧播放；不做跨进程连接池。

**受益**：为后续实时 TTS、播客和端到端实时语音大模型提供统一 WebSocket 底座，减少协议实现重复。

### 8. 接入端到端实时语音大模型 API

**目标**：提供实时语音输入、模型理解、语音输出的一体化会话 client。

**范围**：按文档实现实时会话配置、音频输入帧发送、服务端事件解析、文本/音频增量结果回调、会话中断与关闭；定义 `RealtimeSpeechSession`、callbacks、状态机和重连/超时策略。

**不做**：不实现前端麦克风采集；不做业务对话状态存储；不默认开启自动重连导致重复计费，重连策略由调用方显式开启。

**受益**：业务层可接入真正端到端的实时语音模型，而不是自行拼 ASR + LLM + TTS 三段链路。

### 9. 接入播客 API WebSocket v3

**目标**：实现播客生成协议的低层 client 和结果事件模型。

**范围**：按 v3 WebSocket 协议实现会话创建、脚本/角色/音色/风格参数发送、生成进度事件、音频片段或成品地址解析；复用 WebSocket codec 和错误模型。

**不做**：不提供播客脚本创作逻辑；不做音频拼接后处理；不持久化播客工程。

**受益**：上层可以基于统一接口编排播客生成流程，shared-services 负责协议可靠性和火山侧字段适配。

### 10. 接入豆包语音妙记 API

**目标**：实现语音妙记相关任务提交、查询和结果解析。

**范围**：根据文档定义妙记任务 DTO，支持音频 URL/资源引用、任务创建、状态查询、转写/摘要/章节/要点等结构化结果映射；按错误码文档处理失败原因。

**不做**：不实现会议业务模型；不做文件上传和权限校验；不把妙记结果写入数据库。

**受益**：视频、会议、播客等业务可以复用一套“长音频理解/整理”能力，而不需要各自直连火山 API。

### 11. 接入音色与声音资源 API

**目标**：覆盖文档中音色查询、训练、管理、声音设计等资源型 API。

**范围**：实现 `voice` 子 client，提供音色列表/详情、训练任务创建、训练状态查询、资源删除或更新、声音设计相关请求；DTO 明确 speaker id、voice id、task id、参考音频、状态枚举。

**不做**：不在 shared-services 中保存音色资产元数据；不实现审核流程 UI；不封装业务定价或配额。

**受益**：TTS、音频生成、播客、实时语音可以共享同一套音色管理能力，减少调用方对不同文档字段的直接依赖。

### 12. 设计统一门面与能力分组

**目标**：让调用方既能使用低层 client，也能通过统一门面发现能力。

**范围**：在 `VolcengineSpeechClient` 中聚合 `audioGeneration`、`ttsStreaming`、`realtime`、`podcast`、`memo`、`voice`；保持子 client 可单独测试；导出稳定 public types。

**不做**：不把所有方法塞进一个超大 client；不隐藏必要的协议级控制能力。

**受益**：常规调用简单，高级场景可下钻，模块可维护性接近现有 `transcode` 的 strategy/client 分层。

### 13. 补齐测试与协议样例

**目标**：保证 DTO、鉴权、协议编解码、错误映射在无真实密钥环境下可验证。

**范围**：增加单元测试覆盖请求头生成、请求体序列化、WebSocket frame 编解码、错误响应转换；使用 mock `HttpService` 和 mock WebSocket server；为每类能力提供最小调用样例。

**不做**：不把真实火山密钥放进测试；不依赖公网 API 做默认 CI 测试；不做完整 E2E 压测。

**受益**：第二步实现后可以在本地和 CI 中快速发现协议回归，真实联调只验证供应商连通性。

### 14. 文档、迁移说明与验收清单

**目标**：给调用方明确接入方式、配置项和迁移路径。

**范围**：新增 README 或 docs 说明：配置示例、模块导入、非流式/流式/WebSocket 调用示例、错误处理、旧 `volcengine-tts` 与新模块关系；列出真实联调前置条件和验收 checklist。

**不做**：不写产品使用手册；不承诺所有历史调用方立即迁移；不在文档中暴露真实密钥。

**受益**：后续实施完成后，上层服务可以按清单接入，维护者也能知道哪些接口已经覆盖、哪些仍需联调。

## 建议实施顺序

1. 先做步骤 1-4，建立骨架、配置、鉴权和错误模型。
2. 再做步骤 5-7，覆盖 TTS 和通用 WebSocket 底座。
3. 然后做步骤 8-10，接入实时语音、播客、妙记这类会话/任务型 API。
4. 最后做步骤 11-14，补齐音色资源、统一门面、测试和文档。

## 验收标准

- 新增模块可以通过 `@dofe/infra-shared-services/volcengine-speech` 导入。
- 无真实密钥时配置缺失报错清晰，mock 测试可通过。
- 每个 API 子能力都有独立 DTO、错误映射、日志上下文和最小调用示例。
- WebSocket 协议实现有 frame 编解码测试，能覆盖正常帧、错误帧、gzip 和 sequence。
- 旧 `volcengine-tts`、`openspeech`、`streaming-asr` public API 不被破坏。

## 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 官方文档字段更新快 | DTO 与真实 API 不一致 | 实施时以最新文档再次校验，并保留原始响应字段 |
| WebSocket 协议差异较多 | 端到端实时、播客、TTS 无法完全复用 codec | codec 只抽公共二进制/压缩/sequence，业务事件解析放子 client |
| 新旧控制台鉴权并存 | 调用方配置复杂 | 默认新版 `X-Api-Key`，旧版鉴权需显式配置 |
| 真实 API 依赖密钥和配额 | CI 无法 E2E | CI 使用 mock；真实联调放手动 checklist |
| 旧模块已有相似能力 | 重复实现或迁移冲突 | 新模块先旁路新增，后续单独规划迁移 |

## 待确认问题

- 真实生产优先使用新版 `X-Api-Key`，还是需要同时兼容旧版 appId/accessKey？
- 音频生成结果是否由 shared-services 直接落 TOS，还是只返回 Base64/URL 给调用方？
- WebSocket 会话是否需要跨请求长连接复用，还是每次调用创建独立 session？
- 妙记和播客结果是否需要由上层业务负责持久化？
