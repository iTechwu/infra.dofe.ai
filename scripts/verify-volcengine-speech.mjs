import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import {
  VOLCENGINE_WS_COMPRESSION,
  VOLCENGINE_WS_MESSAGE_FLAGS,
  VOLCENGINE_WS_MESSAGE_TYPE,
  VOLCENGINE_WS_SERIALIZATION,
  VolcengineWebSocketCodec,
  VolcengineWebSocketSession,
  VolcengineTtsDuplexCodec,
  VolcengineTtsDuplexSession,
  VOLCENGINE_TTS_DUPLEX_EVENT,
} from '../packages/shared-services/dist/volcengine-speech/protocol/index.js';
import {
  buildVolcengineSpeechHeaders as buildHeaders,
  buildVolcengineAuthHeaders,
} from '../packages/shared-services/dist/volcengine-speech/auth/index.js';
import {
  resolveVolcengineSpeechConfig as resolveConfig,
  normalizeVolcengineEndpoint,
  normalizeVolcengineNonNegativeInteger,
  normalizeVolcenginePositiveNumber,
} from '../packages/shared-services/dist/volcengine-speech/config/volcengine-speech.defaults.js';
import {
  validateCreateAudioRequest,
  validateTtsHttpRequest,
  validateTtsLongTextSubmitRequest,
  validateVoiceTrainingRequest,
  validateVoiceDesignRequest,
  validateAsrRequest,
  validateInterpretationRequest,
  validateMemoTaskRequest,
  validateRequestOptions,
  validateRequiredString,
} from '../packages/shared-services/dist/volcengine-speech/validation/index.js';
import {
  normalizeTaskResult,
  extractTaskError,
} from '../packages/shared-services/dist/volcengine-speech/memo/memo.normalizer.js';
import {
  createTtsChunkReducerState,
  reduceTtsChunk,
} from '../packages/shared-services/dist/volcengine-tts/tts-stream-reducer.js';
import {
  resolveTtsStreamResult,
} from '../packages/shared-services/dist/volcengine-tts/tts-stream-result.js';
import {
  resolveTtsResponseStream,
} from '../packages/shared-services/dist/volcengine-tts/tts-stream-processor.js';
import {
  executeTtsHttpRequest,
} from '../packages/shared-services/dist/volcengine-tts/tts-http-request.js';
import {
  buildTtsPayload,
  TTS_DEFAULT_MODEL,
} from '../packages/shared-services/dist/volcengine-tts/tts-payload.js';
import {
  resolveVolcengineTtsRuntimeConfig,
  VOLCENGINE_TTS_DEFAULT_MAX_RETRIES,
} from '../packages/shared-services/dist/volcengine-tts/tts-config.js';
import {
  VolcengineSpeechError,
  VolcengineTtsError,
  VolcengineSpeechValidationError,
  classifyVolcengineTtsFailure,
  assertVolcengineHeaderStatusSuccess,
  isRetryableVolcengineSpeechCode,
  isRetryableHttpStatus,
  normalizeVolcengineHttpError,
} from '../packages/shared-services/dist/volcengine-speech/errors/index.js';
import {
  readVolcengineHeader,
} from '../packages/shared-services/dist/volcengine-speech/headers.js';
import {
  executeVolcengineRetry,
  getVolcengineRetryDelayMs,
} from '../packages/shared-services/dist/volcengine-speech/retry.js';
import {
  normalizeBodyTaskResult,
  normalizeHeaderStatusTaskResult,
} from '../packages/shared-services/dist/volcengine-speech/task-result.js';
import {
  VolcengineAsrClient,
} from '../packages/shared-services/dist/volcengine-speech/asr/index.js';
import {
  VolcengineRealtimeSpeechClient,
} from '../packages/shared-services/dist/volcengine-speech/realtime/index.js';
import {
  VolcenginePodcastClient,
} from '../packages/shared-services/dist/volcengine-speech/podcast/index.js';
import {
  VolcengineInterpretationClient,
} from '../packages/shared-services/dist/volcengine-speech/interpretation/index.js';
import {
  VolcengineStreamingAsrClient,
} from '../packages/shared-services/dist/volcengine-speech/streaming-asr/index.js';
import {
  VolcengineTtsStreamingClient,
} from '../packages/shared-services/dist/volcengine-speech/tts-streaming/index.js';
import {
  VolcengineTtsApiClient,
  VolcengineTtsHttpClient,
  VolcengineTtsDuplexWebSocketSession,
  VolcengineTtsOneWayWebSocketSession,
} from '../packages/shared-services/dist/volcengine-speech/tts/index.js';
import {
  VolcengineVoiceClient,
} from '../packages/shared-services/dist/volcengine-speech/voice/index.js';
import {
  createVolcengineSpeechClient,
} from '../packages/shared-services/dist/volcengine-speech/volcengine-speech.factory.js';
import {
  VolcengineSpeechTransport,
} from '../packages/shared-services/dist/volcengine-speech/volcengine-speech.transport.js';

const codec = new VolcengineWebSocketCodec();
const duplexCodec = new VolcengineTtsDuplexCodec();
const duplexFrames = [];
const duplexSession = new VolcengineTtsDuplexSession((frame) => duplexFrames.push(frame));
duplexSession.startConnection();
duplexSession.startSession('session-1', { req_params: { speaker: 'S_demo' } });
duplexSession.sendText('hello duplex');
duplexSession.finishSession();
duplexSession.finishConnection();
assert.equal(duplexFrames.length, 5);
assert.throws(() => duplexSession.sendText('after close'), /not open/);
const canceledDuplexFrames = [];
const canceledDuplexSession = new VolcengineTtsDuplexSession((frame) => canceledDuplexFrames.push(frame));
canceledDuplexSession.startConnection();
canceledDuplexSession.startSession('session-cancel', {});
canceledDuplexSession.cancelSession();
assert.equal(duplexCodec.decode(canceledDuplexFrames.at(-1)).event, VOLCENGINE_TTS_DUPLEX_EVENT.CANCEL_SESSION);
assert.throws(() => canceledDuplexSession.sendText('after cancel'), /session is not open/);
const inboundDuplexFrames = [];
const inboundDuplexSession = new VolcengineTtsDuplexSession((frame) => inboundDuplexFrames.push(frame));
inboundDuplexSession.startConnection();
inboundDuplexSession.startSession('session-inbound', { req_params: { speaker: 'S_demo' } });
const duplexServerSessionStarted = duplexCodec.encodeServerEvent({
  event: VOLCENGINE_TTS_DUPLEX_EVENT.SESSION_STARTED,
  sessionId: 'session-inbound',
  payload: {},
});
assert.equal(
  inboundDuplexSession.handleServerFrame(duplexServerSessionStarted).event,
  VOLCENGINE_TTS_DUPLEX_EVENT.SESSION_STARTED,
);
assert.throws(
  () => inboundDuplexSession.handleServerFrame(duplexCodec.encodeServerEvent({
    event: VOLCENGINE_TTS_DUPLEX_EVENT.TTS_RESPONSE,
    sessionId: 'other-session',
    payload: {},
  })),
  /sessionId does not match/,
);
inboundDuplexSession.handleServerFrame(duplexCodec.encodeServerEvent({
  event: VOLCENGINE_TTS_DUPLEX_EVENT.SESSION_FINISHED,
  sessionId: 'session-inbound',
  payload: {},
}));
assert.throws(
  () => inboundDuplexSession.handleServerFrame(duplexServerSessionStarted),
  /session is not open/,
);
const sharedServicesRequire = createRequire(
  new URL('../packages/shared-services/package.json', import.meta.url),
);
const { WebSocketServer } = sharedServicesRequire('ws');
const { of } = sharedServicesRequire('rxjs');

const jsonFrame = codec.decode(codec.encodeJsonRequest({ text: 'hello' }, 1));
assert.equal(jsonFrame.messageType, VOLCENGINE_WS_MESSAGE_TYPE.FULL_CLIENT_REQUEST);
assert.equal(jsonFrame.sequence, 1);
assert.deepEqual(jsonFrame.json, { text: 'hello' });

const duplexStartConnection = duplexCodec.encodeClientEvent({
  event: VOLCENGINE_TTS_DUPLEX_EVENT.START_CONNECTION,
  payload: {},
});
assert.deepEqual([...duplexStartConnection.slice(0, 8)], [0x11, 0x14, 0x10, 0x00, 0, 0, 0, 1]);
const duplexTaskRequest = duplexCodec.encodeClientEvent({
  event: VOLCENGINE_TTS_DUPLEX_EVENT.TASK_REQUEST,
  sessionId: 'session-1',
  payload: { text: 'hello duplex' },
});
assert.equal(duplexTaskRequest.readUInt32BE(8), 'session-1'.length);
assert.equal(duplexTaskRequest.subarray(12, 21).toString(), 'session-1');
assert.deepEqual(duplexCodec.decode(duplexTaskRequest).json, { text: 'hello duplex' });

