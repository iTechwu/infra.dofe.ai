import { existsSync } from 'fs';
import path from 'path';

export interface FindWorkspaceRootOptions {
  startDir?: string;
  envRoot?: string;
  markerFiles?: readonly string[];
  fallback?: string;
}

export function findWorkspaceRoot(options: FindWorkspaceRootOptions = {}): string {
  const fallback = path.resolve(options.fallback ?? process.cwd());
  let current = path.resolve(options.envRoot || options.startDir || process.cwd());
  const markerFiles = options.markerFiles ?? ['pnpm-workspace.yaml'];

  for (;;) {
    if (markerFiles.every((marker) => existsSync(path.join(current, marker)))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return fallback;
    }
    current = parent;
  }
}

export function resolveConfiguredRoots(
  configured: string | undefined,
  fallbackRoot: string,
  delimiter = path.delimiter,
): string[] {
  const roots = (configured ?? '')
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean);

  return (roots.length > 0 ? roots : [fallbackRoot]).map((root) =>
    path.resolve(root),
  );
}
