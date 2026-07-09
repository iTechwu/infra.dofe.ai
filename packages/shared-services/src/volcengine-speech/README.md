# Volcengine Speech

`volcengine-speech` is the unified client for Volcengine Doubao speech APIs in
`@dofe/infra-shared-services`.

## Import

```ts
import {
  VolcengineSpeechModule,
  VolcengineSpeechClient,
} from '@dofe/infra-shared-services/volcengine-speech';
```

## Capability Groups

- `audioGeneration`: non-streaming audio generation.
- `ttsStreaming`: HTTP streaming TTS and WebSocket TTS session entry.
- `asr`: recording-file ASR HTTP tasks for standard, fast, and off-peak modes.
- `voice`: voice/resource APIs.
- `realtime`: end-to-end realtime speech model WebSocket sessions.
- `interpretation`: simultaneous interpretation 2.0 WebSocket sessions.
- `podcast`: podcast WebSocket v3 sessions.
- `memo`: Doubao speech memo task APIs.
- `protocol`: shared WebSocket frame codec and session utilities.
- `errors`: shared error mapping and retry classification.

## Migration Rule

New Volcengine speech integrations should use this client. Existing
`volcengine-tts`, `openspeech`, and `streaming-asr` imports remain compatible and
should be migrated only by gradual delegation with compatibility tests.

## Explicit Client

```ts
const client = createVolcengineSpeechClient(
  {
    apiKey: provider.apiKey,
    endpoints: {
      audioGeneration: 'https://openspeech.bytedance.com/api/v3/tts/create',
      asrStandard: 'https://openspeech.bytedance.com/api/v3/auc/bigmodel',
    },
  },
  { httpService },
);
```

The explicit factory is intended for multi-provider-key services. It does not
read `keys/config.json`.

All configured endpoints must be absolute `http`, `https`, `ws`, or `wss` URLs.
The legacy top-level `endpoint` option only overrides `audioGeneration` and
`ttsStreaming`; WebSocket, memo, podcast, realtime, and voice endpoints should
be configured explicitly when they differ from the defaults.

## Request Options

Each HTTP or WebSocket entry accepts request options for `requestId`,
`resourceId`, `sequence`, non-reserved custom headers, and per-request timeout.
Authentication headers, `X-Api-Request-Id`, `X-Api-Resource-Id`, and
`X-Api-Sequence` are managed by the client and cannot be overridden through
custom headers.

`timeoutMs` must be a positive number. `maxRetries` must be a non-negative
integer. Per-request `requestId`, `resourceId`, and custom header names/values
must be non-empty strings. `sequence` must be a non-zero integer. Local request
validation throws
`VolcengineSpeechValidationError`; upstream HTTP or WebSocket failures throw or
emit `VolcengineSpeechError`.

HTTP and network errors (non-2xx responses, timeouts, connection resets) are
normalized into `VolcengineSpeechError`, carrying the HTTP status as `code`,
the Volcengine `X-Tt-Logid`, the request id, and a `retryable` flag, so every
failed request exposes the same tracing fields. 5xx, timeouts, and connection
errors are retried per `maxRetries`; 4xx are not.

Legacy `volcengine-tts` reuses the same endpoint, timeout, maxRetries
validation helpers and retry executor for its HTTP request phase. Its default
`maxRetries` is `0`, so retry is opt-in for that legacy path.

After a WebSocket session closes or `close()` is called, the client clears the
underlying connection reference. Create a new session instead of reusing the
closed one. Call `session.isOpen()` before sending to check whether the
connection is still usable. The shared WebSocket session supports JSON frames,
audio frames, last-packet audio frames, `onOpen`, `onEvent`, `onAudio`,
`onError`, and `onClose`; product-specific event schemas remain exposed through
the generic event callback until real vendor fixtures justify stronger typed
normalization.

## Examples

### Audio Generation

```ts
const result = await client.audioGeneration.createAudio({
  model: 'seed-audio-1.0',
  text_prompt: '用温暖自然的声音读出：你好，世界。',
  audio_config: {
    format: 'mp3',
    sample_rate: 24000,
    enable_subtitle: true,
  },
});
```