// openspeech provider delegation contract: the init / audio frames its
// buildFullClientRequest / buildAudioOnlyRequest now produce via the codec.
// Header = version(1)+headerSize(1) | messageType+flags | serialization+compression | reserved.
const initFrame = codec.encodeJsonRequest({ user: { uid: 'u' }, audio: {} });
assert.deepEqual([...initFrame.slice(0, 4)], [0x11, 0x10, 0x11, 0x00]);
assert.equal(initFrame.readUInt32BE(4), initFrame.length - 8);

const audioOnlyFrame = codec.encodeAudioRequest(Buffer.from([9, 9, 9]), false);
assert.deepEqual([...audioOnlyFrame.slice(0, 4)], [0x11, 0x20, 0x01, 0x00]);
const audioLastFrame = codec.encodeAudioRequest(Buffer.from([9, 9, 9]), true);
assert.deepEqual([...audioLastFrame.slice(0, 4)], [0x11, 0x22, 0x01, 0x00]);

const audio = Buffer.from([1, 2, 3, 4]);
const audioFrame = codec.decode(codec.encodeAudioRequest(audio, true, -2));
assert.equal(audioFrame.messageType, VOLCENGINE_WS_MESSAGE_TYPE.AUDIO_ONLY_CLIENT_REQUEST);
assert.equal(audioFrame.isLast, true);
assert.equal(audioFrame.sequence, -2);
assert.deepEqual([...audioFrame.payload], [...audio]);

const errorPayload = Buffer.from('bad request', 'utf-8');
const errorFrame = Buffer.alloc(12 + errorPayload.length);
errorFrame[0] = (0b0001 << 4) | 0b0001;
errorFrame[1] = VOLCENGINE_WS_MESSAGE_TYPE.ERROR_RESPONSE << 4;
errorFrame[2] = (VOLCENGINE_WS_SERIALIZATION.NONE << 4) | VOLCENGINE_WS_COMPRESSION.NONE;
errorFrame.writeUInt32BE(45000001, 4);
errorFrame.writeUInt32BE(errorPayload.length, 8);
errorPayload.copy(errorFrame, 12);
const decodedError = codec.decode(errorFrame);
assert.equal(decodedError.errorCode, 45000001);
assert.equal(decodedError.json, 'bad request');
const gzipErrorPayload = gzipSync(Buffer.from('compressed bad request', 'utf-8'));
const gzipErrorFrame = Buffer.alloc(12 + gzipErrorPayload.length);
gzipErrorFrame[0] = (0b0001 << 4) | 0b0001;
gzipErrorFrame[1] = VOLCENGINE_WS_MESSAGE_TYPE.ERROR_RESPONSE << 4;
gzipErrorFrame[2] = (VOLCENGINE_WS_SERIALIZATION.NONE << 4) | VOLCENGINE_WS_COMPRESSION.GZIP;
gzipErrorFrame.writeUInt32BE(45000002, 4);
gzipErrorFrame.writeUInt32BE(gzipErrorPayload.length, 8);
gzipErrorPayload.copy(gzipErrorFrame, 12);
const decodedGzipError = codec.decode(gzipErrorFrame);
assert.equal(decodedGzipError.errorCode, 45000002);
assert.equal(decodedGzipError.json, 'compressed bad request');

const unsupportedVersionFrame = Buffer.from(initFrame);
unsupportedVersionFrame[0] = (0b0010 << 4) | 0b0001;
assert.throws(
  () => codec.decode(unsupportedVersionFrame),
  /Unsupported Volcengine WebSocket frame version/,
);
const invalidHeaderSizeFrame = Buffer.from(initFrame);
invalidHeaderSizeFrame[0] = (0b0001 << 4) | 0b0000;
assert.throws(
  () => codec.decode(invalidHeaderSizeFrame),
  /Invalid Volcengine WebSocket frame header size/,
);
const unsupportedSerializationFrame = Buffer.from(initFrame);
unsupportedSerializationFrame[2] = (0b1111 << 4) | VOLCENGINE_WS_COMPRESSION.GZIP;
assert.throws(
  () => codec.decode(unsupportedSerializationFrame),
  /Unsupported Volcengine WebSocket serialization/,
);
const unsupportedCompressionFrame = Buffer.from(initFrame);
unsupportedCompressionFrame[2] = (VOLCENGINE_WS_SERIALIZATION.JSON << 4) | 0b1111;
assert.throws(
  () => codec.decode(unsupportedCompressionFrame),
  /Unsupported Volcengine WebSocket compression/,
);

const serverPayload = gzipSync(Buffer.from(JSON.stringify({ event: 'ok' })));
const serverFrame = Buffer.alloc(8 + serverPayload.length);
serverFrame[0] = (0b0001 << 4) | 0b0001;
serverFrame[1] = VOLCENGINE_WS_MESSAGE_TYPE.FULL_SERVER_RESPONSE << 4 | VOLCENGINE_WS_MESSAGE_FLAGS.NO_SEQUENCE;
serverFrame[2] = (VOLCENGINE_WS_SERIALIZATION.JSON << 4) | VOLCENGINE_WS_COMPRESSION.GZIP;
serverFrame.writeUInt32BE(serverPayload.length, 4);
serverPayload.copy(serverFrame, 8);
assert.deepEqual(codec.decode(serverFrame).json, { event: 'ok' });

