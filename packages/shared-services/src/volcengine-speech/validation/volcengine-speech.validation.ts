import {
  CreateAudioRequest,
  VolcengineSpeechReference,
  VolcengineSpeechRequestOptions,
  VolcengineSpeechTaskRequest,
  VolcengineAsrRequest,
  VolcengineAsrMode,
  VolcengineInterpretationRequest,
  VolcengineStreamingAsrRequest,
} from '../types';
import { VolcengineSpeechValidationError } from '../errors';
import {
  VolcengineTtsHttpRequest,
  VolcengineTtsLongTextSubmitRequest,
} from '../tts/tts.types';
import {
  VolcengineVoiceLookupRequest,
  VolcengineVoiceTrainingRequest,
  VolcengineVoiceDesignRequest,
} from '../voice/voice.types';

const AUDIO_REFERENCE_KEYS = ['speaker', 'audio_data', 'audio_url'] as const;
const IMAGE_REFERENCE_KEYS = ['image_data', 'image_url'] as const;
const SUPPORTED_AUDIO_FORMATS = ['wav', 'mp3', 'pcm', 'ogg_opus'] as const;
const SUPPORTED_SAMPLE_RATES = [8000, 16000, 24000, 32000, 44100, 48000] as const;
const SUPPORTED_ASR_MODES = ['standard', 'fast', 'offPeak'] as const;
const RESERVED_ASR_OPTION_KEYS = ['audio', 'callback'] as const;
const TTS_SAMPLE_RATES = [8000, 16000, 22050, 24000, 32000, 44100, 48000] as const;

export function validateCreateAudioRequest(request: CreateAudioRequest): void {
  if (!request.model?.trim()) {
    throwValidation('model is required', 'model');
  }
  if (request.model !== 'seed-audio-1.0') {
    throwValidation('model must be seed-audio-1.0', 'model');
  }
  if (!request.text_prompt?.trim()) {
    throwValidation('text_prompt is required', 'text_prompt');
  }
  if (request.text_prompt.length > 3000) {
    throwValidation('text_prompt cannot exceed 3000 characters', 'text_prompt');
  }

  const references = request.references ?? [];
  if (references.length > 3) {
    throwValidation('references cannot exceed 3 items', 'references');
  }

  const audioReferenceCount = references.filter(hasAudioReference).length;
  const imageReferenceCount = references.filter(hasImageReference).length;
  if (imageReferenceCount > 1) {
    throwValidation('image reference cannot exceed 1 item', 'references');
  }
  if (audioReferenceCount > 0 && imageReferenceCount > 0) {
    throwValidation('audio references and image references cannot be mixed', 'references');
  }

  for (const reference of references) {
    validateReference(reference);
  }
  validateAudioConfig(request.audio_config);
}

export function validateMemoTaskRequest(
  request: VolcengineSpeechTaskRequest,
): void {
  if (!hasText(request.audioUrl) && !hasText(request.resourceUrl)) {
    throwValidation('audioUrl or resourceUrl is required', 'audioUrl');
  }
}

export function validateAsrRequest(request: VolcengineAsrRequest): void {
  if (!hasText(request.audioUrl)) {
    throwValidation('audioUrl is required', 'audioUrl');
  }
  validateAsrMode(request.mode ?? 'standard');
  if (request.callbackUrl !== undefined && !hasText(request.callbackUrl)) {
    throwValidation('callbackUrl must be a non-empty string', 'callbackUrl');
  }
  if (request.resourceId !== undefined && !hasText(request.resourceId)) {
    throwValidation('resourceId must be a non-empty string', 'resourceId');
  }
  for (const key of RESERVED_ASR_OPTION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(request.options ?? {}, key)) {
      throwValidation(`options.${key} is reserved`, `options.${key}`);
    }
  }
}

export function validateAsrMode(mode: VolcengineAsrMode): void {
  if (!SUPPORTED_ASR_MODES.includes(mode)) {
    throwValidation(`unsupported ASR mode: ${String(mode)}`, 'mode');
  }
}

export function validateInterpretationRequest(
  request: VolcengineInterpretationRequest,
): void {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throwValidation('interpretation init payload must be an object', 'initPayload');
  }
  validateOptionalString(request.session_id, 'session_id');
  validateOptionalString(request.source_language, 'source_language');
  validateOptionalString(request.target_language, 'target_language');
  validateOptionalString(request.audio_format, 'audio_format');
  if (
    request.sample_rate !== undefined &&
    (!Number.isFinite(request.sample_rate) || request.sample_rate <= 0)
  ) {
    throwValidation('sample_rate must be a positive number', 'sample_rate');
  }
}

