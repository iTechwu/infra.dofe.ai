/**
 * Docker 孤立资源清理服务
 * 负责检测和清理孤立的容器、工作区和密钥目录
 *
 * 注意：此类不使用 @Injectable 装饰器，由 DockerService 内部实例化
 */

import Docker from 'dockerode';
import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Orphan report types
 */
export interface OrphanReport {
  orphanedContainers: string[];
  orphanedWorkspaces: string[];
  orphanedSecrets: string[];
  total: number;
}

export interface CleanupReport {
  success: boolean;
  containersRemoved: number;
  workspacesRemoved: number;
  secretsRemoved: number;
}

/**
 * Sandbox 孤儿信息
 */
export interface SandboxOrphanInfo {
  containerName: string;
  containerId: string;
  reason: 'gateway_not_found' | 'gateway_stopped' | 'idle';
  gatewayContainer?: string;
  lastUsedAtMs?: number;
  idleMs?: number;
}

/**
 * Sandbox 清理报告
 */
export interface SandboxCleanupReport {
  scanned: number;
  orphansFound: number;
  removed: number;
  skipped: number;
  errors: number;
  details: Array<{
    containerName: string;
    action: 'removed' | 'skipped' | 'error';
    reason: string;
  }>;
}

/**
 * OpenClaw Sandbox Registry 结构
 */
interface SandboxRegistryEntry {
  containerName: string;
  backendId: string;
  sessionKey: string;
  createdAtMs: number;
  lastUsedAtMs: number;
  image: string;
  configHash?: string;
}

interface SandboxRegistry {
  entries: SandboxRegistryEntry[];
}

/**
 * Agent Session 结构
 */
interface AgentSession {
  sessionId: string;
  updatedAt: number;
}

interface SessionsRegistry {
  [sessionKey: string]: AgentSession;
}

/**
 * Docker 孤立资源清理服务
 * 封装孤立资源检测和清理逻辑
 */
export class DockerOrphanCleanerService {
  constructor(
    private readonly docker: Docker | null,
    private readonly dataDir: string,
    private readonly secretsDir: string,
    private readonly containerPrefix: string,
    private readonly logFn: (
      level: 'log' | 'warn' | 'error',
      message: string,
    ) => void,
  ) {}

  /**
   * Check if Docker is available
   */
  isAvailable(): boolean {
    return this.docker !== null;
  }

  /**
   * Find orphaned containers (containers without corresponding database entries)
   * @param knownIsolationKeys - isolation keys (userId_short-hostname) of known bots
   */
  async findOrphanedContainers(
    knownIsolationKeys: string[],
  ): Promise<string[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const containers = await this.docker!.listContainers({
      all: true,
      filters: { label: ['clawbot-manager.managed=true'] },
    });

    const orphaned: string[] = [];
    for (const container of containers) {
      const isolationKey = container.Labels['clawbot-manager.isolation-key'];
      if (isolationKey && !knownIsolationKeys.includes(isolationKey)) {
        orphaned.push(isolationKey);
      }
    }

    return orphaned;
  }

  /**
   * Find orphaned workspaces (workspace directories without corresponding database entries)
   * @param knownIsolationKeys - isolation keys of known bots
   */
  async findOrphanedWorkspaces(
    knownIsolationKeys: string[],
  ): Promise<string[]> {
    try {
      const entries = await readdir(this.dataDir, { withFileTypes: true });
      const orphaned: string[] = [];

      for (const entry of entries) {
        if (entry.isDirectory() && !knownIsolationKeys.includes(entry.name)) {
          orphaned.push(entry.name);
        }
      }

      return orphaned;
    } catch (error) {
      this.logFn('warn', `Failed to scan workspace directory: ${error}`);
      return [];
    }
  }

