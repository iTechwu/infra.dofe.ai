# Volcengine Speech Integration Checklist

日期：2026-07-08

## 前置配置

- 新版控制台 API Key：优先使用 `X-Api-Key`。
- 旧版控制台双头鉴权：仅在必须兼容时配置 `appId` + `accessKey`。
- 确认 endpoint：音频生成、HTTP 流式 TTS、TTS WebSocket、实时语音、播客、妙记、音色资源可能不是同一个路径。
- endpoint 必须是绝对 `http`、`https`、`ws` 或 `wss` URL；顶层 `endpoint` 只兼容覆盖音频生成和 HTTP 流式 TTS。
- 确认配额：音频生成最长 120 秒、参考音频/图片大小与数量限制、WebSocket 并发限制、妙记任务并发限制。
- 确认可观测字段：记录 `X-Api-Request-Id` 和火山返回的 `X-Tt-Logid`。
- 每次请求可传 `requestId`、非保留自定义 header 和 `timeoutMs`；认证头、resource id 和 request id 由 client 管理，不能通过自定义 header 覆盖。

## 样本准备

- 一段短文本，用于非流式音频生成。
- 一段 10 秒以内文本，用于 HTTP 流式 TTS 首包验证。
- 一段 PCM 16k 单声道音频帧，用于实时语音 WebSocket。
- 一段可公网访问的音频 URL，用于妙记任务。
- 一组合法音色/voice id，用于 voice 资源接口。

## 联调顺序

1. 先跑本地无密钥验证：`pnpm --filter @dofe/infra-shared-services verify:volcengine-speech`。
2. 使用真实 API Key 调用 `audioGeneration.createAudio`，确认 `audio/url/duration/logId`。
3. 调用 `ttsStreaming.synthesizeStream`，确认 stream 可读且首包延迟符合预期。
4. 调用 `ttsStreaming.connectWebSocket`，确认 JSON 事件和音频帧回调。
5. 调用 `realtime.connect`，确认输入音频帧后收到文本或音频事件。
6. 调用 `podcast.connect`，确认播客 v3 事件格式是否与当前 parser 兼容。
7. 调用 `memo.submitTask/queryTask`，确认 task id、状态和结果字段。
8. 调用 `voice.listVoices` 或训练查询，确认 action path 与官方文档一致。

## 验收

- 所有失败响应都能拿到 request id 或 log id（HTTP/网络错误已归一化为 `VolcengineSpeechError`，携带 `code`/`logId`/`requestId`/`retryable`）。
- 401/403 不重试，5xx/超时按 `maxRetries` 重试。
- WebSocket 错误帧能进入 `onError`。
- WebSocket 关闭后不可复用原 session；如需继续发送，应重新 `connect`，发送前可用 `session.isOpen()` 判断连接是否可用。
- 不在日志中输出 API Key、Access Key 或原始音频 Base64。
- 旧 `volcengine-tts`、`openspeech`、`streaming-asr` 调用路径未被改变。
