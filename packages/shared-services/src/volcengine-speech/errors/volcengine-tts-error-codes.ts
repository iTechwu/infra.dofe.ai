export type VolcengineTtsCapability =
  | 'audio_generation'
  | 'tts_http'
  | 'tts_one_way_ws'
  | 'tts_duplex_ws'
  | 'tts_long_text'
  | 'voice_training'
  | 'voice_query'
  | 'voice_upgrade'
  | 'voice_design'
  | 'voice_management';

export type VolcengineTtsErrorCategory =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'quota'
  | 'rate_limit'
  | 'voice_state'
  | 'content_policy'
  | 'upstream'
  | 'protocol'
  | 'unknown';

export interface VolcengineTtsFailureInput {
  capability: VolcengineTtsCapability;
  providerCode?: number | string;
  httpStatus?: number;
}

export interface VolcengineTtsFailureClassification {
  category: VolcengineTtsErrorCategory;
  retryable: boolean;
}

const QUOTA_CODES = new Set([45001123]);
const VOICE_STATE_CODES = new Set([45001001, 45001107, 45001110]);
const CONTENT_POLICY_CODES = new Set([
  45001124,
  45001125,
  45001127,
  45001128,
  45002000,
]);
const VALIDATION_CODES = new Set([
  40000000,
  40000001,
  40000002,
  45000000,
  45000001,
  45001101,
  45001102,
  45001104,
  45001105,
  45001108,
  45001109,
  45001112,
  45001113,
  45001114,
  45001122,
  45001126,
  45002001,
]);
const RETRYABLE_UPSTREAM_CODES = new Set([
  55000000,
  55000001,
  55000002,
  55001301,
  55001302,
  55001303,
  55001304,
  55001305,
  55001306,
  55001307,
  55001309,
]);

/**
 * Classifies only error codes documented for the TTS and voice endpoints.
 * Unknown vendor codes intentionally remain unknown so callers do not make
 * unsafe retry or user-message decisions from a guessed category.
 */
export function classifyVolcengineTtsFailure(
  input: VolcengineTtsFailureInput,
): VolcengineTtsFailureClassification {
  if (input.httpStatus === 401) {
    return { category: 'authentication', retryable: false };
  }
  if (input.httpStatus === 403) {
    return { category: 'authorization', retryable: false };
  }
  if (input.httpStatus === 429) {
    return { category: 'rate_limit', retryable: true };
  }
  if (
    input.httpStatus !== undefined &&
    input.httpStatus >= 500 &&
    input.httpStatus <= 599
  ) {
    return { category: 'upstream', retryable: true };
  }

  const code = normalizeProviderCode(input.providerCode);
  if (code === undefined) {
    return { category: 'unknown', retryable: false };
  }
  if (QUOTA_CODES.has(code)) {
    return { category: 'quota', retryable: false };
  }
  if (VOICE_STATE_CODES.has(code)) {
    return { category: 'voice_state', retryable: false };
  }
  if (CONTENT_POLICY_CODES.has(code)) {
    return { category: 'content_policy', retryable: false };
  }
  if (VALIDATION_CODES.has(code)) {
    return { category: 'validation', retryable: false };
  }
  if (RETRYABLE_UPSTREAM_CODES.has(code)) {
    return { category: 'upstream', retryable: true };
  }
  return { category: 'unknown', retryable: false };
}

function normalizeProviderCode(value: number | string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = Number(value);
  return Number.isInteger(normalized) ? normalized : undefined;
}