  /**
   * Find orphaned secrets (secrets directories without corresponding database entries)
   * @param knownIsolationKeys - isolation keys of known bots
   */
  async findOrphanedSecrets(knownIsolationKeys: string[]): Promise<string[]> {
    try {
      const entries = await readdir(this.secretsDir, { withFileTypes: true });
      const orphaned: string[] = [];

      for (const entry of entries) {
        if (entry.isDirectory() && !knownIsolationKeys.includes(entry.name)) {
          orphaned.push(entry.name);
        }
      }

      return orphaned;
    } catch (error) {
      this.logFn('warn', `Failed to scan secrets directory: ${error}`);
      return [];
    }
  }

  /**
   * Get orphan report
   * @param knownIsolationKeys - isolation keys of known bots
   */
  async getOrphanReport(knownIsolationKeys: string[]): Promise<OrphanReport> {
    const orphanedContainers =
      await this.findOrphanedContainers(knownIsolationKeys);
    const orphanedWorkspaces =
      await this.findOrphanedWorkspaces(knownIsolationKeys);
    const orphanedSecrets = await this.findOrphanedSecrets(knownIsolationKeys);

    return {
      orphanedContainers,
      orphanedWorkspaces,
      orphanedSecrets,
      total:
        orphanedContainers.length +
        orphanedWorkspaces.length +
        orphanedSecrets.length,
    };
  }

  /**
   * Cleanup orphaned resources
   * @param knownIsolationKeys - isolation keys of known bots
   */
  async cleanupOrphans(knownIsolationKeys: string[]): Promise<CleanupReport> {
    const report = await this.getOrphanReport(knownIsolationKeys);
    let containersRemoved = 0;
    let workspacesRemoved = 0;
    let secretsRemoved = 0;

    // Clean orphaned containers
    for (const isolationKey of report.orphanedContainers) {
      try {
        const containerName = `${this.containerPrefix}${isolationKey}`;
        const containers = await this.docker!.listContainers({
          all: true,
          filters: { name: [containerName] },
        });

        for (const c of containers) {
          const container = this.docker!.getContainer(c.Id);
          await container.remove({ force: true });
          containersRemoved++;
          this.logFn('log', `Removed orphaned container: ${containerName}`);
        }
      } catch (error) {
        this.logFn(
          'error',
          `Failed to remove container ${isolationKey}: ${error}`,
        );
      }
    }

    // Clean orphaned workspaces
    for (const isolationKey of report.orphanedWorkspaces) {
      try {
        const workspacePath = join(this.dataDir, isolationKey);
        const stats = await stat(workspacePath);
        if (stats.isDirectory()) {
          await rm(workspacePath, { recursive: true, force: true });
          workspacesRemoved++;
          this.logFn('log', `Removed orphaned workspace: ${workspacePath}`);
        }
      } catch (error) {
        this.logFn(
          'error',
          `Failed to remove workspace ${isolationKey}: ${error}`,
        );
      }
    }

    // Clean orphaned secrets
    for (const isolationKey of report.orphanedSecrets) {
      try {
        const secretsPath = join(this.secretsDir, isolationKey);
        const stats = await stat(secretsPath);
        if (stats.isDirectory()) {
          await rm(secretsPath, { recursive: true, force: true });
          secretsRemoved++;
          this.logFn('log', `Removed orphaned secrets: ${secretsPath}`);
        }
      } catch (error) {
        this.logFn(
          'error',
          `Failed to remove secrets ${isolationKey}: ${error}`,
        );
      }
    }

    return {
      success: true,
      containersRemoved,
      workspacesRemoved,
      secretsRemoved,
    };
  }

