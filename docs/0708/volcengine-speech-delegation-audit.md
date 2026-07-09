# Volcengine Speech Delegation Audit

日期：2026-07-08（循环 8 初稿）/ 2026-07-09（循环 42 据实复核、循环 51-52 推进、循环 56-59 推进 config/retry）

## 结论

旧模块逐项委托以“不改 public 方法签名、不改返回结构、不改异常语义、不引入无测试保护的线上行为变更”为硬约束。本轮据实复核三个旧模块后：

- `openspeech` 的出站帧编码已委托到统一 `VolcengineWebSocketCodec`（循环 41，逐字节结构一致，零行为变更）。
- `streaming-asr` 无自有火山协议代码，复用 `openspeech` 的 `VolcengineStreamingAsrProvider`，自动继承循环 41 的委托。
- `volcengine-tts` 已完成：完成码常量复用（循环 42）、`X-Tt-Logid` 捕获委托（循环 51）、请求体与 NDJSON 归约抽纯（循环 44/52）、认证头委托（循环 53-54，核心 api-key/resource-id 逻辑已共享）、runtime config 校验委托（循环 57）与显式开启的 HTTP retry 委托（循环 59，默认 0 次重试保持兼容）；NDJSON+TOS 主链路仍需测试保护后再评估进一步委托。

## 已完成委托

### `openspeech` — WebSocket 出站帧编码（循环 41）

- 已委托：`VolcengineStreamingAsrProvider.buildFullClientRequest` / `buildAudioOnlyRequest` 改为调用统一 `VolcengineWebSocketCodec.encodeJsonRequest` / `encodeAudioRequest`，移除内联 `buildMessageHeader`、`gzipAsync` 与未再使用的 `SERIALIZATION` 常量。
- 等价性：统一编解码器本就参考该 provider 的二进制头/gzip/sequence 写法实现；委托后帧结构（4 字节协议头 + payload size + gzip payload，`NO_SEQUENCE`，无 sequence 字段）与历史内联实现一致，已用 smoke 断言固定帧头字节契约（`0x11 0x10 0x11 0x00` 初始帧、`0x11 0x20/0x22 0x01 0x00` 音频帧）。
- 保留：`parseServerResponse`（服务端响应解析，含 10MB payload / 1MB error size 校验、友好中文错误信息、ASR 结果与说话人分离归一化）。统一 codec 只覆盖公共二进制/压缩/sequence，业务事件解析留在子 client。

### `streaming-asr` — 经 provider 继承（循环 41）

- 该服务是 `VolcengineStreamingAsrProvider` 的编排层，自身不做火山二进制协议编解码、错误码映射或 HTTP 调用；其 `StreamingSessionStatus` 复用 `openspeech/types`。因此无需独立委托点，自动受益于循环 41。

### `volcengine-tts` — 完成码常量复用（循环 42）

- 已委托：流式响应处理中 `data.code === 20000000` 的完成信号判定改用统一 `VOLCENGINE_SPEECH_SUCCESS_CODE`，消除魔法数字并建立 `volcengine-tts → volcengine-speech` 的允许方向依赖。数值与类型不变，零行为变更。

### `volcengine-tts` — `X-Tt-Logid` 捕获委托（循环 51）

- 已委托：`executeTtsRequest` 的 logId 读取从直取 `response.headers["x-tt-logid"]` 改为共享 `readVolcengineHeader(response.headers, "x-tt-logid")`，大小写不敏感且兼容 axios v1 的 AxiosHeaders（`.get()`）。
- 行为影响：原直取在 axios v1 AxiosHeaders 实例上可能取到 `undefined`（导致 TOS 文件名落 `unknown`）；委托后能稳定捕获 logId。这是日志/TOS 对象 key 的可观测改进，不改变合成主链路语义，`processStreamResponse` 的 `logId` 形参相应放宽为 `string | undefined`。

### `volcengine-tts` — 认证头委托（循环 53-54）

