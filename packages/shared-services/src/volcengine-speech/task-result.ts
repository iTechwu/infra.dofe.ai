import type {
  VolcengineSpeechResult,
  VolcengineSpeechTaskResult,
} from './types';

const TASK_ERROR_KEYS = ['error', 'err_msg', 'error_message'] as const;
const VOLCENGINE_SUCCESS_STATUS_CODE = '20000000';

export function normalizeBodyTaskResult<T>(
  result: VolcengineSpeechResult<Record<string, unknown>>,
  fallbackTaskId?: string,
): VolcengineSpeechTaskResult<T> {
  const data = result.data ?? {};
  const status = getString(data.status);
  return {
    taskId:
      getString(data.task_id) ?? getString(data.taskId) ?? fallbackTaskId ?? '',
    status,
    result: data.result as T,
    error: extractTaskError(data, status),
    requestId: result.requestId,
    logId: result.logId,
    raw: result.raw,
  };
}

export function normalizeHeaderStatusTaskResult<T>(params: {
  taskId?: string;
  statusCode?: string;
  statusMessage?: string;
  result?: T;
  requestId?: string;
  logId?: string;
  raw: unknown;
}): VolcengineSpeechTaskResult<T> {
  const statusCode = getString(params.statusCode);
  const statusMessage = getString(params.statusMessage);
  const isFailure =
    statusCode !== undefined && statusCode !== VOLCENGINE_SUCCESS_STATUS_CODE;

  return {
    taskId: params.taskId ?? params.logId ?? params.requestId ?? '',
    statusCode,
    statusMessage,
    result: params.result,
    error: isFailure
      ? (statusMessage ?? `Volcengine speech task failed: ${statusCode}`)
      : undefined,
    requestId: params.requestId,
    logId: params.logId,
    raw: params.raw,
  };
}

/**
 * Extracts a task-level error from explicit error fields. A free-form
 * `message` is only treated as an error when the task `status` itself signals
 * failure, so a success message (e.g. `message: 'success'`) is never mislabeled
 * as a task error.
 */
export function extractTaskError(
  data: Record<string, unknown>,
  status?: string,
): string | undefined {
  for (const key of TASK_ERROR_KEYS) {
    const value = getString(data[key]);
    if (value) {
      return value;
    }
  }
  if (isFailureStatus(status)) {
    return getString(data.message);
  }
  return undefined;
}

function isFailureStatus(status?: string): boolean {
  if (!status) {
    return false;
  }
  const normalized = status.toLowerCase();
  return (
    normalized === 'error' ||
    normalized === 'failed' ||
    normalized.includes('fail')
  );
}

function getString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
