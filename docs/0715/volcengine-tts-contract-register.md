# Volcengine TTS 契约登记册

日期：2026-07-16
状态：P0 执行中。本文是后续类型、endpoint、测试 fixture 和真实联调的唯一协议来源。

## 取证方法

官方页面是客户端渲染应用。2026-07-16 通过该站点自身的只读接口获取每篇文档的当前内容：

```text
GET https://docs.volcengine.com/api/doc/getDocDetail?DocumentID=<文档 ID>
```

下表记录文档的 `UpdatedTime`、标题和可直接从内容中提取的契约。它不是接口响应的
fixture，也不保存 API Key、音频、音色 ID、用户文本或临时 URL。

## 能力契约

| 文档 | 更新时间（UTC） | 传输与 endpoint | 鉴权/追踪 | 本轮实现结论 |
| --- | --- | --- | --- | --- |
| [2550782](https://docs.volcengine.com/docs/6561/2550782?lang=zh) 音频生成 HTTP | 2026-07-13 | `POST https://openspeech.bytedance.com/api/v3/tts/create` | `X-Api-Key` 必填；可选 `X-Api-Request-Id`；响应含 `X-Tt-Logid` | endpoint、`seed-audio-1.0` 与 3000 字文本上限已校验；参考资源限额待 fixture。 |
| [2528925](https://docs.volcengine.com/docs/6561/2528925?lang=zh) 单向流式 HTTP | 2026-07-14 | `POST https://openspeech.bytedance.com/api/v3/tts/unidirectional` | `X-Api-Key`、`X-Api-Resource-Id`；可选 request id/usage header；响应 `X-Tt-Logid` | 现有 endpoint 正确；新增 typed request 和正文响应错误处理。 |
| [2534913](https://docs.volcengine.com/docs/6561/2534913?lang=zh) 单向流式 WebSocket | 2026-07-14 | `wss://openspeech.bytedance.com/api/v3/tts/unidirectional/stream` | `X-Api-Key`、`X-Api-Resource-Id`、可选 request id/usage header | 当前 `ttsWebSocket` 错指双向 endpoint，必须新增专用 endpoint。 |
| [2532486](https://docs.volcengine.com/docs/6561/2532486?lang=zh) 双向流式 WebSocket | 2026-07-14 | `wss://openspeech.bytedance.com/api/v3/tts/bidirection` | `X-Api-Key`、`X-Api-Resource-Id`、`X-Api-Connect-Id` | 现有 endpoint 少了 `ion` 且 API 未建模 `StartConnection`/`StartSession`/`TaskRequest`/结束事件。 |
| [1829010](https://docs.volcengine.com/docs/6561/1829010?lang=zh) 异步长文本 | 2026-07-16 | `POST /api/v3/tts/submit`、`POST /api/v3/tts/query` | `X-Api-App-Id` + 专用 `X-Api-Access-Key` + resource id；响应 `X-Tt-Logid` | 真实 submit/query 已验证。该鉴权独立于 API Key 和 IAM AK/SK，client 必须保留显式 credential 边界。 |
| [2534906](https://docs.volcengine.com/docs/6561/2534906?lang=zh) 音色训练 | 2026-07-08 | `POST https://openspeech.bytedance.com/api/v3/tts/voice_clone` | `X-Api-Key`、可选 request id、响应 log id | 以 typed `train()` 取代字符串 action。 |
| [2535742](https://docs.volcengine.com/docs/6561/2535742?lang=zh) 音色查询 | 2026-07-07 | `POST https://openspeech.bytedance.com/api/v3/tts/get_voice` | `X-Api-Key`、可选 request id、响应 log id | 以 typed `get()` 取代字符串 action。 |
| [2535751](https://docs.volcengine.com/docs/6561/2535751?lang=zh) 音色升级 | 2026-07-07 | `POST https://openspeech.bytedance.com/api/v3/tts/upgrade_voice` | `X-Api-Key`、可选 request id、响应 log id | 以 typed `upgrade()` 取代字符串 action。 |
| [2277844](https://docs.volcengine.com/docs/6561/2277844?lang=zh) 音色设计 | 2026-06-23 | `POST https://openspeech.bytedance.com/api/v3/tts/voice_design` | 文档同时列出新版 API Key 与旧版双头说明，实施前以真实控制台能力确认 | 以 typed `design()` 取代字符串 action；不猜测 body 字段。 |
| [2235883](https://docs.volcengine.com/docs/6561/2235883?lang=zh) 音色管理 | 2026-06-23 | 文档内容按音色管理操作分别定义，不使用 `/api/v3/voice/{action}` 泛型拼接 | 文档同时列出新版 API Key 与旧版双头说明，实施前以真实控制台能力确认 | 旧 `voice.request(action)` 仅保留兼容，禁止作为新 API。 |
| [2534853](https://docs.volcengine.com/docs/6561/2534853?lang=zh) 错误码 | 2026-06-24 | 业务响应 code | 结合 HTTP status、request id、log id | 将已知 code 映射为稳定 category，未知 code 不丢失。 |

## 已验证字段范围

### 统一音频参数

单向 HTTP/WS 和双向 WS 文档共同声明：`speaker`、`text`/`ssml`、`audio_params`、
`additions` 是 TTS 请求域；流式格式推荐 `pcm`，不建议 `wav`。已确认的采样率集合是
`8000`、`16000`、`22050`、`24000`、`32000`、`44100`、`48000`；`speech_rate` 和
`loudness_rate` 范围为 `[-50, 100]`，`post_process.pitch` 范围为 `[-12, 12]`。

### WebSocket 产品事件

- 单向 WS：服务端事件包括 `TTSSentenceStart`、`TTSResponse`、`TTSSentenceEnd`、
  `TTSSubtitle`、`SessionFinished`；响应消息类别为 `FullServerResponse` 或
  `AudioOnlyServer`。
- 双向 WS：客户端事件包括 `StartConnection`、`StartSession`、`TaskRequest`、
  `FinishSession`、`CancelSession`、`FinishConnection`；服务端事件还包括
  `ConnectionStarted`、`SessionStarted`、`SessionCanceled`、`ConnectionFinished`、
  `ConnectionFailed`、`SessionFailed`。

### 长文本任务

异步长文本最多 100,000 字符；服务端音频保留 7 天，查询结果音频 URL 有效期 1 小时。
提交响应包含 `data.task_id`、`data.req_text_length`、`data.task_status`；调用方须显式
查询，不在 client 内启动隐式后台轮询。

## P0 未完成项

1. 从音色设计和音色管理的结构化 HTML 文档中逐字段提取请求/响应 schema，并将脱敏的
   官方示例加入测试 fixture。
2. 对异步长文本与音色管理执行凭证门控探针，确认 2026 年新版控制台是否接受
   `X-Api-Key`。在确认前，不能让 API-key-only transport 假装支持这些 HTTP 调用。
3. 将错误码表中和本轮能力直接相关的 provider code 分类为 validation、authentication、
   quota、rate_limit、voice_state 或 upstream；未知 code 必须保留原值。
