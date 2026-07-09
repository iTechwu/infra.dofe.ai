/**
 * @fileoverview 火山语音 HTTP 响应头读取的共享纯函数
 *
 * @description 统一 transport（读取任意响应头/`X-Tt-Logid`）与错误归一化
 * （从失败响应捕获 `X-Tt-Logid`）两处重复的大小写不敏感读取逻辑。
 *
 * 同时兼容两种形态的响应头：
 * - AxiosHeaders-like：带 `.get(name)` 方法（axios v1）。
 * - 普通对象：键值对，键名大小写不敏感比较。
 *
 * 多值头（数组）取第一个非空项；其余规范化为字符串。
 */

export function readVolcengineHeader(
  headers: Record<string, unknown> | undefined,
  name: string,
): string | undefined {
  if (!headers) {
    return undefined;
  }

  const getter = (headers as { get?: (headerName: string) => unknown }).get;
  if (typeof getter === 'function') {
    const viaGetter =
      getter.call(headers, name) ?? getter.call(headers, name.toLowerCase());
    const coerced = coerceHeaderValue(viaGetter);
    if (coerced !== undefined) {
      return coerced;
    }
  }

  const normalized = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== normalized) {
      continue;
    }
    const coerced = coerceHeaderValue(value);
    if (coerced !== undefined) {
      return coerced;
    }
  }

  return undefined;
}

function coerceHeaderValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item === undefined || item === null || item === '') {
        continue;
      }
      return String(item);
    }
    return undefined;
  }
  if (value === '') {
    return undefined;
  }
  return String(value);
}
