import path from 'path';
import { stat } from 'fs/promises';

export interface ResolveAllowedPathOptions {
  input: string;
  allowedRoots: readonly string[];
  mustExist?: boolean;
  directoryOnly?: boolean;
  fieldName?: string;
}

export function isSameOrChildPath(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

export function normalizeAllowedRoots(roots: readonly string[]): string[] {
  return roots.map((root) => path.resolve(root));
}

export async function resolveAllowedTargetPath(
  options: ResolveAllowedPathOptions,
): Promise<string> {
  const fieldName = options.fieldName ?? 'path';
  if (!path.isAbsolute(options.input)) {
    throw new Error(`${fieldName} must be an absolute path`);
  }

  const target = path.resolve(options.input);
  const allowedRoots = normalizeAllowedRoots(options.allowedRoots);
  if (!allowedRoots.some((root) => isSameOrChildPath(root, target))) {
    throw new Error(`${fieldName} is outside allowed roots: ${target}`);
  }

  if (options.mustExist || options.directoryOnly) {
    const current = await stat(target).catch(() => undefined);
    if (!current) {
      throw new Error(`${fieldName} does not exist: ${target}`);
    }
    if (options.directoryOnly && !current.isDirectory()) {
      throw new Error(`${fieldName} is not a directory: ${target}`);
    }
  }

  return target;
}

export function interpolatePathTemplate(
  template: string,
  values: Record<string, string | number | boolean | null | undefined>,
): string {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined || value === null ? match : String(value);
  });
}
