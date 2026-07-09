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
  validateAsrRequest,
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
  VolcengineSpeechValidationError,
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

const codec = new VolcengineWebSocketCodec();
const sharedServicesRequire = createRequire(
  new URL('../packages/shared-services/package.json', import.meta.url),
);

const jsonFrame = codec.decode(codec.encodeJsonRequest({ text: 'hello' }, 1));
assert.equal(jsonFrame.messageType, VOLCENGINE_WS_MESSAGE_TYPE.FULL_CLIENT_REQUEST);
assert.equal(jsonFrame.sequence, 1);
assert.deepEqual(jsonFrame.json, { text: 'hello' });

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
assert.equal(resolved.authMode, 'api-key');
assert.equal(resolved.endpoints.audioGeneration, 'https://example.test/create');
assert.equal(resolved.endpoints.asrStandard, 'https://openspeech.bytedance.com/api/v3/auc/bigmodel');
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

const legacy = resolveConfig({
  authMode: 'legacy',
  appId: 'app-id',
  accessKey: 'access-key',
});
const legacyHeaders = buildHeaders(legacy, {
  requestId: 'legacy-request',
  headers: { 'X-Custom-Trace': 'trace-1' },
});
assert.equal(legacyHeaders['X-Api-App-Key'], 'app-id');
assert.equal(legacyHeaders['X-Api-Access-Key'], 'access-key');
assert.equal(legacyHeaders['X-Custom-Trace'], 'trace-1');

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

// shared auth headers (extracted for volcengine-tts delegation)
const authHeaders = buildVolcengineAuthHeaders({
  authMode: 'api-key',
  apiKey: 'ak',
  appId: '',
  accessKey: '',
  resourceId: 'rid',
});
assert.equal(authHeaders['X-Api-Key'], 'ak');
assert.equal(authHeaders['X-Api-Resource-Id'], 'rid');
assert.equal(authHeaders['X-Api-Request-Id'], undefined); // auth-only, no request-id

const legacyAuthHeaders = buildVolcengineAuthHeaders({
  authMode: 'legacy',
  apiKey: '',
  appId: 'app',
  accessKey: 'acc',
  resourceId: '',
});
assert.equal(legacyAuthHeaders['X-Api-App-Key'], 'app');
assert.equal(legacyAuthHeaders['X-Api-Access-Key'], 'acc');
assert.equal(legacyAuthHeaders['X-Api-Resource-Id'], undefined);

validateCreateAudioRequest({
  model: 'seed-audio-1.0',
  text_prompt: 'hello',
  references: [{ audio_url: 'https://example.test/a.mp3' }],
});
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
      resourceId: ' ',
    }),
  /resourceId/,
);
assert.throws(
  () => validateRequiredString('   ', 'taskId'),
  VolcengineSpeechValidationError,
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

assert.equal(isRetryableVolcengineSpeechCode(55000031), true);
assert.equal(isRetryableVolcengineSpeechCode(45000081), true);
assert.equal(isRetryableVolcengineSpeechCode(45000001), false);
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

const idleSession = new VolcengineWebSocketSession(
  {},
  { url: 'wss://example.test/dialogue' },
);
assert.equal(idleSession.isOpen(), false);
idleSession.close();
assert.equal(idleSession.isOpen(), false);
assert.throws(() => idleSession.sendJson({ text: 'hi' }), /not open/);
assert.throws(() => idleSession.sendAudio(Buffer.from([1, 2, 3, 4])), /not open/);

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
assert.equal(readVolcengineHeader({ 'x-tt-logid': [undefined, '', 'log-4'] }, 'x-tt-logid'), 'log-4');
assert.equal(readVolcengineHeader({ 'x-tt-logid': '' }, 'x-tt-logid'), undefined);
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
