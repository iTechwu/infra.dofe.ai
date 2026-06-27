import { spawn } from 'node:child_process';
import {
  buildDockerSandboxRunCommand,
  describeDockerSandboxProfile,
} from './docker-sandbox-command';
import type {
  DockerSandboxRunOptions,
  DockerSandboxRunResult,
} from './docker-sandbox.types';

const DEFAULT_MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

export function executeDockerSandbox(
  opts: DockerSandboxRunOptions,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
): Promise<DockerSandboxRunResult> {
  const profile = describeDockerSandboxProfile(opts);
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const args = buildDockerSandboxRunCommand(opts).slice(1);
    const child = spawn('docker', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: opts.timeoutSec ? opts.timeoutSec * 1000 : undefined,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = appendBounded(stdout, chunk.toString('utf8'), maxOutputBytes);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = appendBounded(stderr, chunk.toString('utf8'), maxOutputBytes);
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      resolve({
        exitCode: -1,
        stdout,
        stderr: appendBounded(
          `Spawn error: ${error.message}\n`,
          stderr,
          maxOutputBytes,
        ),
        durationMs: Date.now() - startedAt,
        sandboxProfile: profile,
      });
    });

    child.on('close', (code: number | null) => {
      resolve({
        exitCode: code ?? -1,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
        sandboxProfile: profile,
      });
    });
  });
}

function appendBounded(current: string, next: string, maxBytes: number): string {
  const combined = current + next;
  if (combined.length <= maxBytes) return combined;
  return combined.slice(0, maxBytes);
}
