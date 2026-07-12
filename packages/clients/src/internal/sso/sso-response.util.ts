import type { AxiosResponse } from "axios";

/**
 * SSO Internal API 标准响应信封。
 *
 * SSO 所有 internal 端点统一返回 { code, msg, data }；
 * code 为 0 或 200 表示成功，其余均为业务失败。
 */
export interface SsoApiResponse<T = unknown> {
  code: number;
  msg?: string;
  data?: T;
}

/**
 * SSO Internal API 调用失败时抛出的错误。
 *
 * 携带 HTTP status、业务 code 与 operation，便于调用方按需降级
 * （例如列表接口在 SSO 抖动时回退空数组，而非把 undefined 透传给下游）。
 */
export class SsoInternalApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | undefined,
    readonly operation: string,
  ) {
    super(message);
    this.name = "SsoInternalApiError";
  }
}

function isSuccessCode(code: unknown): boolean {
  return code === 0 || code === 200;
}

function isSsoApiResponse(body: unknown): body is SsoApiResponse {
  return (
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof (body as { code: unknown }).code === "number" &&
    "msg" in body
  );
}

/**
 * 解包 SSO Internal API 响应：
 * - 信封缺失/格式不符（如 SSO 不可用时网关返回 HTML）→ 抛 SsoInternalApiError
 *   （message: "<operation> failed: unexpected response envelope"）
 * - HTTP 非 200 或业务 code 非 0/200 → 抛 SsoInternalApiError（含 msg）
 * - 成功 → 返回 data
 *
 * 替代裸 `response.data.data`，避免 SSO 抖动时把 undefined 透传给调用方
 * 导致下游 `.map()` 等操作崩溃（见 models 侧 `roles.map is not a function`）。
 */
export function unwrapSsoResponse<T>(
  response: AxiosResponse<unknown>,
  operation: string,
): T {
  const body = response.data;

  if (!isSsoApiResponse(body)) {
    throw new SsoInternalApiError(
      `${operation} failed: unexpected response envelope`,
      response.status,
      undefined,
      operation,
    );
  }

  if (response.status !== 200 || !isSuccessCode(body.code)) {
    throw new SsoInternalApiError(
      `${operation} failed: ${body.msg ?? "unknown error"}`,
      response.status,
      body.code,
      operation,
    );
  }

  return body.data as T;
}
