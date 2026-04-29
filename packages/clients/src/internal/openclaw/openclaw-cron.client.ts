/**
 * OpenClaw Cron Client
 *
 * 职责：封装 OpenClaw Gateway Cron API 的调用
 * - 通过 Docker exec 调用 `openclaw cron` CLI 命令
 * - 解析 JSON 输出
 * - 提供类型安全的接口
 *
 * OpenClaw Cron 文档：https://docs.openclaw.ai/automation/cron
 */
import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { DockerExecService } from './docker-exec.service';
import type {
  CronJob,
  CronRun,
  AddCronJobParams,
  UpdateCronJobPatch,
  CronSchedulerStatus,
} from './types/cron.types';

@Injectable()
export class OpenClawCronClient {
  /** CLI 命令超时时间（毫秒） */
  private readonly CLI_TIMEOUT_MS = 30000;

  constructor(
    private readonly dockerExec: DockerExecService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  /**
   * 获取 Cron 调度器状态
   *
   * CLI: openclaw cron status --json
   */
  async getCronStatus(containerId: string): Promise<CronSchedulerStatus> {
    try {
      this.logger.debug('[OpenClawCronClient] Getting cron status', {
        containerId,
      });

      const result = await this.dockerExec.executeCommand(
        containerId,
        ['openclaw', 'cron', 'status', '--json'],
        { user: 'node', timeout: this.CLI_TIMEOUT_MS },
      );

      if (!result.success || !result.stdout) {
        throw new Error(
          `Failed to get cron status: ${result.stderr || 'No output'}`,
        );
      }

      const status = JSON.parse(result.stdout) as CronSchedulerStatus;

      this.logger.debug('[OpenClawCronClient] Cron status retrieved', {
        containerId,
        enabled: status.enabled,
        jobCount: status.jobCount,
      });

      return status;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[OpenClawCronClient] Failed to get cron status', {
        containerId,
        error: errorMessage,
      });
      throw new Error(`Failed to get cron status: ${errorMessage}`);
    }
  }

  /**
   * 列出所有 Cron 任务
   *
   * CLI: openclaw cron list --json
   */
  async listCronJobs(containerId: string): Promise<CronJob[]> {
    try {
      this.logger.debug('[OpenClawCronClient] Listing cron jobs', {
        containerId,
      });

      const result = await this.dockerExec.executeCommand(
        containerId,
        ['openclaw', 'cron', 'list', '--json'],
        { user: 'node', timeout: this.CLI_TIMEOUT_MS },
      );

      if (!result.success) {
        throw new Error(
          `Failed to list cron jobs: ${result.stderr || 'No output'}`,
        );
      }

      // 如果没有任务,返回空数组
      if (!result.stdout || result.stdout.trim() === '') {
        return [];
      }

      const jobs = JSON.parse(result.stdout) as CronJob[];

      this.logger.debug('[OpenClawCronClient] Cron jobs listed', {
        containerId,
        count: jobs.length,
      });

      return Array.isArray(jobs) ? jobs : [];
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[OpenClawCronClient] Failed to list cron jobs', {
        containerId,
        error: errorMessage,
      });
      throw new Error(`Failed to list cron jobs: ${errorMessage}`);
    }
  }

  /**
   * 创建 Cron 任务
   *
   * CLI: openclaw cron add [options] --json
   */
  async addCronJob(
    containerId: string,
    params: AddCronJobParams,
  ): Promise<CronJob> {
    try {
      this.logger.debug('[OpenClawCronClient] Adding cron job', {
        containerId,
        name: params.name,
      });

      const command = this.buildCronAddCommand(params);

      const result = await this.dockerExec.executeCommand(
        containerId,
        command,
        { user: 'node', timeout: this.CLI_TIMEOUT_MS },
      );

      if (!result.success || !result.stdout) {
        throw new Error(
          `Failed to add cron job: ${result.stderr || 'No output'}`,
        );
      }

      const job = JSON.parse(result.stdout) as CronJob;

      this.logger.info('[OpenClawCronClient] Cron job added', {
        containerId,
        jobId: job.jobId,
        name: job.name,
      });

      return job;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[OpenClawCronClient] Failed to add cron job', {
        containerId,
        name: params.name,
        error: errorMessage,
      });
      throw new Error(`Failed to add cron job: ${errorMessage}`);
    }
  }

  /**
   * 更新 Cron 任务
   *
   * CLI: openclaw cron edit <jobId> [options] --json
   */
  async updateCronJob(
    containerId: string,
    jobId: string,
    patch: UpdateCronJobPatch,
  ): Promise<CronJob> {
    try {
      this.logger.debug('[OpenClawCronClient] Updating cron job', {
        containerId,
        jobId,
      });

      const flags = this.buildCronEditFlags(patch);
      const command = ['openclaw', 'cron', 'edit', jobId, ...flags, '--json'];

      const result = await this.dockerExec.executeCommand(
        containerId,
        command,
        { user: 'node', timeout: this.CLI_TIMEOUT_MS },
      );

      if (!result.success || !result.stdout) {
        throw new Error(
          `Failed to update cron job: ${result.stderr || 'No output'}`,
        );
      }

      const job = JSON.parse(result.stdout) as CronJob;

      this.logger.info('[OpenClawCronClient] Cron job updated', {
        containerId,
        jobId,
      });

      return job;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[OpenClawCronClient] Failed to update cron job', {
        containerId,
        jobId,
        error: errorMessage,
      });
      throw new Error(`Failed to update cron job: ${errorMessage}`);
    }
  }

  /**
   * 删除 Cron 任务
   *
   * CLI: openclaw cron remove <jobId>
   */
  async removeCronJob(containerId: string, jobId: string): Promise<void> {
    try {
      this.logger.debug('[OpenClawCronClient] Removing cron job', {
        containerId,
        jobId,
      });

      const result = await this.dockerExec.executeCommand(
        containerId,
        ['openclaw', 'cron', 'remove', jobId],
        { user: 'node', timeout: this.CLI_TIMEOUT_MS },
      );

      if (!result.success) {
        throw new Error(
          `Failed to remove cron job: ${result.stderr || 'No output'}`,
        );
      }

      this.logger.info('[OpenClawCronClient] Cron job removed', {
        containerId,
        jobId,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[OpenClawCronClient] Failed to remove cron job', {
        containerId,
        jobId,
        error: errorMessage,
      });
      throw new Error(`Failed to remove cron job: ${errorMessage}`);
    }
  }

  /**
   * 手动触发 Cron 任务
   *
   * CLI: openclaw cron run <jobId> [--force|--due]
   */
  async runCronJob(
    containerId: string,
    jobId: string,
    mode: 'force' | 'due' = 'force',
  ): Promise<void> {
    try {
      this.logger.debug('[OpenClawCronClient] Running cron job', {
        containerId,
        jobId,
        mode,
      });

      const command = [
        'openclaw',
        'cron',
        'run',
        jobId,
        ...(mode === 'due' ? ['--due'] : []),
      ];

      const result = await this.dockerExec.executeCommand(
        containerId,
        command,
        { user: 'node', timeout: this.CLI_TIMEOUT_MS },
      );

      if (!result.success) {
        throw new Error(
          `Failed to run cron job: ${result.stderr || 'No output'}`,
        );
      }

      this.logger.info('[OpenClawCronClient] Cron job triggered', {
        containerId,
        jobId,
        mode,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[OpenClawCronClient] Failed to run cron job', {
        containerId,
        jobId,
        mode,
        error: errorMessage,
      });
      throw new Error(`Failed to run cron job: ${errorMessage}`);
    }
  }

  /**
   * 获取 Cron 任务执行历史
   *
   * CLI: openclaw cron runs --id <jobId> --limit <limit> --json
   */
  async getCronJobRuns(
    containerId: string,
    jobId: string,
    limit: number = 50,
  ): Promise<CronRun[]> {
    try {
      this.logger.debug('[OpenClawCronClient] Getting cron job runs', {
        containerId,
        jobId,
        limit,
      });

      const result = await this.dockerExec.executeCommand(
        containerId,
        [
          'openclaw',
          'cron',
          'runs',
          '--id',
          jobId,
          '--limit',
          String(limit),
          '--json',
        ],
        { user: 'node', timeout: this.CLI_TIMEOUT_MS },
      );

      if (!result.success) {
        throw new Error(
          `Failed to get cron job runs: ${result.stderr || 'No output'}`,
        );
      }

      // 如果没有执行历史,返回空数组
      if (!result.stdout || result.stdout.trim() === '') {
        return [];
      }

      const runs = JSON.parse(result.stdout) as CronRun[];

      this.logger.debug('[OpenClawCronClient] Cron job runs retrieved', {
        containerId,
        jobId,
        count: runs.length,
      });

      return Array.isArray(runs) ? runs : [];
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[OpenClawCronClient] Failed to get cron job runs', {
        containerId,
        jobId,
        error: errorMessage,
      });
      throw new Error(`Failed to get cron job runs: ${errorMessage}`);
    }
  }

  /**
   * 构建 cron add 命令
   */
  private buildCronAddCommand(params: AddCronJobParams): string[] {
    const parts: string[] = ['openclaw', 'cron', 'add'];

    // 基本参数
    parts.push('--name', params.name);
    if (params.description) {
      parts.push('--description', params.description);
    }

    // 调度配置
    if (params.schedule.kind === 'at') {
      parts.push('--at', params.schedule.at);
    } else if (params.schedule.kind === 'every') {
      parts.push('--every', `${params.schedule.everyMs}ms`);
    } else if (params.schedule.kind === 'cron') {
      parts.push('--cron', params.schedule.expr);
      if (params.schedule.tz) {
        parts.push('--tz', params.schedule.tz);
      }
    }

    // Session target
    parts.push('--session', params.sessionTarget);

    // Wake mode
    if (params.wakeMode) {
      parts.push('--wake', params.wakeMode);
    }

    // Payload
    if (params.payload.kind === 'systemEvent') {
      parts.push('--system-event', params.payload.text);
    } else if (params.payload.kind === 'agentTurn') {
      parts.push('--message', params.payload.message);
      if (params.payload.model) {
        parts.push('--model', params.payload.model);
      }
      if (params.payload.thinking) {
        parts.push('--thinking', params.payload.thinking);
      }
    }

    // Delivery
    if (params.delivery) {
      if (params.delivery.mode === 'announce') {
        parts.push('--announce');
        if (params.delivery.channel) {
          parts.push('--channel', params.delivery.channel);
        }
        if (params.delivery.to) {
          parts.push('--to', params.delivery.to);
        }
      } else if (params.delivery.mode === 'webhook') {
        parts.push('--webhook');
        if (params.delivery.to) {
          parts.push('--to', params.delivery.to);
        }
      }
    }

    // 其他选项
    if (params.enabled === false) {
      parts.push('--disabled');
    }
    if (params.deleteAfterRun) {
      parts.push('--delete-after-run');
    }
    if (params.agentId) {
      parts.push('--agent', params.agentId);
    }

    parts.push('--json');

    return parts;
  }

  /**
   * 构建 cron edit 命令的 flags
   */
  private buildCronEditFlags(patch: UpdateCronJobPatch): string[] {
    const parts: string[] = [];

    if (patch.name !== undefined) {
      parts.push('--name', patch.name);
    }
    if (patch.description !== undefined) {
      parts.push('--description', patch.description);
    }
    if (patch.schedule) {
      if (patch.schedule.kind === 'cron') {
        parts.push('--cron', patch.schedule.expr);
        if (patch.schedule.tz) {
          parts.push('--tz', patch.schedule.tz);
        }
      } else if (patch.schedule.kind === 'every') {
        parts.push('--every', `${patch.schedule.everyMs}ms`);
      }
    }
    if (patch.payload) {
      if (patch.payload.kind === 'agentTurn') {
        parts.push('--message', patch.payload.message);
        if (patch.payload.model) {
          parts.push('--model', patch.payload.model);
        }
        if (patch.payload.thinking) {
          parts.push('--thinking', patch.payload.thinking);
        }
      }
    }
    if (patch.enabled !== undefined) {
      parts.push(patch.enabled ? '--enabled' : '--disabled');
    }
    if (patch.agentId !== undefined) {
      if (patch.agentId === null) {
        parts.push('--clear-agent');
      } else {
        parts.push('--agent', patch.agentId);
      }
    }

    return parts;
  }
}
