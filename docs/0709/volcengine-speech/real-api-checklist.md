# Volcengine Speech Real API Checklist

## Purpose

This checklist is for opt-in verification against real Volcengine speech APIs.
Default local smoke and CI must stay no-secret and vendor-independent.

## Preconditions

- Valid Volcengine account and enabled speech resources.
- New-console APP Key (`apiKey`) configured outside the repository. Only the
  `X-Api-Key` scheme is supported; the legacy `X-Api-App-Key` + `X-Api-Access-Key`
  console credentials have been removed.
- Resource ids confirmed for the target tenant.
- Test audio URLs are public or reachable by Volcengine.
- Callback URLs, when used, point to a disposable test receiver.

## Required Evidence Per Call

- Capability group and method.
- Official document URL.
- Endpoint used.
- Resource id used.
- `X-Api-Request-Id`.
- `X-Tt-Logid` when returned.
- Status code or task status.
- Failure code/message when failed.
- Whether code changes are required.

## Official Reference Set

Core capability documents:

- 录音文件识别标准版 HTTP: https://www.volcengine.com/docs/6561/1354868?lang=zh
- 录音文件极速版识别 HTTP: https://www.volcengine.com/docs/6561/1631584?lang=zh
- 录音文件识别闲时版 HTTP: https://www.volcengine.com/docs/6561/1840838?lang=zh
- 大模型流式语音识别 API (SAUC): https://www.volcengine.com/docs/6561/1354869?lang=zh
- 端到端实时语音大模型 API: https://www.volcengine.com/docs/6561/1594356?lang=zh
- 播客 API WebSocket v3: https://www.volcengine.com/docs/6561/1668014?lang=zh
- 同声传译 2.0 API: https://www.volcengine.com/docs/6561/1756902?lang=zh
- 豆包语音妙记 API: https://www.volcengine.com/docs/6561/1798094?lang=zh

Audio-related documents to check during real integration:

- https://www.volcengine.com/docs/6561/2550782?lang=zh
- https://www.volcengine.com/docs/6561/2528925?lang=zh
- https://www.volcengine.com/docs/6561/2534913?lang=zh
- https://www.volcengine.com/docs/6561/2532486?lang=zh
- https://www.volcengine.com/docs/6561/1829010?lang=zh
- https://www.volcengine.com/docs/6561/2534906?lang=zh
- https://www.volcengine.com/docs/6561/2535742?lang=zh
- https://www.volcengine.com/docs/6561/2535751?lang=zh
- https://www.volcengine.com/docs/6561/2277844?lang=zh
- https://www.volcengine.com/docs/6561/2235883?lang=zh

## Capability Checklist

### Audio Generation

- Method: `client.audioGeneration.createAudio`.
- Official reference: https://www.volcengine.com/docs/6561/2550782?lang=zh
- Evidence:
  - Request id:
  - Log id:
  - Audio URL/base64 present:
  - Subtitle present when requested:
  - Result:

### HTTP Streaming TTS

- Method: `client.ttsStreaming.synthesizeStream`.
- Official reference: https://www.volcengine.com/docs/6561/2528925?lang=zh
- Evidence:
  - Request id:
  - Log id:
  - Stream has audio bytes:
  - Result:

### TTS WebSocket

- Method: `client.ttsStreaming.connectWebSocket`.
- Official reference: https://www.volcengine.com/docs/6561/2534913?lang=zh
- Evidence:
  - Request id:
  - Init frame accepted:
  - Audio callback invoked:
  - Close code:
  - Result:

### Bidirectional TTS WebSocket

- Target method: `client.tts.connectDuplex` (not implemented yet).
- Official reference: https://www.volcengine.com/docs/6561/2532486?lang=zh
- Evidence:
  - Request id:
  - Connect id:
  - StartConnection/StartSession accepted:
  - TaskRequest audio callback invoked:
  - FinishSession/FinishConnection accepted:
  - Close code:
  - Result:

### Async Long-Text TTS

- Target methods: `client.tts.submitLongText` and `client.tts.queryLongText`
  (not implemented yet).
