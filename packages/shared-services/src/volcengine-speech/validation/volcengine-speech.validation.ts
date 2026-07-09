import {
  CreateAudioRequest,
  VolcengineSpeechReference,
  VolcengineSpeechRequestOptions,
  VolcengineSpeechTaskRequest,
} from '../types';
import { VolcengineSpeechValidationError } from '../errors';

const AUDIO_REFERENCE_KEYS = ['speaker', 'audio_data', 'audio_url'] as const;
const IMAGE_REFERENCE_KEYS = ['image_data', 'image_url'] as const;
const SUPPORTED_AUDIO_FORMATS = ['wav', 'mp3', 'pcm', 'ogg_opus'] as const;
const SUPPORTED_SAMPLE_RATES = [8000, 16000, 24000, 32000, 44100, 48000] as const;

export function validateCreateAudioRequest(request: CreateAudioRequest): void {
  if (!request.model?.trim()) {
    throwValidation('model is required', 'model');
  }
  if (!request.text_prompt?.trim()) {
    throwValidation('text_prompt is required', 'text_prompt');
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

export function validateRequiredString(value: string, field: string): void {
  if (!value.trim()) {
    throwValidation(`${field} is required`, field);
  }
}

export function validateRequestOptions(
  options: VolcengineSpeechRequestOptions = {},
): void {
  if (options.requestId !== undefined) {
    validateRequiredString(options.requestId, 'requestId');
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
  if (value < min || value > max) {
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
