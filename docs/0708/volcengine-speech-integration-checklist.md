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

## 联调尝试记录（2026-07-09）

用提供的测试凭证对流式 ASR（SAUC bigmodel）做了一次实时握手探针（凭证仅经环境变量传入，未写入任何文件；探针脚本为一次性、未提交）：

- 端点确认：`wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async`，资源 ID `volc.seedasr.sauc.duration`。加上 `X-Api-Resource-Id` 后握手响应由 400 变为 401，说明端点与资源路径正确。
- 鉴权未通过：`X-Api-App-Key` + `X-Api-Access-Key`（分别用 `appAccessToken` 与 `appAccessSecret` 各试一次）均返回 401。提供的测试凭证当前无法通过该端点鉴权（疑似过期或属不同应用/Token 需刷新）。
- 影响：握手阶段即被拒，统一 `VolcengineWebSocketCodec` 编码的 init/音频帧尚未能送达服务端验证。鉴权代码未被循环 41-46 的委托改动（本轮只委托了帧编码），401 属凭证/鉴权问题，非代码回归。
- 待补：换用有效（未过期、匹配该应用）的 SAUC 凭证，或先走 Token 刷新流程后，即可用同一探针验证 codec 编码帧是否被服务端接受（init 帧后服务端应返回正常响应帧而非错误帧）。
