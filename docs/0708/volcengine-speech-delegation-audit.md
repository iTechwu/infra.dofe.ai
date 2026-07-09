# Volcengine Speech Delegation Audit

日期：2026-07-08（循环 8 初稿）/ 2026-07-09（循环 42 据实复核）

## 结论

旧模块逐项委托以“不改 public 方法签名、不改返回结构、不改异常语义、不引入无测试保护的线上行为变更”为硬约束。本轮据实复核三个旧模块后：

- `openspeech` 的出站帧编码已委托到统一 `VolcengineWebSocketCodec`（循环 41，逐字节结构一致，零行为变更）。
- `streaming-asr` 无自有火山协议代码，复用 `openspeech` 的 `VolcengineStreamingAsrProvider`，自动继承循环 41 的委托。
- `volcengine-tts` 仅完成零风险的完成码常量复用（循环 42）；其余候选项经复核均会改变线上行为，需测试保护后再委托。

## 已完成委托

### `openspeech` — WebSocket 出站帧编码（循环 41）

- 已委托：`VolcengineStreamingAsrProvider.buildFullClientRequest` / `buildAudioOnlyRequest` 改为调用统一 `VolcengineWebSocketCodec.encodeJsonRequest` / `encodeAudioRequest`，移除内联 `buildMessageHeader`、`gzipAsync` 与未再使用的 `SERIALIZATION` 常量。
- 等价性：统一编解码器本就参考该 provider 的二进制头/gzip/sequence 写法实现；委托后帧结构（4 字节协议头 + payload size + gzip payload，`NO_SEQUENCE`，无 sequence 字段）与历史内联实现一致，已用 smoke 断言固定帧头字节契约（`0x11 0x10 0x11 0x00` 初始帧、`0x11 0x20/0x22 0x01 0x00` 音频帧）。
- 保留：`parseServerResponse`（服务端响应解析，含 10MB payload / 1MB error size 校验、友好中文错误信息、ASR 结果与说话人分离归一化）。统一 codec 只覆盖公共二进制/压缩/sequence，业务事件解析留在子 client。

### `streaming-asr` — 经 provider 继承（循环 41）

- 该服务是 `VolcengineStreamingAsrProvider` 的编排层，自身不做火山二进制协议编解码、错误码映射或 HTTP 调用；其 `StreamingSessionStatus` 复用 `openspeech/types`。因此无需独立委托点，自动受益于循环 41。

### `volcengine-tts` — 完成码常量复用（循环 42）

- 已委托：流式响应处理中 `data.code === 20000000` 的完成信号判定改用统一 `VOLCENGINE_SPEECH_SUCCESS_CODE`，消除魔法数字并建立 `volcengine-tts → volcengine-speech` 的允许方向依赖。数值与类型不变，零行为变更。

## 暂不委托（需测试保护）

`volcengine-tts` 的下列项在本轮复核中均判定为“委托会改变线上行为”，在引入无密钥兼容测试或真实联调回归保护前不动：

| 候选项 | 行为差异（委托后会改变） | 风险 |
| --- | --- | --- |
| 鉴权头生成 | 统一 `buildVolcengineSpeechHeaders` 会新增 `X-Api-Request-Id`、改变 key 大小写、去掉 `Connection: keep-alive` | 请求头集合变化，服务器侧行为未在无密钥环境验证 |
| 显式配置解析 | 统一 `VolcengineSpeechConfig` 形状与 `VolcengineTtsConfig`（含 TOS、bucket、secretKey）不一致 | 配置字段映射重写，影响初始化与 TOS |
| HTTP 请求重试 | 现实现无重试；统一 transport 有 `maxRetries` 指数退避 | 流式 TTS 请求在连接阶段失败时会重发，计费与首包时序变化 |
| `X-Tt-Logid` 捕获 | 改为大小写不敏感读取可能从原本取不到变为取到 | `logId` 进入 TOS 对象 key（文件名），可观测的存储路径变化 |
| NDJSON 流式 + TOS 上传 | 统一 `ttsStreaming` 只返回裸流，不解析行分隔 JSON、不上传 TOS | 主合成链路语义不同，非“底层委托”而是行为重写 |

`openspeech` / `streaming-asr` 的下列项同样保留：

- ASR 结果归一化、说话人分离字段映射、重连缓冲与心跳、SSE 事件、会话生命周期、会议记录、音频保存：均属业务编排，非共享底座职责。

## 委托前置条件（不变）

- 每个旧方法保留原方法签名、返回字段和异常语义。
- 每个委托点至少有一个无真实密钥的兼容 smoke 验证，或真实联调回归保护。
- 委托只能依赖 `volcengine-speech` 的 `auth`、`errors`、`protocol` 或能力子 client，不能让统一 client 反向依赖旧模块。
- 任何涉及 TOS 落盘、数据库、会议记录或历史 DTO 的路径单独评估，不批量替换。

## 后续推荐

1. 为 `volcengine-tts` 的鉴权头与 HTTP 调用增加无密钥兼容 smoke（mock `HttpService` + mock TOS），再评估鉴权头与 `X-Tt-Logid` 委托。
2. 真实火山 API 联调稳定后，评估 `openspeech` 的 `parseServerResponse` 是否在保留 size 校验前提下部分复用统一 `decode`。
3. `streaming-asr` 暂无独立委托点；其底层复用随 `openspeech` provider 推进而收敛。
