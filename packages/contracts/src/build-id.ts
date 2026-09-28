/**
 * 客户端构建号（App Build）解析与校验纯函数。
 *
 * 规范格式: YYYY.MM.DD-<hash>-g<generation>，例如 2025.03.18-abcdef-g1。
 * 作为 Web(代际号) 与 APP(Contract) 双轨版本校验的单一事实源，
 * 供 VersionGuard、web 构建期校验与前端运行时共同复用。
 */

/** 规范构建号格式（hash 段为 git short sha 或占位 000000） */
export const APP_BUILD_PATTERN = /^\d{4}\.\d{2}\.\d{2}-[0-9a-f]{4,16}-g\d+$/;

/** 免校验构建号白名单，与 VersionGuard 的放行语义保持一致 */
export const SKIP_APP_BUILD_VALUES = ['dev', 'server'] as const;

/**
 * 是否跳过构建号校验（空值或白名单值）
 * @param build 构建号
 */
export function isSkippedAppBuild(build: string | undefined | null): boolean {
  return !build || (SKIP_APP_BUILD_VALUES as readonly string[]).includes(build);
}

/**
 * 从构建号中提取代际号（generation）
 * @param build 构建号字符串（格式: YYYY.MM.DD-hash-gNN）
 * @returns 代际号，无法解析时返回 0
 */
export function extractGeneration(build: string): number {
  const match = build.match(/-g(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * 比较两个构建号的代际号
 * @returns a 小于 b 返回 -1，大于返回 1，相等返回 0
 */
export function compareGenerations(a: string, b: string): number {
  const ga = extractGeneration(a);
  const gb = extractGeneration(b);
  return ga === gb ? 0 : ga < gb ? -1 : 1;
}

/**
 * 是否为规范构建号
 * @param value 任意输入
 */
export function isValidAppBuild(value: unknown): boolean {
  return typeof value === 'string' && APP_BUILD_PATTERN.test(value);
}
