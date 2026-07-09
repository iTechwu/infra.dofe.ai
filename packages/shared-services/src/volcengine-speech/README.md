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
- `voice`: voice/resource APIs.
- `realtime`: end-to-end realtime speech model WebSocket sessions.
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
non-reserved custom headers, and per-request timeout. Authentication headers,
`X-Api-Request-Id`, and `X-Api-Resource-Id` are managed by the client and cannot
be overridden through custom headers.

`timeoutMs` must be a positive number. `maxRetries` must be a non-negative
integer. Per-request `requestId` and custom header names/values must be
non-empty strings. Local request validation throws
`VolcengineSpeechValidationError`; upstream HTTP or WebSocket failures throw or
emit `VolcengineSpeechError`.

HTTP and network errors (non-2xx responses, timeouts, connection resets) are
normalized into `VolcengineSpeechError`, carrying the HTTP status as `code`,
the Volcengine `X-Tt-Logid`, the request id, and a `retryable` flag, so every
failed request exposes the same tracing fields. 5xx, timeouts, and connection
errors are retried per `maxRetries`; 4xx are not.

After a WebSocket session closes, the client clears the underlying connection
reference. Create a new session instead of reusing the closed one. Call
`session.isOpen()` before sending to check whether the connection is still
usable.

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
for WebSocket frame encoding/decoding, error frame parsing, explicit config
resolution, and auth header generation.