- Official reference: https://www.volcengine.com/docs/6561/1829010?lang=zh
- Important: the current official document lists legacy app-id/access-key
  authentication. Confirm new-console API-key support before enabling this
  capability in the API-key-only unified transport.
- Evidence:
  - Submit request id/log id/task id:
  - Query request id/log id/task status:
  - Audio URL returned:
  - Result:

### Recording File ASR Standard HTTP

- Method: `client.asr.submitStandardTask` and `client.asr.queryTask`.
- Official reference: https://www.volcengine.com/docs/6561/1354868?lang=zh
- Evidence:
  - Submit request id:
  - Submit log id/task id:
  - Query request id:
  - Resource id:
  - Transcript/status:
  - Result:

### Recording File ASR Fast HTTP

- Method: `client.asr.submitFastTask` and `client.asr.queryTask`.
- Official reference: https://www.volcengine.com/docs/6561/1631584?lang=zh
- Evidence:
  - Submit request id:
  - Submit log id/task id:
  - Query request id:
  - Resource id:
  - Transcript/status:
  - Result:

### Recording File ASR Off-Peak HTTP

- Method: `client.asr.submitOffPeakTask` and `client.asr.queryTask`.
- Official reference: https://www.volcengine.com/docs/6561/1840838?lang=zh
- Evidence:
  - Submit request id:
  - Submit log id/task id:
  - Query request id:
  - Resource id:
  - Transcript/status:
  - Result:

### Realtime Speech

- Method: `client.realtime.connect`.
- Official reference: https://www.volcengine.com/docs/6561/1594356?lang=zh
- Evidence:
  - Request id:
  - Init accepted:
  - Audio send accepted:
  - Event callback invoked:
  - Close code:
  - Result:

### Streaming ASR (SAUC bigmodel)

- Method: `client.streamingAsr.connect`.
- Official reference: https://www.volcengine.com/docs/6561/1354869?lang=zh
- Evidence:
  - Request id:
  - Resource id (e.g. `volc.bigasr.sauc.duration`/`concurrent` or
    `volc.seedasr.sauc.duration`/`concurrent`):
  - Endpoint variant (`bigmodel` / `bigmodel_nostream` / `bigmodel_async`):
  - Init accepted:
  - Audio send accepted:
  - Event callback invoked:
  - Close code:
  - Result:

### Simultaneous Interpretation 2.0

- Method: `client.interpretation.connect`.
- Current unified client status: dedicated WebSocket client is available; real
  vendor validation still requires credentials.
- Official reference: https://www.volcengine.com/docs/6561/1756902?lang=zh
- Evidence:
  - Request id:
  - Resource id:
  - Source language:
  - Target language:
  - Translation event callback invoked:
  - Audio/text output present:
  - Close code:
  - Result:

### Podcast WebSocket v3

- Method: `client.podcast.connect`.
- Official reference: https://www.volcengine.com/docs/6561/1668014?lang=zh
- Evidence:
  - Request id:
  - Init accepted:
  - Event callback invoked:
  - Audio callback invoked when expected:
  - Close code:
  - Result:

### Doubao Speech Memo

- Method: `client.memo.submitTask` and `client.memo.queryTask`.
- Official reference: https://www.volcengine.com/docs/6561/1798094?lang=zh
- Evidence:
  - Submit request id:
  - Submit task id:
  - Query request id:
  - Memo status/result:
  - Result:

### Voice Resources

- Method: `client.voice.listVoices` and selected resource APIs.
- Official reference: https://www.volcengine.com/docs/6561/2534906?lang=zh
- Evidence:
  - Request id:
  - Log id:
  - Resource operation:
  - Result:

## Pass Criteria

- All no-secret verification still passes:
  `pnpm --filter @dofe/infra-shared-services verify:volcengine-speech`.
- Real calls either pass or produce documented provider-side failure codes.
- Any code change discovered by real calls gets a follow-up implementation log
  entry in `docs/0709/volcengine-speech/implementation-log.md`.