### HTTP Streaming TTS

```ts
const { stream, logId } = await client.ttsStreaming.synthesizeStream({
  text: '这是一段流式合成文本。',
  speaker: 'zh_male_beijingxiaoye_emo_v2_mars_bigtts',
  audio_config: { format: 'mp3', sample_rate: 24000 },
});
```

### Recording File ASR

```ts
const submitted = await client.asr.submitTask({
  mode: 'fast',
  audioUrl: 'https://example.test/audio.mp3',
});

const transcript = await client.asr.queryTask(submitted.taskId, 'fast');
```

`asr.submitTask` manages the v3 HTTP submit headers for the selected mode:
`X-Api-Resource-Id` defaults to the corresponding standard, fast, or off-peak
resource id, and `X-Api-Sequence` defaults to `-1` for URL-based file tasks.
`asr.queryTask` sends the task id through `X-Tt-Logid`, matching the v3 query
flow. Override `endpoints.asrStandard`, `endpoints.asrFast`, or
`endpoints.asrOffPeak` when Volcengine changes the deployment URL or a tenant
needs a dedicated endpoint.

### TTS WebSocket

```ts
const session = await client.ttsStreaming.connectWebSocket(
  { text: '开始合成', speaker: 'zh_male_beijingxiaoye_emo_v2_mars_bigtts' },
  {
    onEvent: (event) => handleTtsEvent(event),
    onAudio: (audio) => audioChunks.push(audio),
    onError: (error) => logger.error(error),
  },
);

session.sendJson({ text: '追加文本' });
session.close();
```

### Realtime Speech

```ts
const session = await client.realtime.connect(
  { session_id: 'session-1', audio_format: 'pcm', sample_rate: 16000 },
  {
    onEvent: (event) => handleRealtimeEvent(event),
    onAudio: (audio) => playback.write(audio),
  },
  { requestId: 'session-1' },
);

session.sendAudio(audioFrame);
session.sendAudio(Buffer.alloc(0), true);
```

### Simultaneous Interpretation

```ts
const session = await client.interpretation.connect(
  {
    session_id: 'interpretation-session-1',
    source_language: 'zh',
    target_language: 'en',
    audio_format: 'pcm',
    sample_rate: 16000,
  },
  {
    onEvent: (event) => handleInterpretationEvent(event),
    onAudio: (audio) => playback.write(audio),
  },
);

session.sendAudio(audioFrame);
session.close();
```

### Memo Task

```ts
const submitted = await client.memo.submitTask({
  audioUrl: 'https://example.com/meeting.mp3',
});

const status = await client.memo.queryTask(submitted.taskId);
```

### Voice Resources

```ts
const voices = await client.voice.listVoices({ page_size: 20 });

const training = await client.voice.submitVoiceTraining({
  voice_name: 'demo voice',
  audio_urls: ['https://example.com/reference.wav'],
});
```

## Local Verification

```bash
pnpm --filter @dofe/infra-shared-services typecheck
pnpm --filter @dofe/infra-shared-services verify:volcengine-speech
```

`verify:volcengine-speech` builds the package and runs a no-secret smoke check
for WebSocket frame encoding/decoding, product WebSocket init/send/close
sessions, error frame parsing, explicit config resolution, auth header
generation, package exports, task result normalization, and selected legacy
delegation boundaries.

## Volcengine References

- 录音文件识别标准版 HTTP: https://www.volcengine.com/docs/6561/1354868?lang=zh
- 录音文件极速版识别 HTTP: https://www.volcengine.com/docs/6561/1631584?lang=zh
- 录音文件识别闲时版 HTTP: https://www.volcengine.com/docs/6561/1840838?lang=zh
- 端到端实时语音大模型 API: https://www.volcengine.com/docs/6561/1594356?lang=zh
- 播客 API WebSocket v3: https://www.volcengine.com/docs/6561/1668014?lang=zh
- 同声传译 2.0 API: https://www.volcengine.com/docs/6561/1756902?lang=zh
- 豆包语音妙记 API: https://www.volcengine.com/docs/6561/1798094?lang=zh
