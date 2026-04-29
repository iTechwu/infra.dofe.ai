/**
 * Docker 容器统计服务
 * 负责获取容器的统计信息和状态
 *
 * 注意：此类不使用 @Injectable 装饰器，由 DockerService 内部实例化
 */

import Docker from 'dockerode';
import type { ContainerStats } from '@repo/contracts';

export interface ContainerInfo {
  id: string;
  state: string;
  running: boolean;
  exitCode: number;
  startedAt: string;
  finishedAt: string;
}

/**
 * Docker 容器统计服务
 * 封装容器状态查询和统计收集逻辑
 */
export class DockerStatsService {
  constructor(private readonly docker: Docker | null) {}

  /**
   * Check if Docker is available
   */
  isAvailable(): boolean {
    return this.docker !== null;
  }

  /**
   * Get container status
   */
  async getContainerStatus(containerId: string): Promise<ContainerInfo | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const container = this.docker!.getContainer(containerId);
      const info = await container.inspect();
      return {
        id: info.Id,
        state: info.State.Status,
        running: info.State.Running,
        exitCode: info.State.ExitCode,
        startedAt: info.State.StartedAt,
        finishedAt: info.State.FinishedAt,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get container network information
   */
  async getContainerNetworkInfo(containerId: string): Promise<{
    networks: string[];
    ipAddresses: Record<string, string>;
  } | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const container = this.docker!.getContainer(containerId);
      const info = await container.inspect();
      const networks = Object.keys(info.NetworkSettings.Networks || {});
      const ipAddresses: Record<string, string> = {};

      for (const [networkName, networkConfig] of Object.entries(
        info.NetworkSettings.Networks || {},
      )) {
        if (networkConfig && typeof networkConfig === 'object') {
          const config = networkConfig as { IPAddress?: string };
          if (config.IPAddress) {
            ipAddresses[networkName] = config.IPAddress;
          }
        }
      }

      return { networks, ipAddresses };
    } catch {
      return null;
    }
  }

  /**
   * Get container stats for all managed containers
   */
  async getAllContainerStats(): Promise<ContainerStats[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const containers = await this.docker!.listContainers({
      all: true,
      filters: { label: ['clawbot-manager.managed=true'] },
    });

    const stats: ContainerStats[] = [];

    for (const containerInfo of containers) {
      try {
        const container = this.docker!.getContainer(containerInfo.Id);
        const containerStats = await container.stats({ stream: false });
        const inspectInfo = await container.inspect();
        const hostname =
          containerInfo.Labels['clawbot-manager.hostname'] || 'unknown';

        // Calculate CPU percentage
        const cpuDelta =
          containerStats.cpu_stats.cpu_usage.total_usage -
          containerStats.precpu_stats.cpu_usage.total_usage;
        const systemDelta =
          containerStats.cpu_stats.system_cpu_usage -
          ((
            containerStats as unknown as {
              precpu_stats?: { system_cpu_usage?: number };
            }
          ).precpu_stats?.system_cpu_usage || 0);
        const cpuPercent =
          systemDelta > 0
            ? (cpuDelta / systemDelta) *
              containerStats.cpu_stats.online_cpus *
              100
            : 0;

        // Calculate memory
        const memoryUsage = containerStats.memory_stats.usage || 0;
        const memoryLimit = containerStats.memory_stats.limit || 1;
        const memoryPercent = (memoryUsage / memoryLimit) * 100;

        // Calculate network
        const networks = containerStats.networks || {};
        let networkRxBytes = 0;
        let networkTxBytes = 0;
        for (const net of Object.values(networks)) {
          networkRxBytes += (net as { rx_bytes: number }).rx_bytes || 0;
          networkTxBytes += (net as { tx_bytes: number }).tx_bytes || 0;
        }

        // Get PID and uptime from inspect info
        const pid = inspectInfo.State.Pid || null;
        const startedAt = inspectInfo.State.StartedAt || null;
        let uptimeSeconds: number | null = null;
        if (startedAt && inspectInfo.State.Running) {
          const startTime = new Date(startedAt).getTime();
          const now = Date.now();
          uptimeSeconds = Math.floor((now - startTime) / 1000);
        }

        stats.push({
          hostname,
          name: containerInfo.Names[0]?.replace(/^\//, '') || hostname,
          containerId: containerInfo.Id.substring(0, 12),
          pid: pid === 0 ? null : pid,
          uptimeSeconds,
          startedAt,
          cpuPercent: Math.round(cpuPercent * 100) / 100,
          memoryUsage,
          memoryLimit,
          memoryPercent: Math.round(memoryPercent * 100) / 100,
          networkRxBytes,
          networkTxBytes,
          timestamp: new Date().toISOString(),
        });
      } catch {
        // Skip containers that fail to get stats
      }
    }

    return stats;
  }

  /**
   * Get stats for specific containers by their IDs (no label filter)
   * Used for Gateway Pool containers that may not have managed labels
   */
  async getContainerStatsByIds(
    containerIds: string[],
  ): Promise<ContainerStats[]> {
    if (!this.isAvailable() || containerIds.length === 0) {
      return [];
    }

    const stats: ContainerStats[] = [];

    for (const rawId of containerIds) {
      // Skip placeholder IDs (e.g. "pending-...")
      if (rawId.startsWith('pending-') || rawId.length < 12) {
        continue;
      }

      try {
        const container = this.docker!.getContainer(rawId);
        const containerStats = await container.stats({ stream: false });
        const inspectInfo = await container.inspect();

        const cpuDelta =
          containerStats.cpu_stats.cpu_usage.total_usage -
          containerStats.precpu_stats.cpu_usage.total_usage;
        const systemDelta =
          containerStats.cpu_stats.system_cpu_usage -
          ((
            containerStats as unknown as {
              precpu_stats?: { system_cpu_usage?: number };
            }
          ).precpu_stats?.system_cpu_usage || 0);
        const cpuPercent =
          systemDelta > 0
            ? (cpuDelta / systemDelta) *
              containerStats.cpu_stats.online_cpus *
              100
            : 0;

        const memoryUsage = containerStats.memory_stats.usage || 0;
        const memoryLimit = containerStats.memory_stats.limit || 1;
        const memoryPercent = (memoryUsage / memoryLimit) * 100;

        const networks = containerStats.networks || {};
        let networkRxBytes = 0;
        let networkTxBytes = 0;
        for (const net of Object.values(networks)) {
          networkRxBytes += (net as { rx_bytes: number }).rx_bytes || 0;
          networkTxBytes += (net as { tx_bytes: number }).tx_bytes || 0;
        }

        const startedAt = inspectInfo.State.StartedAt || null;
        let uptimeSeconds: number | null = null;
        if (startedAt && inspectInfo.State.Running) {
          uptimeSeconds = Math.floor(
            (Date.now() - new Date(startedAt).getTime()) / 1000,
          );
        }

        const shortId = inspectInfo.Id.substring(0, 12);
        const name = (inspectInfo.Name || '').replace(/^\//, '') || shortId;

        stats.push({
          hostname: shortId,
          name,
          containerId: shortId,
          pid: inspectInfo.State.Pid || null,
          uptimeSeconds,
          startedAt,
          cpuPercent: Math.round(cpuPercent * 100) / 100,
          memoryUsage,
          memoryLimit,
          memoryPercent: Math.round(memoryPercent * 100) / 100,
          networkRxBytes,
          networkTxBytes,
          timestamp: new Date().toISOString(),
        });
      } catch {
        // Skip containers that fail to get stats
      }
    }

    return stats;
  }

  /**
   * List all managed containers with their isolation keys
   * Used by ReconciliationService for orphan detection
   */
  async listManagedContainersWithIsolationKeys(): Promise<
    { id: string; hostname: string; isolationKey: string }[]
  > {
    if (!this.isAvailable()) {
      return [];
    }

    const containers = await this.docker!.listContainers({
      all: true,
      filters: { label: ['clawbot-manager.managed=true'] },
    });

    return containers.map((c) => ({
      id: c.Id,
      hostname: c.Labels['clawbot-manager.hostname'] || 'unknown',
      isolationKey:
        c.Labels['clawbot-manager.isolation-key'] ||
        c.Labels['clawbot-manager.hostname'] ||
        'unknown',
    }));
  }

  /**
   * Get container by name
   */
  async getContainerByName(containerName: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const containers = await this.docker!.listContainers({
        all: true,
        filters: { name: [containerName] },
      });

      if (containers.length > 0) {
        return containers[0].Id;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get container info by name
   */
  async getContainerInfo(containerName: string): Promise<ContainerInfo | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const containerId = await this.getContainerByName(containerName);
      if (!containerId) {
        return null;
      }

      return this.getContainerStatus(containerId);
    } catch {
      return null;
    }
  }
}
