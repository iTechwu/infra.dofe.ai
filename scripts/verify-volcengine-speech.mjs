import assert from 'node:assert/strict';
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
} from '../packages/shared-services/dist/volcengine-speech/auth/index.js';
import {
  resolveVolcengineSpeechConfig as resolveConfig,
} from '../packages/shared-services/dist/volcengine-speech/config/volcengine-speech.defaults.js';
import {
  validateCreateAudioRequest,
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
  buildTtsPayload,
  TTS_DEFAULT_MODEL,
} from '../packages/shared-services/dist/volcengine-tts/tts-payload.js';
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

const codec = new VolcengineWebSocketCodec();

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
assert.throws(() => resolveConfig({ apiKey: 'test-api-key', timeoutMs: 0 }), /timeoutMs/);
assert.throws(() => resolveConfig({ apiKey: 'test-api-key', maxRetries: -1 }), /maxRetries/);
assert.throws(() => resolveConfig({ apiKey: 'test-api-key', endpoints: { memo: '   ' } }), /endpoints.memo/);
assert.throws(() => resolveConfig({ apiKey: 'test-api-key', endpoints: { memo: 'not-url' } }), /absolute URL/);

const headers = buildHeaders(resolved, { requestId: 'request-1' });
assert.equal(headers['X-Api-Key'], 'test-api-key');
assert.equal(headers['X-Api-Request-Id'], 'request-1');

const legacy = resolveConfig({
  authMode: 'legacy',
  appId: 'app-id',
  accessKey: 'access-key',
});
const legacyHeaders = buildHeaders(legacy, {
  requestId: 'legacy-request',
  headers: { 'X-Custom-Trace': 'trace-1' },
});
assert.equal(legacyHeaders['X-Api-App-Id'], 'app-id');
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
assert.throws(
  () => validateRequiredString('   ', 'taskId'),
  VolcengineSpeechValidationError,
);
assert.throws(() => validateRequestOptions({ requestId: ' ' }), /requestId/);
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

process.stdout.write('[verify-volcengine-speech] ok\n');
