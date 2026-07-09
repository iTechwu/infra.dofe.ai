import type {
  VolcengineSpeechResult,
  VolcengineSpeechTaskResult,
} from '../types';
import { normalizeBodyTaskResult } from '../task-result';

export { extractTaskError } from '../task-result';

/**
 * Normalizes a raw memo task response into the stable
 * {@link VolcengineSpeechTaskResult} shape, mapping `task_id`/`taskId`,
 * status, result and request/log ids.
 */
export function normalizeTaskResult<T>(
  result: VolcengineSpeechResult<Record<string, unknown>>,
  fallbackTaskId?: string,
): VolcengineSpeechTaskResult<T> {
  return normalizeBodyTaskResult<T>(result, fallbackTaskId);
}
