/**
 * Shared type stubs for the Docker package.
 * Kept local to avoid depending on @repo/contracts (agents-specific).
 */

// ── Bot Type ──
export type BotType = string;

// ── AI Provider ──
export type ProviderVendor = string;

export interface ProviderConfig {
  name: string;
  models: string[];
  apiHost?: string;
  [key: string]: any;
}

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {};

/** Always returns null in the infra build. Agents provides the real mapping. */
export function getOpenclawNativeProvider(_provider: string): any {
  return null;
}

// ── Container Stats ──
export interface ContainerStats {
  hostname: string;
  name: string;
  containerId: string;
  pid: number | null;
  uptimeSeconds: number | null;
  startedAt: string | null;
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
  timestamp: string;
}

// ── Orphan Report ──
export interface OrphanReport {
  orphanedContainers: string[];
  orphanedWorkspaces: string[];
  orphanedSecrets: string[];
  total: number;
}

// ── Cleanup Report ──
export interface CleanupReport {
  success: boolean;
  containersRemoved: number;
  workspacesRemoved: number;
  secretsRemoved: number;
}