export function validateStreamingAsrRequest(
  request: VolcengineStreamingAsrRequest,
): void {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throwValidation('streaming ASR init payload must be an object', 'initPayload');
  }
  if (request.user !== undefined) {
    if (typeof request.user !== 'object' || request.user === null || Array.isArray(request.user)) {
      throwValidation('user must be an object', 'user');
    }
    validateOptionalString(request.user.uid, 'user.uid');
  }
  if (request.audio !== undefined) {
    const audio = request.audio;
    if (typeof audio !== 'object' || audio === null || Array.isArray(audio)) {
      throwValidation('audio must be an object', 'audio');
    }
    validateOptionalString(audio.format, 'audio.format');
    validateOptionalString(audio.codec, 'audio.codec');
    validateOptionalString(audio.language, 'audio.language');
    validatePositiveIntField(audio.rate, 'audio.rate');
    validatePositiveIntField(audio.bits, 'audio.bits');
    validatePositiveIntField(audio.channel, 'audio.channel');
  }
  if (request.request !== undefined) {
    if (typeof request.request !== 'object' || request.request === null || Array.isArray(request.request)) {
      throwValidation('request must be an object', 'request');
    }
    validateOptionalString(request.request.model_name, 'request.model_name');
  }
}

export function validateTtsHttpRequest(
  request: VolcengineTtsHttpRequest,
): void {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throwValidation('TTS request must be an object', 'request');
  }
  const params = request.req_params;
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throwValidation('req_params is required', 'req_params');
  }
  if (!hasText(params.text) && !hasText(params.ssml)) {
    throwValidation('text or ssml is required', 'req_params');
  }
  validateRequiredString(params.speaker, 'req_params.speaker');
  if (
    !params.audio_params ||
    typeof params.audio_params !== 'object' ||
    Array.isArray(params.audio_params)
  ) {
    throwValidation('audio_params is required', 'req_params.audio_params');
  }
  const audioParams = params.audio_params;
  if (
    audioParams.format !== undefined &&
    !SUPPORTED_AUDIO_FORMATS.includes(audioParams.format)
  ) {
    throwValidation('unsupported audio format', 'req_params.audio_params.format');
  }
  if (
    audioParams.sample_rate !== undefined &&
    !TTS_SAMPLE_RATES.includes(audioParams.sample_rate)
  ) {
    throwValidation('unsupported sample rate', 'req_params.audio_params.sample_rate');
  }
  assertRange(audioParams.speech_rate, -50, 100, 'req_params.audio_params.speech_rate');
  assertRange(audioParams.loudness_rate, -50, 100, 'req_params.audio_params.loudness_rate');
  if (
    audioParams.emotion_scale !== undefined &&
    (!Number.isInteger(audioParams.emotion_scale) ||
      audioParams.emotion_scale < 1 ||
      audioParams.emotion_scale > 5)
  ) {
    throwValidation('emotion_scale must be between 1 and 5', 'req_params.audio_params.emotion_scale');
  }
}

export function validateTtsLongTextSubmitRequest(
  request: VolcengineTtsLongTextSubmitRequest,
): void {
  validateTtsHttpRequest(request);
  const textLength = Math.max(request.req_params.text?.length ?? 0, request.req_params.ssml?.length ?? 0);
  if (textLength > 100000) {
    throwValidation('text or ssml cannot exceed 100000 characters', 'req_params');
  }
  if (request.unique_id !== undefined && (request.unique_id.length < 20 || request.unique_id.length > 64)) {
    throwValidation('unique_id length must be between 20 and 64 characters', 'unique_id');
  }
}

export function validateVoiceTrainingRequest(
  request: VolcengineVoiceTrainingRequest,
): void {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throwValidation('voice training request must be an object', 'request');
  }
  validateRequiredString(request.speaker_id, 'speaker_id');
  if (
    !request.audio ||
    typeof request.audio !== 'object' ||
    Array.isArray(request.audio)
  ) {
    throwValidation('audio is required', 'audio');
  }
  validateRequiredString(request.audio.data, 'audio.data');
  validateRequiredString(request.audio.format, 'audio.format');
  validateOptionalString(request.text, 'text');
  validateOptionalString(request.language, 'language');
  if (
    request.extra_params !== undefined &&
    (typeof request.extra_params !== 'object' ||
      request.extra_params === null ||
      Array.isArray(request.extra_params))
  ) {
    throwValidation('extra_params must be an object', 'extra_params');
  }
}