const resolved = resolveConfig({
  apiKey: 'test-api-key',
  endpoints: { audioGeneration: 'https://example.test/create' },
});
assert.equal(resolved.apiKey, 'test-api-key');
assert.equal(resolved.endpoints.audioGeneration, 'https://example.test/create');
assert.equal(resolved.endpoints.asrStandard, 'https://openspeech.bytedance.com/api/v3/auc/bigmodel');
assert.equal(resolved.endpoints.interpretation, 'wss://openspeech.bytedance.com/api/v3/interpretation');
assert.equal(resolved.endpoints.streamingAsr, 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel');
assert.equal(
  resolved.endpoints.ttsOneWayWebSocket,
  'wss://openspeech.bytedance.com/api/v3/tts/unidirectional/stream',
);
assert.equal(
  resolved.endpoints.ttsDuplexWebSocket,
  'wss://openspeech.bytedance.com/api/v3/tts/bidirection',
);
assert.throws(() => resolveConfig({ apiKey: 'test-api-key', timeoutMs: 0 }), /timeoutMs/);
assert.throws(() => resolveConfig({ apiKey: 'test-api-key', maxRetries: -1 }), /maxRetries/);
assert.throws(() => resolveConfig({ apiKey: 'test-api-key', endpoints: { memo: '   ' } }), /endpoints.memo/);
assert.throws(() => resolveConfig({ apiKey: 'test-api-key', endpoints: { memo: 'not-url' } }), /absolute URL/);
assert.equal(normalizeVolcengineEndpoint(' https://example.test/api ', 'endpoint'), 'https://example.test/api');
assert.throws(() => normalizeVolcengineEndpoint('ftp://example.test/api', 'endpoint'), /http, https, ws, or wss/);
assert.equal(normalizeVolcenginePositiveNumber(1, 'timeoutMs'), 1);
assert.throws(() => normalizeVolcenginePositiveNumber(0, 'timeoutMs'), /positive number/);
assert.equal(normalizeVolcengineNonNegativeInteger(0, 'maxRetries'), 0);
assert.throws(() => normalizeVolcengineNonNegativeInteger(1.2, 'maxRetries'), /non-negative integer/);

const headers = buildHeaders(resolved, { requestId: 'request-1' });
assert.equal(headers['X-Api-Key'], 'test-api-key');
assert.equal(headers['X-Api-Request-Id'], 'request-1');
const asrSubmitHeaders = buildHeaders(resolved, {
  requestId: 'asr-request',
  resourceId: 'volc.bigasr.auc.fast',
  sequence: -1,
  headers: { 'X-Api-Sequence': 'spoofed', 'X-Trace': 'trace-asr' },
});
assert.equal(asrSubmitHeaders['X-Api-Resource-Id'], 'volc.bigasr.auc.fast');
assert.equal(asrSubmitHeaders['X-Api-Sequence'], '-1');
assert.equal(asrSubmitHeaders['X-Trace'], 'trace-asr');

const protectedHeaders = buildHeaders(resolved, {
  requestId: 'trusted-request',
  headers: {
    'X-Api-Request-Id': 'spoofed-request',
    'X-Api-Key': 'spoofed-key',
    'X-Custom-Trace': 'trace-2',
  },
});
assert.equal(protectedHeaders['X-Api-Request-Id'], 'trusted-request');
assert.equal(protectedHeaders['X-Api-Key'], 'test-api-key');
assert.equal(protectedHeaders['X-Custom-Trace'], 'trace-2');
const lowerCaseProtectedHeaders = buildHeaders(resolved, {
  requestId: 'trusted-lower-request',
  headers: {
    'x-api-request-id': 'spoofed-lower-request',
    'x-api-key': 'spoofed-lower-key',
    'x-api-sequence': '999',
    'x-trace': 'trace-lower',
  },
  sequence: -1,
});
assert.equal(lowerCaseProtectedHeaders['X-Api-Request-Id'], 'trusted-lower-request');
assert.equal(lowerCaseProtectedHeaders['X-Api-Key'], 'test-api-key');
assert.equal(lowerCaseProtectedHeaders['X-Api-Sequence'], '-1');
assert.equal(lowerCaseProtectedHeaders['x-api-request-id'], undefined);
assert.equal(lowerCaseProtectedHeaders['x-api-key'], undefined);
assert.equal(lowerCaseProtectedHeaders['x-api-sequence'], undefined);
assert.equal(lowerCaseProtectedHeaders['x-trace'], 'trace-lower');

// shared auth headers (X-Api-Key only, new console; extracted for volcengine-tts delegation)
const authHeaders = buildVolcengineAuthHeaders({
  apiKey: 'ak',
  resourceId: 'rid',
});
assert.equal(authHeaders['X-Api-Key'], 'ak');
assert.equal(authHeaders['X-Api-Resource-Id'], 'rid');
assert.equal(authHeaders['X-Api-Request-Id'], undefined); // auth-only, no request-id
assert.equal(authHeaders['X-Api-App-Key'], undefined); // legacy header removed
assert.equal(authHeaders['X-Api-Access-Key'], undefined); // legacy header removed

validateCreateAudioRequest({
  model: 'seed-audio-1.0',
  text_prompt: 'hello',
  references: [{ audio_url: 'https://example.test/a.mp3' }],
});
validateTtsLongTextSubmitRequest({
  unique_id: 'a'.repeat(20),
  req_params: { text: 'long text', speaker: 'S_demo', audio_params: { format: 'pcm' } },
});
assert.throws(
  () => validateTtsLongTextSubmitRequest({ req_params: { text: 'a'.repeat(100001), speaker: 'S_demo', audio_params: {} } }),
  /100000/,
);
assert.throws(
  () => validateTtsLongTextSubmitRequest({ unique_id: 'short', req_params: { text: 'text', speaker: 'S_demo', audio_params: {} } }),
  /20 and 64/,
);
assert.throws(
  () => validateCreateAudioRequest({ model: 'seed-audio-2.0', text_prompt: 'hello' }),
  /seed-audio-1.0/,
);
assert.throws(
  () => validateCreateAudioRequest({ model: 'seed-audio-1.0', text_prompt: 'a'.repeat(3001) }),
  /3000/,
);
assert.throws(
  () =>
    validateCreateAudioRequest({
      model: 'seed-audio-1.0',
      text_prompt: 'hello',
      references: [{ audio_url: 'https://example.test/a.mp3' }, { image_url: 'https://example.test/a.png' }],
    }),
  /cannot be mixed/,
);
assert.throws(
  () =>
    validateCreateAudioRequest({
      model: 'seed-audio-1.0',
      text_prompt: 'hello',
      audio_config: { pitch_rate: 13 },
    }),
  /pitch_rate/,
);
assert.throws(() => validateMemoTaskRequest({}), /audioUrl or resourceUrl/);
assert.throws(() => validateMemoTaskRequest({ audioUrl: '   ' }), /audioUrl or resourceUrl/);
validateAsrRequest({ audioUrl: 'https://example.test/audio.mp3' });
assert.throws(() => validateAsrRequest({ audioUrl: '   ' }), /audioUrl/);
assert.throws(
  () =>
    validateAsrRequest({
      audioUrl: 'https://example.test/audio.mp3',
      mode: 'turbo',
    }),
  /unsupported ASR mode/,
);
assert.throws(
  () =>
    validateAsrRequest({
      audioUrl: 'https://example.test/audio.mp3',
      resourceId: ' ',
    }),
  /resourceId/,
);
assert.throws(
  () =>
    validateAsrRequest({
      audioUrl: 'https://example.test/audio.mp3',
      options: { audio: { url: 'https://evil.test/audio.mp3' } },
    }),
  /options.audio is reserved/,
);
validateInterpretationRequest({
  session_id: 'interp-session',
  source_language: 'zh',
  target_language: 'en',
  audio_format: 'pcm',
  sample_rate: 16000,
});
assert.throws(
  () => validateInterpretationRequest([]),
  /interpretation init payload/,
);
assert.throws(
  () => validateInterpretationRequest({ source_language: ' ' }),
  /source_language/,
);
assert.throws(
  () => validateInterpretationRequest({ sample_rate: 0 }),
  /sample_rate/,
);
assert.throws(
  () => validateRequiredString('   ', 'taskId'),
  VolcengineSpeechValidationError,
);
validateVoiceTrainingRequest({
  speaker_id: 'S_demo',
  audio: { data: 'base64-audio', format: 'wav' },
  text: 'demo text',
});
validateVoiceDesignRequest({ speaker_id: 'S_design', prompt: 'warm narrator', text_prompt: 'hello' });
assert.throws(
  () => validateVoiceDesignRequest({ speaker_id: 'S_design', prompt: 'warm narrator' }),
  /text_prompt or image/,
);
assert.throws(
  () =>
    validateVoiceTrainingRequest({
      speaker_id: 'S_demo',
      audio: { data: ' ', format: 'wav' },
    }),
  /audio.data/,
);
assert.throws(() => validateRequestOptions({ requestId: ' ' }), /requestId/);
assert.throws(() => validateRequestOptions({ sequence: 0 }), /sequence/);
assert.throws(() => validateRequestOptions({ timeoutMs: 0 }), /timeoutMs/);
assert.throws(
  () => validateRequestOptions({ headers: { 'X-Trace': '' } }),
  /non-empty string/,
);
assert.throws(
  () => validateRequestOptions({ headers: { 'X-Trace': 123 } }),
  /non-empty string/,
);
validateRequestOptions({ headers: { 'X-Trace': 'ok' } });
validateTtsHttpRequest({
  req_params: {
    text: 'hello typed tts',
    speaker: 'S_demo',
    audio_params: { format: 'pcm', sample_rate: 24000 },
  },
});
assert.throws(
  () =>
    validateTtsHttpRequest({
      req_params: { speaker: 'S_demo', audio_params: {} },
    }),
  /text or ssml/,
);
assert.throws(
  () =>
    validateTtsHttpRequest({
      req_params: {
        text: 'hello',
        speaker: 123,
        audio_params: {},
      },
    }),
  VolcengineSpeechValidationError,
);
assert.throws(
  () =>
    validateTtsHttpRequest({
      req_params: {
        text: 'hello',
        speaker: 'S_demo',
        audio_params: [],
      },
    }),
  VolcengineSpeechValidationError,
);
assert.throws(
  () =>
    validateTtsHttpRequest({
      req_params: {
        text: 'hello',
        speaker: 'S_demo',
        audio_params: { speech_rate: Number.NaN },
      },
    }),
  VolcengineSpeechValidationError,
);

const transportCalls = [];
const transport = VolcengineSpeechTransport.create(
  {
    post(url, payload, config) {
      transportCalls.push({ url, payload, config });
      if (url.endsWith('/json')) {
        return of({
          headers: { 'x-tt-logid': ' transport-log ' },
          data: { code: 0, data: { ok: true } },
        });
      }
      if (url.endsWith('/body-error')) {
        return of({
          headers: { 'x-tt-logid': ' body-error-log ' },
          data: { code: 45000001, message: 'bad body' },
        });
      }
      if (url.endsWith('/stream')) {
        return of({
          headers: { 'x-tt-logid': ' stream-log ' },
          data: Readable.from(['stream-bytes']),
        });
      }
      if (url.endsWith('/stream-body-error')) {
        return of({
          headers: { 'x-tt-logid': ' stream-error-log ' },
          data: Readable.from([JSON.stringify({ code: 55000000, message: 'resource mismatch' })]),
        });
      }
      if (url.endsWith('/header-status')) {
        return of({
          headers: {
            'x-tt-logid': ' header-log ',
            'x-api-status-code': ' 20000000 ',
            'x-api-message': ' ok ',
          },
          data: { transcript: 'hello transport' },
        });
      }
      if (url.endsWith('/header-status-error')) {
        return of({
          headers: {
            'x-tt-logid': ' header-error-log ',
            'x-api-status-code': ' 45000001 ',
            'x-api-message': ' invalid transport audio ',
          },
          data: { upstream: 'raw error' },
        });
      }
      throw new Error(`Unexpected transport URL: ${url}`);
    },
  },
  resolved,
);
const transportPost = await transport.post(
  'https://example.test/json',
  { text: 'hello' },
  {
    requestId: 'transport-json-req',
    timeoutMs: 1234,
    headers: { 'X-Trace': 'transport-trace' },
  },
);
assert.deepEqual(transportPost.data, { ok: true });
assert.equal(transportPost.requestId, 'transport-json-req');
assert.equal(transportPost.logId, 'transport-log');
assert.equal(transportCalls[0].config.timeout, 1234);
assert.equal(transportCalls[0].config.headers['X-Trace'], 'transport-trace');
assert.equal(transportCalls[0].config.headers['X-Api-Request-Id'], 'transport-json-req');
await assert.rejects(
  () =>
    transport.post(
      'https://example.test/body-error',
      {},
      { requestId: 'transport-body-error-req' },
    ),
  /bad body/,
);
const transportStream = await transport.postStream(
  'https://example.test/stream',
  { text: 'stream' },
  { requestId: 'transport-stream-req' },
);
assert.equal(transportStream.requestId, 'transport-stream-req');
assert.equal(transportStream.logId, 'stream-log');
assert.equal(transportCalls[2].config.responseType, 'stream');
let transportStreamBody = '';
for await (const chunk of transportStream.stream) {
  transportStreamBody += chunk.toString();
}
assert.equal(transportStreamBody, 'stream-bytes');
await assert.rejects(
  () => transport.postStream('https://example.test/stream-body-error', {}),
  /resource mismatch/,
);
const transportHeaderStatus = await transport.postHeaderStatus(
  'https://example.test/header-status',
  { audio: { url: 'https://example.test/audio.mp3' } },
  { requestId: 'transport-header-req' },
);
assert.equal(transportHeaderStatus.statusCode, '20000000');
assert.equal(transportHeaderStatus.statusMessage, 'ok');
assert.equal(transportHeaderStatus.logId, 'header-log');
assert.deepEqual(transportHeaderStatus.result, { transcript: 'hello transport' });
await assert.rejects(
  () =>
    transport.postHeaderStatus(
      'https://example.test/header-status-error',
      {},
      { requestId: 'transport-header-error-req' },
    ),
  /invalid transport audio/,
);
let transportRetryAttempts = 0;
const retryingTransport = VolcengineSpeechTransport.create(
  {
    post() {
      transportRetryAttempts += 1;
      if (transportRetryAttempts === 1) {
        throw {
          isAxiosError: true,
          message: 'Request failed with status code 503',
          response: { status: 503, headers: { 'x-tt-logid': ' retry-log-1 ' } },
        };
      }
      return of({
        headers: { 'x-tt-logid': ' retry-log-2 ' },
        data: { code: 0, data: { retried: true } },
      });
    },
  },
  { ...resolved, maxRetries: 1 },
);
const retryingTransportResult = await retryingTransport.post(
  'https://example.test/retry',
  {},
  { requestId: 'transport-retry-req' },
);
assert.equal(transportRetryAttempts, 2);
assert.deepEqual(retryingTransportResult.data, { retried: true });
assert.equal(retryingTransportResult.logId, 'retry-log-2');

const typedTtsHttpCalls = [];
const typedTtsHttpClient = new VolcengineTtsHttpClient({
  getConfig() {
    return { endpoints: { ttsStreaming: 'https://example.test/typed-tts' } };
  },
  async postStream(url, payload, options) {
    typedTtsHttpCalls.push({ url, payload, options });
    return {
      stream: Readable.from(['typed-audio']),
      requestId: options.requestId,
      logId: 'typed-tts-log',
    };
  },
});
const typedTtsHttpResult = await typedTtsHttpClient.synthesizeHttpStream(
  {
    user: { uid: 'typed-user' },
    req_params: {
      text: 'hello typed tts',
      speaker: 'S_demo',
      audio_params: { format: 'pcm', sample_rate: 24000 },
    },
  },
  { requestId: 'typed-tts-request', resourceId: 'seed-tts-2.0' },
);
assert.equal(typedTtsHttpCalls[0].url, 'https://example.test/typed-tts');
assert.equal(typedTtsHttpCalls[0].payload.req_params.speaker, 'S_demo');
assert.equal(typedTtsHttpCalls[0].options.resourceId, 'seed-tts-2.0');
assert.equal(typedTtsHttpResult.logId, 'typed-tts-log');

const typedTtsFacade = new VolcengineTtsApiClient(
  { createAudio: async () => ({}) },
  typedTtsHttpClient,
);
assert.equal(typeof typedTtsFacade.createAudio, 'function');
assert.equal(typeof typedTtsFacade.synthesizeHttpStream, 'function');
const unifiedTypedTtsClient = createVolcengineSpeechClient(
  { apiKey: 'typed-api-key', resourceId: 'seed-tts-2.0' },
  { httpService: { post() { return of({ data: {}, headers: {} }); } } },
);
assert.equal(typeof unifiedTypedTtsClient.tts.synthesizeHttpStream, 'function');

const typedVoiceCalls = [];
const typedVoiceClient = new VolcengineVoiceClient({
  getConfig() {
    return {
      endpoints: {
        voiceTraining: 'https://example.test/voice-clone',
        voiceQuery: 'https://example.test/get-voice',
        voiceUpgrade: 'https://example.test/upgrade-voice',
        voiceDesign: 'https://example.test/voice-design',
      },
    };
  },
  async post(url, payload, options) {
    typedVoiceCalls.push({ url, payload, options });
    return {
      data: { speaker_id: payload.speaker_id, status: 2 },
      requestId: options?.requestId,
      logId: 'typed-voice-log',
      raw: {},
    };
  },
});
const trainedVoice = await typedVoiceClient.train(
  { speaker_id: 'S_demo', audio: { data: 'base64-audio', format: 'wav' } },
  { requestId: 'typed-voice-request' },
);
assert.equal(typedVoiceCalls[0].url, 'https://example.test/voice-clone');
assert.equal(typedVoiceCalls[0].options.requestId, 'typed-voice-request');
assert.equal(trainedVoice.data.status, 2);
await typedVoiceClient.get({ speaker_id: 'S_demo' });
assert.equal(typedVoiceCalls[1].url, 'https://example.test/get-voice');
await typedVoiceClient.upgrade({ speaker_id: 'S_demo' });
assert.equal(typedVoiceCalls[2].url, 'https://example.test/upgrade-voice');
await typedVoiceClient.design({ speaker_id: 'S_design', prompt: 'warm narrator', text_prompt: 'hello' });
assert.equal(typedVoiceCalls[3].url, 'https://example.test/voice-design');
assert.throws(
  () => typedVoiceClient.get([]),
  VolcengineSpeechValidationError,
);

const asrCalls = [];
const asrClient = new VolcengineAsrClient({
  getConfig() {
    return {
      endpoints: {
        asrStandard: 'https://example.test/asr-standard/',
        asrFast: 'https://example.test/asr-fast/',
        asrOffPeak: 'https://example.test/asr-offpeak/',
      },
    };
  },
  async postHeaderStatus(url, payload, options) {
    asrCalls.push({ url, payload, options });
    return {
      taskId: 'fallback-task',
      requestId: options.requestId,
      logId: 'asr-log-id',
      result: { transcript: 'hello' },
      raw: { transcript: 'hello' },
    };
  },
});

const fastAsr = await asrClient.submitTask(
  {
    mode: 'fast',
    audioUrl: 'https://example.test/audio.mp3',
    callbackUrl: 'https://example.test/callback',
    options: { extra: 'value' },
  },
  { requestId: 'asr-submit' },
);
assert.equal(fastAsr.taskId, 'asr-log-id');
assert.equal(asrCalls[0].url, 'https://example.test/asr-fast/submit');
assert.deepEqual(asrCalls[0].payload, {
  extra: 'value',
  audio: { url: 'https://example.test/audio.mp3' },
  callback: 'https://example.test/callback',
});
assert.equal(asrCalls[0].options.resourceId, 'volc.bigasr.auc.fast');
assert.equal(asrCalls[0].options.sequence, -1);

await asrClient.submitOffPeakTask({
  audioUrl: 'https://example.test/offpeak.mp3',
  resourceId: 'custom-offpeak-resource',
});
assert.equal(asrCalls[1].url, 'https://example.test/asr-offpeak/submit');
assert.equal(asrCalls[1].options.resourceId, 'custom-offpeak-resource');

await asrClient.queryTask('asr-log-id', 'standard', {
  requestId: 'asr-query',
  headers: { 'X-Trace': 'query-trace' },
});
assert.equal(asrCalls[2].url, 'https://example.test/asr-standard/query');
assert.deepEqual(asrCalls[2].payload, {});
assert.equal(asrCalls[2].options.resourceId, 'volc.bigasr.auc');
assert.equal(asrCalls[2].options.headers['X-Tt-Logid'], 'asr-log-id');
assert.equal(asrCalls[2].options.headers['X-Trace'], 'query-trace');
await assert.rejects(() => asrClient.queryTask('   '), /taskId/);
await assert.rejects(
  () => asrClient.queryTask('asr-log-id', 'turbo'),
  /unsupported ASR mode/,
);

assert.equal(isRetryableVolcengineSpeechCode(55000031), true);
assert.equal(isRetryableVolcengineSpeechCode(45000081), true);
assert.equal(isRetryableVolcengineSpeechCode(45000001), false);

const ttsServerFailure = classifyVolcengineTtsFailure({
  capability: 'voice_training',
  providerCode: 55001307,
});
assert.deepEqual(ttsServerFailure, {
  category: 'upstream',
  retryable: true,
});
const typedTtsError = new VolcengineTtsError({
  capability: 'tts_http',
  message: 'speaker not found',
  providerCode: 45000001,
  requestId: 'typed-tts-request',
});
assert.equal(typedTtsError.capability, 'tts_http');
assert.equal(typedTtsError.category, 'validation');
assert.equal(typedTtsError.retryable, false);
assert.equal(typedTtsError.code, 45000001);
assert.deepEqual(
  classifyVolcengineTtsFailure({
    capability: 'voice_training',
    providerCode: 45001123,
  }),
  { category: 'quota', retryable: false },
);
assert.deepEqual(
  classifyVolcengineTtsFailure({
    capability: 'tts_http',
    httpStatus: 429,
  }),
  { category: 'rate_limit', retryable: true },
);
assert.deepEqual(
  classifyVolcengineTtsFailure({
    capability: 'tts_duplex_ws',
    providerCode: 45009999,
  }),
  { category: 'unknown', retryable: false },
);
assert.deepEqual(
  classifyVolcengineTtsFailure({
    capability: 'tts_http',
    providerCode: 55009999,
  }),
  { category: 'unknown', retryable: false },
);
assert.deepEqual(
  classifyVolcengineTtsFailure({
    capability: 'tts_http',
    providerCode: 45000081,
  }),
  { category: 'unknown', retryable: false },
);
assert.deepEqual(
  classifyVolcengineTtsFailure({
    capability: 'tts_http',
    httpStatus: 401,
  }),
  { category: 'authentication', retryable: false },
);
assert.deepEqual(
  classifyVolcengineTtsFailure({
    capability: 'tts_http',
    httpStatus: 403,
  }),
  { category: 'authorization', retryable: false },
);
assert.deepEqual(
  classifyVolcengineTtsFailure({
    capability: 'tts_http',
    httpStatus: 599,
  }),
  { category: 'upstream', retryable: true },
);
assert.deepEqual(
  classifyVolcengineTtsFailure({
    capability: 'tts_http',
    httpStatus: 600,
  }),
  { category: 'unknown', retryable: false },
);
assert.doesNotThrow(() =>
  assertVolcengineHeaderStatusSuccess({ statusCode: ' 20000000 ' }),
);
assert.throws(
  () =>
    assertVolcengineHeaderStatusSuccess({
      statusCode: ' 45000001 ',
      statusMessage: ' invalid audio ',
    }),
  /invalid audio/,
);
const retryableError = new VolcengineSpeechError({
  message: 'temporary upstream failure',
  code: 55000031,
});
assert.equal(retryableError.retryable, true);

assert.equal(isRetryableHttpStatus(undefined), true);
assert.equal(isRetryableHttpStatus(503), true);
assert.equal(isRetryableHttpStatus(401), false);

const serverError = normalizeVolcengineHttpError(
  {
    isAxiosError: true,
    message: 'Request failed with status code 503',
    code: 'ERR_BAD_RESPONSE',
    response: {
      status: 503,
      headers: { 'x-tt-logid': 'log-503' },
    },
  },
  { requestId: 'req-1' },
);
assert.equal(serverError instanceof VolcengineSpeechError, true);
assert.equal(serverError.code, 503);
assert.equal(serverError.retryable, true);
assert.equal(serverError.logId, 'log-503');
assert.equal(serverError.requestId, 'req-1');

const authError = normalizeVolcengineHttpError(
  {
    isAxiosError: true,
    message: 'Request failed with status code 401',
    response: {
      status: 401,
      headers: { get: (name) => (name === 'x-tt-logid' ? 'log-401' : undefined) },
    },
  },
  { requestId: 'req-2' },
);
assert.equal(authError instanceof VolcengineSpeechError, true);
assert.equal(authError.code, 401);
assert.equal(authError.retryable, false);
assert.equal(authError.logId, 'log-401');

const networkError = normalizeVolcengineHttpError(
  { isAxiosError: true, code: 'ECONNRESET', message: 'socket hang up' },
  { requestId: 'req-3' },
);
assert.equal(networkError instanceof VolcengineSpeechError, true);
assert.equal(networkError.retryable, true);
assert.equal(networkError.requestId, 'req-3');

const passthrough = new Error('caller bug');
assert.equal(normalizeVolcengineHttpError(passthrough, {}), passthrough);
const existingSpeechError = new VolcengineSpeechError({
  message: 'body error',
  code: 45000001,
});
assert.equal(normalizeVolcengineHttpError(existingSpeechError, {}), existingSpeechError);

const successMemo = normalizeTaskResult({
  data: { task_id: 'task-1', status: 'success', message: 'success' },
  requestId: 'req-memo',
  logId: 'log-memo',
  raw: {},
});
assert.equal(successMemo.taskId, 'task-1');
assert.equal(successMemo.status, 'success');
assert.equal(successMemo.error, undefined);
assert.equal(successMemo.requestId, 'req-memo');

const fallbackMemo = normalizeTaskResult({
  data: { task_id: '   ', status: ' success ', message: ' success ' },
  raw: {},
}, 'fallback-task');
assert.equal(fallbackMemo.taskId, 'fallback-task');
assert.equal(fallbackMemo.status, 'success');
assert.equal(fallbackMemo.error, undefined);

const failedMemo = normalizeTaskResult({
  data: { task_id: 'task-2', status: 'failed', message: 'audio too short' },
  raw: {},
});
assert.equal(failedMemo.error, 'audio too short');

const explicitErrorMemo = normalizeTaskResult({
  data: { status: 'running', error: 'partial failure' },
  raw: {},
});
assert.equal(explicitErrorMemo.error, 'partial failure');
assert.equal(extractTaskError({ message: 'ok' }, 'success'), undefined);
assert.equal(extractTaskError({ message: 'bad' }, 'failed'), 'bad');
assert.equal(
  normalizeBodyTaskResult({
    data: { taskId: 'body-task', status: 'failed', message: 'body failed' },
    raw: {},
  }).error,
  'body failed',
);
const headerStatusTask = normalizeHeaderStatusTaskResult({
  statusCode: '20000000',
  statusMessage: 'ok',
  result: { transcript: 'hi' },
  requestId: 'header-req',
  logId: 'header-log',
  raw: {},
});
assert.equal(headerStatusTask.taskId, 'header-log');
assert.equal(headerStatusTask.error, undefined);
assert.deepEqual(headerStatusTask.result, { transcript: 'hi' });
assert.equal(
  normalizeHeaderStatusTaskResult({
    statusCode: '45000001',
    statusMessage: 'invalid audio',
    raw: {},
  }).error,
  'invalid audio',
);
const headerStatusTrimmed = normalizeHeaderStatusTaskResult({
  statusCode: ' 45000002 ',
  statusMessage: '   ',
  raw: {},
});
assert.equal(headerStatusTrimmed.statusCode, '45000002');
assert.equal(
  headerStatusTrimmed.error,
  'Volcengine speech task failed: 45000002',
);

const idleSession = new VolcengineWebSocketSession(
  {},
  { url: 'wss://example.test/dialogue' },
);
assert.equal(idleSession.isOpen(), false);
idleSession.close();
assert.equal(idleSession.isOpen(), false);
assert.throws(() => idleSession.sendJson({ text: 'hi' }), /not open/);
assert.throws(() => idleSession.sendRaw(Buffer.from([1])), /not open/);
assert.throws(() => idleSession.sendAudio(Buffer.from([1, 2, 3, 4])), /not open/);

await verifyWebSocketClient({
  ClientCtor: VolcengineTtsStreamingClient,
  endpointKey: 'ttsWebSocket',
  connectMethod: 'connectWebSocket',
  initPayload: { text: 'hello tts websocket' },
});
await verifyWebSocketClient({
  ClientCtor: VolcengineRealtimeSpeechClient,
  endpointKey: 'realtime',
  initPayload: { session_id: 'session-1', audio_format: 'pcm' },
});
await verifyWebSocketClient({
  ClientCtor: VolcenginePodcastClient,
  endpointKey: 'podcast',
  initPayload: { topic: 'podcast-demo' },
});
await verifyWebSocketClient({
  ClientCtor: VolcengineInterpretationClient,
  endpointKey: 'interpretation',
  initPayload: {
    session_id: 'interp-session',
    source_language: 'zh',
    target_language: 'en',
    audio_format: 'pcm',
    sample_rate: 16000,
  },
});
await verifyWebSocketClient({
  ClientCtor: VolcengineStreamingAsrClient,
  endpointKey: 'streamingAsr',
  initPayload: {
    user: { uid: 'streaming-asr-uid' },
    audio: { format: 'pcm', rate: 16000, bits: 16, channel: 1 },
    request: { model_name: 'bigmodel' },
  },
});
await verifyWebSocketErrorCallback();
await verifyWebSocketClientInitiatedClose();
await verifyWebSocketConnectFailureCleanup();
await verifyTtsDuplexWebSocketSession();
await verifyTtsOneWayWebSocketSession();

// volcengine-tts NDJSON chunk reducer (delegated from processStreamResponse)
const ttsState = createTtsChunkReducerState();
reduceTtsChunk(ttsState, { code: 0, data: 'AAEC' }); // base64 [0,1,2]
reduceTtsChunk(ttsState, { code: 0, sentence: { text: 'hi' } }); // skipped
reduceTtsChunk(ttsState, { code: 0, data: 'AAEC' }); // accumulate again
assert.equal(ttsState.completed, false);
assert.equal(ttsState.error, undefined);
assert.deepEqual([...ttsState.audioBuffer], [0, 1, 2, 0, 1, 2]);

// completion code must set completed and NOT be misclassified as error
// (regression for the buffer-remainder bug where 20000000 > 0 hit the error branch)
const completedState = createTtsChunkReducerState();
reduceTtsChunk(completedState, { code: 20000000 });
assert.equal(completedState.completed, true);
assert.equal(completedState.error, undefined);

const errorState = createTtsChunkReducerState();
reduceTtsChunk(errorState, { code: 45000001, message: 'invalid params' });
assert.equal(errorState.completed, false);
assert.equal(errorState.error, 'invalid params');

const defaultErrorState = createTtsChunkReducerState();
reduceTtsChunk(defaultErrorState, { code: 45000002 });
assert.equal(defaultErrorState.error, '错误码: 45000002');

// empty reducer state has no audio (processStreamResponse maps this to "未收到音频数据")
assert.equal(createTtsChunkReducerState().audioBuffer.length, 0);

const emptyStreamResult = await resolveTtsStreamResult({
  state: createTtsChunkReducerState(),
  getAudioDuration: async () => 0,
  uploadAudio: async () => ({ success: true, cloudUrl: 'unused' }),
});
assert.deepEqual(emptyStreamResult, {
  success: false,
  error: '未收到音频数据',
});

const failedStreamState = createTtsChunkReducerState();
failedStreamState.error = 'invalid params';
const failedStreamResult = await resolveTtsStreamResult({
  state: failedStreamState,
  getAudioDuration: async () => 0,
  uploadAudio: async () => {
    throw new Error('should not upload');
  },
});
assert.deepEqual(failedStreamResult, {
  success: false,
  error: 'invalid params',
});

const uploadState = createTtsChunkReducerState();
uploadState.audioBuffer = Buffer.from([1, 2, 3]);
let uploadedFileName = '';
const uploadedResult = await resolveTtsStreamResult({
  state: uploadState,
  logId: 'log-tts',
  now: () => 123,
  getAudioDuration: async (audioData) => {
    assert.deepEqual([...audioData], [1, 2, 3]);
    return 456;
  },
  uploadAudio: async (audioData, fileName) => {
    assert.deepEqual([...audioData], [1, 2, 3]);
    uploadedFileName = fileName;
    return { success: true, cloudUrl: 'https://cdn.test/audio.mp3' };
  },
});
assert.equal(uploadedFileName, 'tts_123_log-tts.mp3');
assert.deepEqual(uploadedResult, {
  success: true,
  audio: 'https://cdn.test/audio.mp3',
  duration: 456,
});

const uploadFailureResult = await resolveTtsStreamResult({
  state: uploadState,
  now: () => 123,
  getAudioDuration: async () => 456,
  uploadAudio: async () => ({ success: false, error: 'tos failed' }),
});
assert.deepEqual(uploadFailureResult, {
  success: false,
  error: 'tos failed',
});

const uploadThrowsResult = await resolveTtsStreamResult({
  state: uploadState,
  now: () => 123,
  getAudioDuration: async () => 456,
  uploadAudio: async () => {
    throw new Error('tos unavailable');
  },
});
assert.deepEqual(uploadThrowsResult, {
  success: false,
  error: 'tos unavailable',
});

let streamUploadedFileName = '';
const splitNdjsonStreamResult = await resolveTtsResponseStream({
  stream: Readable.from([
    JSON.stringify({ code: 0, data: Buffer.from([4, 5]).toString('base64') }) + '\n',
    JSON.stringify({ code: 0, sentence: { text: 'ignored' } }) + '\n',
    JSON.stringify({ code: 0, data: Buffer.from([6]).toString('base64') }),
  ]),
  logId: 'stream-log',
  now: () => 789,
  getAudioDuration: async (audioData) => {
    assert.deepEqual([...audioData], [4, 5, 6]);
    return 321;
  },
  uploadAudio: async (audioData, fileName) => {
    assert.deepEqual([...audioData], [4, 5, 6]);
    streamUploadedFileName = fileName;
    return { success: true, cloudUrl: 'https://cdn.test/stream.mp3' };
  },
});
assert.equal(streamUploadedFileName, 'tts_789_stream-log.mp3');
assert.deepEqual(splitNdjsonStreamResult, {
  success: true,
  audio: 'https://cdn.test/stream.mp3',
  duration: 321,
});

const streamUpstreamErrorResult = await resolveTtsResponseStream({
  stream: Readable.from([JSON.stringify({ code: 45000001, message: 'bad tts' })]),
  getAudioDuration: async () => 0,
  uploadAudio: async () => {
    throw new Error('should not upload errored stream');
  },
});
assert.deepEqual(streamUpstreamErrorResult, {
  success: false,
  error: 'bad tts',
});

// volcengine-tts payload builder (delegated from textToSpeech)
const ttsPayload = buildTtsPayload(
  {
    text: 'hello',
    speaker: 'ignored-by-builder',
    pitch: -1,
    speech_rate: 2,
    loudness_rate: 3,
  },
  'speaker-id',
);
assert.equal(ttsPayload.req_params.text, 'hello');
assert.equal(ttsPayload.req_params.model, TTS_DEFAULT_MODEL);
assert.equal(ttsPayload.req_params.speaker, 'speaker-id');
assert.equal(ttsPayload.req_params.audio_params.format, 'mp3');
assert.equal(ttsPayload.req_params.audio_params.sample_rate, 32000);
assert.equal(ttsPayload.req_params.audio_params.speech_rate, 2);
assert.equal(ttsPayload.req_params.audio_params.loudness_rate, 3);
assert.equal(JSON.parse(ttsPayload.req_params.additions).post_process.pitch, -1);

let ttsHttpPostCalls = 0;
let ttsHttpResolveLogId = '';
const ttsHttpResult = await executeTtsHttpRequest({
  url: 'https://example.test/tts',
  headers: { 'X-Api-Key': 'ak' },
  payload: ttsPayload,
  timeoutMs: 1234,
  maxRetries: 0,
  post: async ({ url, payload, headers, timeoutMs }) => {
    ttsHttpPostCalls += 1;
    assert.equal(url, 'https://example.test/tts');
    assert.equal(payload, ttsPayload);
    assert.equal(headers['X-Api-Key'], 'ak');
    assert.equal(timeoutMs, 1234);
    return {
      headers: { 'X-Tt-Logid': 'http-log' },
      data: Readable.from([JSON.stringify({ code: 0, data: 'AAEC' })]),
    };
  },
  resolveStream: async ({ stream, logId }) => {
    ttsHttpResolveLogId = logId;
    let body = '';
    for await (const chunk of stream) {
      body += chunk.toString();
    }
    assert.equal(JSON.parse(body).data, 'AAEC');
    return { success: true, audio: 'https://cdn.test/http.mp3' };
  },
});
assert.equal(ttsHttpPostCalls, 1);
assert.equal(ttsHttpResolveLogId, 'http-log');
assert.deepEqual(ttsHttpResult, {
  success: true,
  audio: 'https://cdn.test/http.mp3',
});

const exportedTtsHttpRequest = sharedServicesRequire('@dofe/infra-shared-services/volcengine-tts/tts-http-request');
assert.equal(typeof exportedTtsHttpRequest.executeTtsHttpRequest, 'function');
const exportedTtsStreamProcessor = sharedServicesRequire('@dofe/infra-shared-services/volcengine-tts/tts-stream-processor');
assert.equal(typeof exportedTtsStreamProcessor.resolveTtsResponseStream, 'function');
const exportedTtsStreamResult = sharedServicesRequire('@dofe/infra-shared-services/volcengine-tts/tts-stream-result');
assert.equal(typeof exportedTtsStreamResult.resolveTtsStreamResult, 'function');
const exportedVolcengineSpeech = sharedServicesRequire('@dofe/infra-shared-services/volcengine-speech');
assert.equal(typeof exportedVolcengineSpeech.VolcengineAsrClient, 'function');
assert.equal(typeof exportedVolcengineSpeech.VolcengineInterpretationClient, 'function');
assert.equal(typeof exportedVolcengineSpeech.VolcengineStreamingAsrClient, 'function');
assert.equal(typeof exportedVolcengineSpeech.normalizeHeaderStatusTaskResult, 'function');
const exportedAsr = sharedServicesRequire('@dofe/infra-shared-services/volcengine-speech/asr');
assert.equal(typeof exportedAsr.VolcengineAsrClient, 'function');
const exportedStreamingAsr = sharedServicesRequire('@dofe/infra-shared-services/volcengine-speech/streaming-asr');
assert.equal(typeof exportedStreamingAsr.VolcengineStreamingAsrClient, 'function');
const exportedInterpretation = sharedServicesRequire('@dofe/infra-shared-services/volcengine-speech/interpretation');
assert.equal(typeof exportedInterpretation.VolcengineInterpretationClient, 'function');
const exportedInterpretationClient = sharedServicesRequire('@dofe/infra-shared-services/volcengine-speech/interpretation/interpretation.client');
assert.equal(typeof exportedInterpretationClient.VolcengineInterpretationClient, 'function');
const exportedTaskResult = sharedServicesRequire('@dofe/infra-shared-services/volcengine-speech/task-result');
assert.equal(typeof exportedTaskResult.normalizeBodyTaskResult, 'function');
const exportedSpeechTransport = sharedServicesRequire('@dofe/infra-shared-services/volcengine-speech/volcengine-speech.transport');
assert.equal(typeof exportedSpeechTransport.VolcengineSpeechTransport, 'function');

let ttsHttpUnauthorizedCalls = 0;
await assert.rejects(
  () =>
    executeTtsHttpRequest({
      url: 'https://example.test/tts',
      headers: { 'X-Api-Key': 'ak' },
      payload: ttsPayload,
      maxRetries: 3,
      post: async () => {
        ttsHttpUnauthorizedCalls += 1;
        throw {
          isAxiosError: true,
          message: 'Request failed with status code 401',
          response: { status: 401, headers: { 'x-tt-logid': 'log-401' } },
        };
      },
      resolveStream: async () => {
        throw new Error('should not resolve unauthorized stream');
      },
    }),
  /401/,
);
assert.equal(ttsHttpUnauthorizedCalls, 1);

let ttsHttpRetryCalls = 0;
await assert.rejects(
  () =>
    executeTtsHttpRequest({
      url: 'https://example.test/tts',
      headers: { 'X-Api-Key': 'ak' },
      payload: ttsPayload,
      maxRetries: 2,
      post: async () => {
        ttsHttpRetryCalls += 1;
        throw {
          isAxiosError: true,
          message: 'Request failed with status code 503',
          response: { status: 503, headers: { 'x-tt-logid': 'log-503' } },
        };
      },
      resolveStream: async () => {
        throw new Error('should not resolve failed stream');
      },
    }),
  /503/,
);
assert.equal(ttsHttpRetryCalls, 3);

const ttsRuntimeConfig = resolveVolcengineTtsRuntimeConfig({
  endpoint: ' https://example.test/tts ',
  timeoutMs: 1000,
  maxRetries: 2,
});
assert.equal(ttsRuntimeConfig.endpoint, 'https://example.test/tts');
assert.equal(ttsRuntimeConfig.timeoutMs, 1000);
assert.equal(ttsRuntimeConfig.maxRetries, 2);
assert.equal(resolveVolcengineTtsRuntimeConfig({}).maxRetries, VOLCENGINE_TTS_DEFAULT_MAX_RETRIES);
assert.throws(() => resolveVolcengineTtsRuntimeConfig({ endpoint: 'not-url' }), /absolute URL/);
assert.throws(() => resolveVolcengineTtsRuntimeConfig({ timeoutMs: 0 }), /timeoutMs/);
assert.throws(() => resolveVolcengineTtsRuntimeConfig({ maxRetries: -1 }), /maxRetries/);

// shared header reader (consolidated from transport getHeader + errors readLogId)
assert.equal(readVolcengineHeader(undefined, 'x-tt-logid'), undefined);
assert.equal(readVolcengineHeader({ 'x-tt-logid': 'log-1' }, 'x-tt-logid'), 'log-1');
assert.equal(readVolcengineHeader({ 'X-Tt-Logid': 'log-2' }, 'x-tt-logid'), 'log-2');
assert.equal(readVolcengineHeader({ 'x-tt-logid': ['log-3', 'extra'] }, 'x-tt-logid'), 'log-3');
assert.equal(readVolcengineHeader({ 'x-tt-logid': ' log-trimmed ' }, 'x-tt-logid'), 'log-trimmed');
assert.equal(readVolcengineHeader({ 'x-tt-logid': [undefined, '', ' log-4 '] }, 'x-tt-logid'), 'log-4');
assert.equal(readVolcengineHeader({ 'x-tt-logid': '' }, 'x-tt-logid'), undefined);
assert.equal(readVolcengineHeader({ 'x-tt-logid': '   ' }, 'x-tt-logid'), undefined);
assert.equal(readVolcengineHeader({ other: 'x' }, 'x-tt-logid'), undefined);
assert.equal(
  readVolcengineHeader(
    { get: (n) => (n === 'x-tt-logid' ? 'log-axios' : null) },
    'X-Tt-Logid',
  ),
  'log-axios',
);

assert.equal(getVolcengineRetryDelayMs(0), 1000);
assert.equal(getVolcengineRetryDelayMs(3), 5000);
let retryAttempts = 0;
const retryResult = await executeVolcengineRetry(
  async () => {
    retryAttempts += 1;
    if (retryAttempts < 3) {
      throw new VolcengineSpeechError({
        message: 'temporary',
        code: 55000031,
      });
    }
    return 'ok';
  },
  {
    maxRetries: 2,
    isRetryableError: (error) =>
      error instanceof VolcengineSpeechError && error.retryable,
    sleep: async () => {},
  },
);
assert.equal(retryResult, 'ok');
assert.equal(retryAttempts, 3);

let exhaustedAttempts = 0;
await assert.rejects(
  () =>
    executeVolcengineRetry(
      async () => {
        exhaustedAttempts += 1;
        throw new VolcengineSpeechError({
          message: 'still temporary',
          code: 55000031,
        });
      },
      {
        maxRetries: 1,
        isRetryableError: (error) =>
          error instanceof VolcengineSpeechError && error.retryable,
        sleep: async () => {},
      },
    ),
  /still temporary/,
);
assert.equal(exhaustedAttempts, 2);

let nonRetryableAttempts = 0;
await assert.rejects(
  () =>
    executeVolcengineRetry(
      async () => {
        nonRetryableAttempts += 1;
        throw new VolcengineSpeechError({
          message: 'bad request',
          code: 45000001,
        });
      },
      {
        maxRetries: 3,
        isRetryableError: (error) =>
          error instanceof VolcengineSpeechError && error.retryable,
        sleep: async () => {},
      },
    ),
  /bad request/,
);
assert.equal(nonRetryableAttempts, 1);

process.stdout.write('[verify-volcengine-speech] ok\n');

async function verifyWebSocketClient({
  ClientCtor,
  endpointKey,
  initPayload,
  connectMethod = 'connect',
}) {
  const server = new WebSocketServer({ port: 0 });
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.equal(typeof address, 'object');
  const url = `ws://127.0.0.1:${address.port}`;

  const sessionClosed = new Promise((resolve, reject) => {
    server.once('connection', (ws, request) => {
      assert.equal(request.headers['x-api-key'], 'test-api-key');
      assert.equal(request.headers['x-api-request-id'], `${endpointKey}-req`);
      assert.equal(request.headers['x-api-resource-id'], `${endpointKey}-rid`);
      assert.equal(request.headers['x-trace'], `${endpointKey}-trace`);
      const receivedFrames = [];
      ws.on('message', (data) => {
        try {
          const frame = codec.decode(Buffer.from(data));
          receivedFrames.push(frame);
          if (receivedFrames.length === 1) {
            assert.deepEqual(frame.json, initPayload);
            ws.send(createServerJsonFrame({ event: `${endpointKey}-ok` }));
            return;
          }
          if (receivedFrames.length === 2) {
            assert.deepEqual(frame.json, { event: `${endpointKey}-client-json` });
            return;
          }
          if (receivedFrames.length === 3) {
            assert.equal(frame.messageType, VOLCENGINE_WS_MESSAGE_TYPE.AUDIO_ONLY_CLIENT_REQUEST);
            assert.deepEqual([...frame.payload], [1, 2, 3, 4]);
            assert.equal(frame.isLast, true);
            ws.close(1000, `${endpointKey}-done`);
            return;
          }
          reject(new Error(`Unexpected extra WebSocket frame for ${endpointKey}`));
        } catch (error) {
          reject(error);
        }
      });
      ws.on('close', () => {
        try {
          assert.equal(receivedFrames.length, 3);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  });

  const events = [];
  const closes = [];
  let openCount = 0;
  let buildHeadersOptions;
  const client = new ClientCtor({
    buildHeaders(options) {
      buildHeadersOptions = options;
      return {
        'X-Api-Key': 'test-api-key',
        'X-Api-Request-Id': options.requestId,
        'X-Api-Resource-Id': options.resourceId,
        'X-Trace': options.headers['X-Trace'],
      };
    },
    getConfig() {
      return {
        timeoutMs: 1000,
        endpoints: {
          [endpointKey]: url,
        },
      };
    },
  });
  const session = await client[connectMethod](
    initPayload,
    {
      onOpen: () => {
        openCount += 1;
      },
      onEvent: (event) => {
        events.push(event);
      },
      onError: (error) => {
        throw error;
      },
      onClose: (code, reason) => {
        closes.push({ code, reason: reason.toString() });
      },
    },
    {
      requestId: `${endpointKey}-req`,
      resourceId: `${endpointKey}-rid`,
      headers: { 'X-Trace': `${endpointKey}-trace` },
    },
  );
  assert.deepEqual(buildHeadersOptions, {
    requestId: `${endpointKey}-req`,
    resourceId: `${endpointKey}-rid`,
    headers: { 'X-Trace': `${endpointKey}-trace` },
  });
  assert.equal(openCount, 1);
  await waitFor(() => events.length === 1);
  assert.deepEqual(events[0], { event: `${endpointKey}-ok` });
  session.sendJson({ event: `${endpointKey}-client-json` });
  session.sendAudio(Buffer.from([1, 2, 3, 4]), true);
  await sessionClosed;
  await waitFor(() => closes.length === 1);
  assert.equal(closes[0].code, 1000);
  assert.equal(closes[0].reason, `${endpointKey}-done`);
  assert.equal(session.isOpen(), false);
  await new Promise((resolve) => server.close(resolve));
}

function createServerJsonFrame(payload) {
  const encoded = gzipSync(Buffer.from(JSON.stringify(payload)));
  const frame = Buffer.alloc(8 + encoded.length);
  frame[0] = (0b0001 << 4) | 0b0001;
  frame[1] =
    (VOLCENGINE_WS_MESSAGE_TYPE.FULL_SERVER_RESPONSE << 4) |
    VOLCENGINE_WS_MESSAGE_FLAGS.NO_SEQUENCE;
  frame[2] =
    (VOLCENGINE_WS_SERIALIZATION.JSON << 4) |
    VOLCENGINE_WS_COMPRESSION.GZIP;
  frame.writeUInt32BE(encoded.length, 4);
  encoded.copy(frame, 8);
  return frame;
}

function createServerErrorFrame(code, message) {
  const payload = Buffer.from(message, 'utf-8');
  const frame = Buffer.alloc(12 + payload.length);
  frame[0] = (0b0001 << 4) | 0b0001;
  frame[1] = VOLCENGINE_WS_MESSAGE_TYPE.ERROR_RESPONSE << 4;
  frame[2] =
    (VOLCENGINE_WS_SERIALIZATION.NONE << 4) |
    VOLCENGINE_WS_COMPRESSION.NONE;
  frame.writeUInt32BE(code, 4);
  frame.writeUInt32BE(payload.length, 8);
  payload.copy(frame, 12);
  return frame;
}

async function verifyWebSocketErrorCallback() {
  const server = new WebSocketServer({ port: 0 });
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.equal(typeof address, 'object');
  const url = `ws://127.0.0.1:${address.port}`;

  server.once('connection', (ws) => {
    ws.once('message', () => {
      ws.send(createServerErrorFrame(45000001, 'bad websocket request'));
    });
  });

  const errors = [];
  const session = new VolcengineWebSocketSession(
    {
      buildHeaders() {
        return { 'X-Api-Key': 'test-api-key' };
      },
      getConfig() {
        return { timeoutMs: 1000 };
      },
    },
    {
      url,
      initPayload: { event: 'init' },
      callbacks: {
        onError: (error) => errors.push(error),
      },
    },
  );
  await session.connect();
  await waitFor(() => errors.length === 1);
  assert.equal(errors[0] instanceof VolcengineSpeechError, true);
  assert.equal(errors[0].code, 45000001);
  assert.match(errors[0].message, /bad websocket request/);
  session.close();
  await new Promise((resolve) => server.close(resolve));
}

async function verifyWebSocketClientInitiatedClose() {
  const server = new WebSocketServer({ port: 0 });
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.equal(typeof address, 'object');
  const url = `ws://127.0.0.1:${address.port}`;

  const serverClosed = new Promise((resolve) => {
    server.once('connection', (ws) => {
      ws.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });
  });

  const closes = [];
  const session = new VolcengineWebSocketSession(
    {
      buildHeaders() {
        return { 'X-Api-Key': 'test-api-key' };
      },
      getConfig() {
        return { timeoutMs: 1000 };
      },
    },
    {
      url,
      callbacks: {
        onClose: (code, reason) => {
          closes.push({ code, reason: reason.toString() });
        },
      },
    },
  );
  await session.connect();
  assert.equal(session.isOpen(), true);
  session.close(1000, 'client-done');
  assert.equal(session.isOpen(), false);
  assert.deepEqual(await serverClosed, { code: 1000, reason: 'client-done' });
  await waitFor(() => closes.length === 1);
  assert.equal(closes[0].code, 1000);
  assert.equal(closes[0].reason, 'client-done');
  await new Promise((resolve) => server.close(resolve));
}

async function verifyWebSocketConnectFailureCleanup() {
  const server = new WebSocketServer({ port: 0 });
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.equal(typeof address, 'object');
  const url = `ws://127.0.0.1:${address.port}`;
  await new Promise((resolve) => server.close(resolve));

  const errors = [];
  const session = new VolcengineWebSocketSession(
    {
      buildHeaders() {
        return { 'X-Api-Key': 'test-api-key' };
      },
      getConfig() {
        return { timeoutMs: 1000 };
      },
    },
    {
      url,
      callbacks: {
        onError: (error) => errors.push(error),
      },
    },
  );
  await assert.rejects(() => session.connect());
  assert.equal(session.isOpen(), false);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /ECONNREFUSED|connect/);
}

async function verifyTtsDuplexWebSocketSession() {
  const server = new WebSocketServer({ port: 0 });
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.equal(typeof address, 'object');
  const url = `ws://127.0.0.1:${address.port}`;
  const receivedEvents = [];
  const serverDone = new Promise((resolve, reject) => {
    server.once('connection', (ws) => {
      ws.on('message', (input) => {
        try {
          const frame = duplexCodec.decode(Buffer.from(input));
          receivedEvents.push(frame.event);
          if (frame.event === VOLCENGINE_TTS_DUPLEX_EVENT.START_CONNECTION) {
            ws.send(duplexCodec.encodeServerEvent({
              event: VOLCENGINE_TTS_DUPLEX_EVENT.CONNECTION_STARTED,
              payload: {},
            }));
          }
          if (frame.event === VOLCENGINE_TTS_DUPLEX_EVENT.START_SESSION) {
            ws.send(duplexCodec.encodeServerEvent({
              event: VOLCENGINE_TTS_DUPLEX_EVENT.SESSION_STARTED,
              sessionId: frame.sessionId,
              payload: {},
            }));
          }
          if (frame.event === VOLCENGINE_TTS_DUPLEX_EVENT.TASK_REQUEST) {
            ws.send(duplexCodec.encodeServerEvent({
              event: VOLCENGINE_TTS_DUPLEX_EVENT.TTS_RESPONSE,
              sessionId: frame.sessionId,
              payload: { data: 'audio' },
            }));
            ws.send(duplexCodec.encodeServerEvent({
              event: VOLCENGINE_TTS_DUPLEX_EVENT.SESSION_FINISHED,
              sessionId: frame.sessionId,
              payload: {},
            }));
          }
          if (frame.event === VOLCENGINE_TTS_DUPLEX_EVENT.FINISH_CONNECTION) {
            ws.close(1000, 'duplex-done');
          }
        } catch (error) {
          reject(error);
        }
      });
      ws.on('close', () => resolve());
    });
  });
  const events = [];
  const session = new VolcengineTtsDuplexWebSocketSession(
    {
      buildHeaders() {
        return { 'X-Api-Key': 'test-api-key' };
      },
      getConfig() {
        return { timeoutMs: 1000, endpoints: { ttsDuplexWebSocket: url } };
      },
    },
    {
      onEvent: (event) => events.push(event),
    },
  );
  await session.connect();
  session.startSession('duplex-session', { req_params: { speaker: 'S_demo' } });
  session.sendText('duplex text');
  await waitFor(() => events.some((event) => event.event === VOLCENGINE_TTS_DUPLEX_EVENT.SESSION_FINISHED));
  session.finishConnection();
  await serverDone;
  assert.deepEqual(receivedEvents, [1, 100, 200, 2]);
  assert.equal(events.some((event) => event.event === VOLCENGINE_TTS_DUPLEX_EVENT.TTS_RESPONSE), true);
  await new Promise((resolve) => server.close(resolve));
}

async function verifyTtsOneWayWebSocketSession() {
  const server = new WebSocketServer({ port: 0 });
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.equal(typeof address, 'object');
  const url = `ws://127.0.0.1:${address.port}`;
  const serverDone = new Promise((resolve, reject) => {
    server.once('connection', (ws) => {
      ws.once('message', (input) => {
        try {
          assert.deepEqual(codec.decode(Buffer.from(input)).json, {
            user: { uid: 'one-way-test' },
            req_params: {
              text: 'one way text',
              speaker: 'S_demo',
              audio_params: { format: 'pcm' },
            },
          });
          ws.send(createServerJsonFrame({ event: 'TTSResponse', data: 'audio' }));
          ws.send(createServerJsonFrame({ event: 'SessionFinished' }));
          ws.close(1000, 'one-way-done');
        } catch (error) {
          reject(error);
        }
      });
      ws.on('close', () => resolve());
    });
  });
  const events = [];
  const session = new VolcengineTtsOneWayWebSocketSession(
    {
      buildHeaders() {
        return { 'X-Api-Key': 'test-api-key' };
      },
      getConfig() {
        return { timeoutMs: 1000, endpoints: { ttsOneWayWebSocket: url } };
      },
    },
    {
      user: { uid: 'one-way-test' },
      req_params: {
        text: 'one way text',
        speaker: 'S_demo',
        audio_params: { format: 'pcm' },
      },
    },
    { onEvent: (event) => events.push(event) },
  );
  await session.connect();
  await serverDone;
  await waitFor(() => events.some((event) => event.event === 'SessionFinished'));
  assert.equal(session.isOpen(), false);
  await new Promise((resolve) => server.close(resolve));
}

async function waitFor(predicate) {
  const deadline = Date.now() + 1000;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
