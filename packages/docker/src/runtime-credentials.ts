/**
 * Runtime credential values that may be injected into a managed Bot container.
 * Keys are deliberately restricted so callers cannot replace manager-owned
 * gateway, proxy, provider, or model configuration.
 */
export type RuntimeCredentialEnv = Readonly<Record<string, string>>;

const ACCESS_KEY_PATTERN = /^([A-Z][A-Z0-9_]*)_(ACCESS_KEY_ID|SECRET_ACCESS_KEY)$/;
const SEEDANCE_ASSET_API_BASE_URL = 'SEEDANCE_ASSET_API_BASE_URL';

function envKey(entry: string): string {
  const index = entry.indexOf('=');
  return index === -1 ? entry : entry.slice(0, index);
}

function assertCredentialValue(key: string, value: string): void {
  if (!value.trim() || /[\r\n\0]/.test(value)) {
    throw new Error(`Dynamic runtime credential ${key} must be a non-empty single-line value`);
  }
}

/**
 * Appends validated AK/SK credential pairs without allowing a caller to
 * override an environment value already managed by DockerService.
 */
export function appendRuntimeCredentialEnv(
  environment: string[],
  runtimeEnv?: RuntimeCredentialEnv,
): void {
  if (!runtimeEnv) return;

  const existing = new Set(environment.map(envKey));
  const credentialPairs = new Map<string, Set<string>>();

  for (const [key, value] of Object.entries(runtimeEnv)) {
    const accessKeyMatch = ACCESS_KEY_PATTERN.exec(key);
    const isSeedanceBaseUrl = key === SEEDANCE_ASSET_API_BASE_URL;
    if (!accessKeyMatch && !isSeedanceBaseUrl) {
      throw new Error(`Dynamic runtime environment key ${key} is not allowed`);
    }
    if (existing.has(key)) {
      throw new Error(`Dynamic runtime environment key ${key} cannot override a managed value`);
    }
    assertCredentialValue(key, value);

    if (accessKeyMatch) {
      const [, prefix, suffix] = accessKeyMatch;
      const pair = credentialPairs.get(prefix) ?? new Set<string>();
      pair.add(suffix);
      credentialPairs.set(prefix, pair);
    }
  }

  for (const [prefix, pair] of credentialPairs) {
    if (!pair.has('ACCESS_KEY_ID') || !pair.has('SECRET_ACCESS_KEY')) {
      throw new Error(
        `Dynamic runtime credentials for ${prefix} must include both ACCESS_KEY_ID and SECRET_ACCESS_KEY`,
      );
    }
  }

  for (const [key, value] of Object.entries(runtimeEnv)) {
    environment.push(`${key}=${value}`);
  }
}