export function validateVoiceLookupRequest(
  request: VolcengineVoiceLookupRequest,
): void {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throwValidation('voice lookup request must be an object', 'request');
  }
  validateRequiredString(request.speaker_id, 'speaker_id');
  validateOptionalString(request.custom_speaker_id, 'custom_speaker_id');
}

export function validateVoiceDesignRequest(request: VolcengineVoiceDesignRequest): void {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throwValidation('voice design request must be an object', 'request');
  validateRequiredString(request.speaker_id, 'speaker_id');
  validateRequiredString(request.prompt, 'prompt');
  if (!hasText(request.text_prompt) && !hasText(request.image_url) && !hasText(request.image_bytes)) throwValidation('text_prompt or image is required', 'text_prompt');
  if (hasText(request.image_url) && hasText(request.image_bytes)) throwValidation('image_url and image_bytes are mutually exclusive', 'image_url');
  if (request.text_prompt && request.text_prompt.length > 200) throwValidation('text_prompt cannot exceed 200 characters', 'text_prompt');
}

export function validateRequiredString(value: unknown, field: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throwValidation(`${field} is required`, field);
  }
}

function validateOptionalString(value: unknown, field: string): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'string' || !value.trim()) {
    throwValidation(`${field} must be a non-empty string`, field);
  }
}

function validatePositiveIntField(value: unknown, field: string): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throwValidation(`${field} must be a positive number`, field);
  }
}

export function validateRequestOptions(
  options: VolcengineSpeechRequestOptions = {},
): void {
  if (options.requestId !== undefined) {
    validateRequiredString(options.requestId, 'requestId');
  }
  if (options.resourceId !== undefined) {
    validateRequiredString(options.resourceId, 'resourceId');
  }
  if (
    options.sequence !== undefined &&
    (!Number.isInteger(options.sequence) || options.sequence === 0)
  ) {
    throwValidation('sequence must be a non-zero integer', 'sequence');
  }
  if (
    options.timeoutMs !== undefined &&
    (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)
  ) {
    throwValidation('timeoutMs must be a positive number', 'timeoutMs');
  }
  for (const [key, value] of Object.entries(options.headers ?? {})) {
    validateRequiredString(key, 'headers');
    if (typeof value !== 'string' || !value.trim()) {
      throwValidation(
        `header ${key} value must be a non-empty string`,
        `headers.${key}`,
      );
    }
  }
}

function validateReference(reference: VolcengineSpeechReference): void {
  const providedKeys = [
    ...AUDIO_REFERENCE_KEYS,
    ...IMAGE_REFERENCE_KEYS,
  ].filter((key) => Boolean((reference as Record<string, unknown>)[key]));

  if (providedKeys.length !== 1) {
    throwValidation(
      'each reference must provide exactly one of speaker, audio_data, audio_url, image_data, image_url',
      'references',
    );
  }
}

function validateAudioConfig(
  audioConfig: CreateAudioRequest['audio_config'],
): void {
  if (!audioConfig) {
    return;
  }
  if (
    audioConfig.format &&
    !SUPPORTED_AUDIO_FORMATS.includes(audioConfig.format)
  ) {
    throwValidation(`unsupported audio format: ${audioConfig.format}`, 'audio_config.format');
  }
  if (
    audioConfig.sample_rate &&
    !SUPPORTED_SAMPLE_RATES.includes(audioConfig.sample_rate)
  ) {
    throwValidation(`unsupported sample rate: ${audioConfig.sample_rate}`, 'audio_config.sample_rate');
  }
  assertRange(audioConfig.speech_rate, -50, 100, 'speech_rate');
  assertRange(audioConfig.loudness_rate, -50, 100, 'loudness_rate');
  assertRange(audioConfig.pitch_rate, -12, 12, 'pitch_rate');
}

function assertRange(
  value: number | undefined,
  min: number,
  max: number,
  field: string,
): void {
  if (value === undefined) {
    return;
  }
  if (!Number.isFinite(value) || value < min || value > max) {
    throwValidation(`${field} must be between ${min} and ${max}`, `audio_config.${field}`);
  }
}

function throwValidation(message: string, field?: string): never {
  throw new VolcengineSpeechValidationError(message, field);
}

function hasText(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasAudioReference(reference: VolcengineSpeechReference): boolean {
  return AUDIO_REFERENCE_KEYS.some((key) =>
    Boolean((reference as Record<string, unknown>)[key]),
  );
}

function hasImageReference(reference: VolcengineSpeechReference): boolean {
  return IMAGE_REFERENCE_KEYS.some((key) =>
    Boolean((reference as Record<string, unknown>)[key]),
  );
}