  /**
   * Cleanup a specific container by isolation key
   */
  async cleanupContainer(isolationKey: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const containerName = `${this.containerPrefix}${isolationKey}`;
      const containers = await this.docker!.listContainers({
        all: true,
        filters: { name: [containerName] },
      });

      for (const c of containers) {
        const container = this.docker!.getContainer(c.Id);
        await container.remove({ force: true });
        this.logFn('log', `Removed container: ${containerName}`);
      }

      return true;
    } catch (error) {
      this.logFn(
        'error',
        `Failed to cleanup container ${isolationKey}: ${error}`,
      );
      return false;
    }
  }

  /**
   * Cleanup workspace directory by isolation key
   */
  async cleanupWorkspace(isolationKey: string): Promise<boolean> {
    try {
      const workspacePath = join(this.dataDir, isolationKey);
      await rm(workspacePath, { recursive: true, force: true });
      this.logFn('log', `Removed workspace: ${workspacePath}`);
      return true;
    } catch (error) {
      this.logFn(
        'error',
        `Failed to cleanup workspace ${isolationKey}: ${error}`,
      );
      return false;
    }
  }

  /**
   * Cleanup secrets directory by isolation key
   */
  async cleanupSecrets(isolationKey: string): Promise<boolean> {
    try {
      const secretsPath = join(this.secretsDir, isolationKey);
      await rm(secretsPath, { recursive: true, force: true });
      this.logFn('log', `Removed secrets: ${secretsPath}`);
      return true;
    } catch (error) {
      this.logFn(
        'error',
        `Failed to cleanup secrets ${isolationKey}: ${error}`,
      );
      return false;
    }
  }

  /**
   * List all sandbox containers
   * Sandbox containers are named with pattern: {hostname}-sandbox or openclaw-browser-sandbox
   */
  async listSandboxContainers(): Promise<Docker.ContainerInfo[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const containers = await this.docker!.listContainers({ all: true });

    // Filter sandbox containers by name pattern
    return containers.filter((container) => {
      const names = container.Names.map((n) => n.replace(/^\//, ''));
      return names.some(
        (name) =>
          name.endsWith('-sandbox') ||
          name === 'openclaw-browser-sandbox' ||
          name.startsWith('openclaw-sandbox-'),
      );
    });
  }

  /**
   * Find the Gateway container associated with a sandbox
   * @param sandboxName - sandbox container name
   * @param knownGatewayContainers - list of known gateway container names
   */
  async findGatewayForSandbox(
    sandboxName: string,
    knownGatewayContainers: string[],
  ): Promise<{ name: string; running: boolean } | null> {
    // Handle special sandbox patterns that don't have a specific gateway association
    if (
      sandboxName === 'openclaw-browser-sandbox' ||
      sandboxName.startsWith('openclaw-sandbox-')
    ) {
      return null;
    }

    // Extract hostname from sandbox name
    const match = sandboxName.match(/^(.+)-sandbox$/);
    if (!match) {
      return null;
    }
    const hostname = match[1];

    // Find gateway with matching hostname
    const gatewayPattern = new RegExp(
      `clawbot-manager-[a-f0-9]{8}-${hostname}$`,
    );
    const matchingGateway = knownGatewayContainers.find((gw) =>
      gatewayPattern.test(gw),
    );

    if (!matchingGateway) {
      return null;
    }

    // Check if gateway is running
    try {
      const containers = await this.docker!.listContainers({
        all: true,
        filters: { name: [matchingGateway] },
      });

      if (containers.length === 0) {
        return null;
      }

      const container = containers[0];
      return {
        name: matchingGateway,
        running: container.State === 'running',
      };
    } catch {
      return null;
    }
  }

  /**
   * Find orphaned sandbox containers (no corresponding gateway)
   * @param knownGatewayContainers - list of known gateway container names
   */
  async findOrphanedSandboxContainers(
    knownGatewayContainers: string[],
  ): Promise<SandboxOrphanInfo[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const sandboxContainers = await this.listSandboxContainers();
    const orphans: SandboxOrphanInfo[] = [];

    for (const container of sandboxContainers) {
      const containerName = container.Names[0]?.replace(/^\//, '') || '';

      // Skip special sandbox patterns
      if (
        containerName === 'openclaw-browser-sandbox' ||
        containerName.startsWith('openclaw-sandbox-')
      ) {
        continue;
      }

      const gateway = await this.findGatewayForSandbox(
        containerName,
        knownGatewayContainers,
      );

      if (!gateway) {
        orphans.push({
          containerName,
          containerId: container.Id,
          reason: 'gateway_not_found',
        });
      } else if (!gateway.running) {
        orphans.push({
          containerName,
          containerId: container.Id,
          reason: 'gateway_stopped',
          gatewayContainer: gateway.name,
        });
      }
    }

    return orphans;
  }

  /**
   * Get activity info for a sandbox container from Gateway's OpenClaw Registry
   */
  async getSandboxActivityInfo(
    gatewayContainerName: string,
    sandboxContainerName: string,
  ): Promise<{ lastUsedAtMs: number | null; agentSessionActive: boolean }> {
    const result = {
      lastUsedAtMs: null as number | null,
      agentSessionActive: false,
    };

    if (!this.isAvailable()) {
      return result;
    }

    try {
      // Read sandbox registry from Gateway container
      const registryCmd = `cat /home/node/.openclaw/.openclaw/sandbox/containers.json 2>/dev/null || echo '{}'`;
      const registryExec = await this.docker!.getContainer(
        gatewayContainerName,
      ).exec({
        Cmd: ['sh', '-c', registryCmd],
        AttachStdout: true,
        AttachStderr: true,
      });

      const container = this.docker!.getContainer(gatewayContainerName);
      const stream = await registryExec.start({ Detach: false });

      const output = await new Promise<string>((resolve, reject) => {
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        container.modem.demuxStream(
          stream,
          { write: (chunk: Buffer) => stdoutChunks.push(chunk) },
          { write: (chunk: Buffer) => stderrChunks.push(chunk) },
        );

        stream.on('end', () => {
          const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim();
          const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
          resolve(stderr ? stdout || stderr : stdout);
        });
        stream.on('error', reject);

        setTimeout(() => {
          const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim();
          resolve(stdout);
        }, 5000);
      });

      const registry: SandboxRegistry = JSON.parse(output);
      const entry = registry.entries?.find(
        (e) => e.containerName === sandboxContainerName,
      );

      if (entry) {
        result.lastUsedAtMs = entry.lastUsedAtMs;
      }

      // Check agent session status
      const sessionsCmd = `cat /home/node/.openclaw/.openclaw/agents/main/sessions/sessions.json 2>/dev/null || echo '{}'`;
      const sessionsExec = await this.docker!.getContainer(
        gatewayContainerName,
      ).exec({
        Cmd: ['sh', '-c', sessionsCmd],
        AttachStdout: true,
        AttachStderr: true,
      });

      const gatewayContainer = this.docker!.getContainer(gatewayContainerName);
      const sessionsStream = await sessionsExec.start({ Detach: false });

      const sessionsData = await new Promise<string>((resolve, reject) => {
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        gatewayContainer.modem.demuxStream(
          sessionsStream,
          { write: (chunk: Buffer) => stdoutChunks.push(chunk) },
          { write: (chunk: Buffer) => stderrChunks.push(chunk) },
        );

        sessionsStream.on('end', () => {
          const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim();
          const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
          resolve(stderr ? stdout || stderr : stdout);
        });
        sessionsStream.on('error', reject);

        setTimeout(() => {
          const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim();
          resolve(stdout);
        }, 5000);
      });

      const sessions: SessionsRegistry = JSON.parse(sessionsData);

      // Check if any session is active
      const now = Date.now();
      const fiveMinutesAgo = now - 300000;

      for (const session of Object.values(sessions)) {
        if (session.updatedAt > fiveMinutesAgo) {
          result.agentSessionActive = true;
          break;
        }
      }

      return result;
    } catch (error) {
      this.logFn('warn', `Failed to get sandbox activity info: ${error}`);
      return result;
    }
  }

  /**
   * Find idle sandbox containers
   */
  async findIdleSandboxContainers(
    knownGatewayContainers: Array<{ name: string; containerId: string }>,
    idleThresholdMs: number,
  ): Promise<SandboxOrphanInfo[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const sandboxContainers = await this.listSandboxContainers();
    const idle: SandboxOrphanInfo[] = [];
    const now = Date.now();

    for (const container of sandboxContainers) {
      const containerName = container.Names[0]?.replace(/^\//, '') || '';

      const gateway = await this.findGatewayForSandbox(
        containerName,
        knownGatewayContainers.map((g) => g.name),
      );

      if (!gateway || !gateway.running) {
        continue;
      }

      const activityInfo = await this.getSandboxActivityInfo(
        gateway.name,
        containerName,
      );

      if (activityInfo.lastUsedAtMs) {
        const idleMs = now - activityInfo.lastUsedAtMs;
        if (idleMs > idleThresholdMs && !activityInfo.agentSessionActive) {
          idle.push({
            containerName,
            containerId: container.Id,
            reason: 'idle',
            gatewayContainer: gateway.name,
            lastUsedAtMs: activityInfo.lastUsedAtMs,
            idleMs,
          });
        }
      }
    }

    return idle;
  }

  /**
   * Cleanup a sandbox container with graceful shutdown
   */
  async cleanupSandboxContainer(
    containerName: string,
    graceful: boolean = true,
  ): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const containers = await this.docker!.listContainers({
        all: true,
        filters: { name: [containerName] },
      });

      if (containers.length === 0) {
        this.logFn('warn', `Sandbox container not found: ${containerName}`);
        return false;
      }

      const container = this.docker!.getContainer(containers[0].Id);
      const containerInfo = containers[0];

      if (graceful && containerInfo.State === 'running') {
        try {
          this.logFn(
            'log',
            `Gracefully shutting down sandbox: ${containerName}`,
          );
          await container.stop({ t: 10 });
          this.logFn('log', `Sandbox stopped gracefully: ${containerName}`);
        } catch (stopError) {
          this.logFn(
            'warn',
            `Graceful shutdown failed for ${containerName}, forcing removal: ${stopError}`,
          );
        }
      }

      await container.remove({ force: true });
      this.logFn('log', `Removed sandbox container: ${containerName}`);

      return true;
    } catch (error) {
      this.logFn(
        'error',
        `Failed to cleanup sandbox ${containerName}: ${error}`,
      );
      return false;
    }
  }

  /**
   * Cleanup all orphaned sandbox containers
   */
  async cleanupOrphanedSandboxes(
    knownGatewayContainers: string[],
    gracePeriodMs: number = 300000,
  ): Promise<SandboxCleanupReport> {
    const report: SandboxCleanupReport = {
      scanned: 0,
      orphansFound: 0,
      removed: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    if (!this.isAvailable()) {
      return report;
    }

    const sandboxContainers = await this.listSandboxContainers();
    report.scanned = sandboxContainers.length;

    const orphans = await this.findOrphanedSandboxContainers(
      knownGatewayContainers,
    );
    report.orphansFound = orphans.length;

    this.logFn(
      'log',
      `[SandboxCleanup] Scanned ${report.scanned} sandboxes, found ${report.orphansFound} orphans`,
    );

    for (const orphan of orphans) {
      this.logFn(
        'log',
        `[SandboxCleanup] ORPHAN_DETECTED container=${orphan.containerName} reason=${orphan.reason}`,
      );

      const success = await this.cleanupSandboxContainer(
        orphan.containerName,
        true,
      );

      if (success) {
        report.removed++;
        report.details.push({
          containerName: orphan.containerName,
          action: 'removed',
          reason: orphan.reason,
        });
      } else {
        report.errors++;
        report.details.push({
          containerName: orphan.containerName,
          action: 'error',
          reason: `Cleanup failed (detected as: ${orphan.reason})`,
        });
      }
    }

    this.logFn(
      'log',
      `[SandboxCleanup] Completed: removed=${report.removed}, skipped=${report.skipped}, errors=${report.errors}`,
    );

    return report;
  }
}