- 从统一 `buildVolcengineSpeechHeaders` 抽出 `buildVolcengineAuthHeaders`（纯函数），只负责 `X-Api-Key`（api-key 模式）或 `X-Api-App-Id` + `X-Api-Access-Key`（legacy）及可选 `X-Api-Resource-Id`；不含 `Content-Type`、自定义 header、`X-Api-Request-Id`。
- `volcengine-tts.buildHeaders` 改用 `buildVolcengineAuthHeaders` 生成认证头，`Connection: keep-alive` 与 `Content-Type` 仍由旧 client 自管（非完整统一请求头形状，但认证逻辑已收敛）。
- 行为差异：header key 大小写从 `x-api-key` 变为 `X-Api-Key`（HTTP 不区分大小写，语义不变）。不新增 `X-Api-Request-Id`，不删除 `Connection`。已纳入无密钥 smoke（api-key / legacy）。

### `volcengine-tts` — 测试保护（循环 44、52）

- 已抽出纯模块并纳入无密钥 smoke：`tts-stream-reducer.ts`（NDJSON 归约，`reduceTtsChunk`/`createTtsChunkReducerState`，并修复完成码缓冲区误判）、`tts-payload.ts`（请求体构造，`buildTtsPayload`/`TTS_DEFAULT_MODEL`）。默认 speaker 的随机解析（依赖 OpenAPI）仍留在 client 内。

### `volcengine-tts` — config/retry 委托（循环 56-59）

- config：统一 speech 配置校验 helper 已导出为 `normalizeVolcengineEndpoint`、`normalizeVolcenginePositiveNumber`、`normalizeVolcengineNonNegativeInteger`；旧 TTS 新增 `tts-config.ts` 复用这些 helper 归一化 endpoint、timeout 和 maxRetries。
- retry：统一 `executeVolcengineRetry` / `getVolcengineRetryDelayMs` 已从 `VolcengineSpeechTransport` 抽成共享 helper，旧 TTS 的 HTTP 请求阶段复用该 helper 和 `normalizeVolcengineHttpError`。
- 兼容性：旧 TTS 默认 `maxRetries=0`，未显式配置时保持历史“无重试”；仅当 `maxRetries` 或 `retryCount` 显式配置时才重试。`timeoutMs/timeout` 也仅在显式配置时传给 HTTP 请求。

## 暂不委托（需测试保护）

`volcengine-tts` 的下列项经复核判定为“委托会改变线上行为”，在引入无密钥兼容测试或真实联调回归保护前不动：

| 候选项 | 行为差异（委托后会改变） | 风险 |
| --- | --- | --- |
| NDJSON 流式 + TOS 上传 | 统一 `ttsStreaming` 只返回裸流，不解析行分隔 JSON、不上传 TOS | 主合成链路语义不同，非“底层委托”而是行为重写 |

`openspeech` / `streaming-asr` 的下列项同样保留：

- ASR 结果归一化、说话人分离字段映射、重连缓冲与心跳、SSE 事件、会话生命周期、会议记录、音频保存：均属业务编排，非共享底座职责。

## 委托前置条件（不变）

- 每个旧方法保留原方法签名、返回字段和异常语义。
- 每个委托点至少有一个无真实密钥的兼容 smoke 验证，或真实联调回归保护。
- 委托只能依赖 `volcengine-speech` 的 `auth`、`errors`、`protocol` 或能力子 client，不能让统一 client 反向依赖旧模块。
- 任何涉及 TOS 落盘、数据库、会议记录或历史 DTO 的路径单独评估，不批量替换。

## 后续推荐

1. 为 `volcengine-tts` 的 HTTP 调用增加 mock `HttpService` + mock TOS 兼容测试，覆盖显式 `maxRetries` 的真实重试次数、非重试 4xx、TOS 上传成功/失败路径（注意 client 经 `@dofe/infra-common` 间接依赖 `@prisma/client`，mock smoke 需先 `prisma generate` 或继续以纯模块方式覆盖）。
2. 真实火山 API 联调稳定后，评估 `openspeech` 的 `parseServerResponse` 是否在保留 size 校验前提下部分复用统一 `decode`。
3. `streaming-asr` 暂无独立委托点；其底层复用随 `openspeech` provider 推进而收敛。
