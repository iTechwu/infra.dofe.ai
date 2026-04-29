import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { DockerExecService } from './docker-exec.service';

export interface OpenClawAgentSendParams {
  message: string;
  to?: string;
  sessionId?: string;
  agentKey?: string;
  local?: boolean;
  thinking?: boolean;
  verbose?: boolean;
  timeoutSeconds?: number;
  json?: boolean;
  deliver?: boolean;
  channel?: string;
  replyTo?: string;
  replyChannel?: string;
  replyAccount?: string;
}

export interface OpenClawAgentSendResult {
  runId?: string;
  sessionKey?: string;
  replyText: string;
  mediaUrls?: string[];
  raw?: unknown;
}

export interface OpenClawSubagentItem {
  id: string;
  parentId?: string;
  status: 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled';
  task?: string;
  createdAt?: string;
  completedAt?: string;
  durationMs?: number;
  tokens?: number;
  cost?: number;
  error?: string;
}

export interface OpenClawSubagentSpawnParams {
  task: string;
  mode?: 'run' | 'session';
  timeoutSeconds?: number;
}

/**
 * OpenClaw Agent Coordination Client
 *
 * 职责：封装 OpenClaw `agent` / `subagents` CLI 调用
 * - 仅负责外部调用与结果解析
 * - 不包含业务权限校验
 */
@Injectable()
export class OpenClawAgentCoordinationClient {
  private readonly CLI_TIMEOUT_MS = 30000;

  constructor(
    private readonly dockerExec: DockerExecService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async agentSend(
    containerId: string,
    params: OpenClawAgentSendParams,
  ): Promise<OpenClawAgentSendResult> {
    const command = this.buildAgentSendCommand(params);

    this.logger.debug('[OpenClawAgentCoordinationClient] agent send', {
      containerId,
      command: command.join(' '),
    });

    const result = await this.dockerExec.executeCommand(containerId, command, {
      timeout: this.CLI_TIMEOUT_MS,
    });

    if (!result.success) {
      throw new Error(result.stderr || 'agent send failed');
    }

    return this.parseAgentSendOutput(result.stdout, params.json === true);
  }

  async listSubagents(containerId: string): Promise<OpenClawSubagentItem[]> {
    const result = await this.dockerExec.executeCommand(
      containerId,
      ['openclaw', 'subagents', 'list', '--json'],
      { timeout: this.CLI_TIMEOUT_MS },
    );

    if (!result.success) {
      throw new Error(result.stderr || 'list subagents failed');
    }

    if (!result.stdout.trim()) {
      return [];
    }

    const parsed = this.parseJsonFromOutput<unknown>(result.stdout);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item: any) => this.normalizeSubagentItem(item));
  }

  async spawnSubagent(
    containerId: string,
    params: OpenClawSubagentSpawnParams,
  ): Promise<{ subagentId: string; status: OpenClawSubagentItem['status'] }> {
    const command = this.buildSubagentSpawnCommand(params);

    const result = await this.dockerExec.executeCommand(containerId, command, {
      timeout: this.CLI_TIMEOUT_MS,
    });

    if (!result.success) {
      throw new Error(result.stderr || 'spawn subagent failed');
    }

    if (!result.stdout.trim()) {
      return {
        subagentId: '',
        status: 'running',
      };
    }

    const parsed = this.parseJsonFromOutput<Record<string, any>>(result.stdout);
    if (!parsed) {
      return {
        subagentId: '',
        status: 'running',
      };
    }

    return {
      subagentId: String(parsed.id ?? parsed.subagentId ?? ''),
      status: this.normalizeSubagentStatus(parsed.status),
    };
  }

  async getSubagentInfo(
    containerId: string,
    subagentId: string,
  ): Promise<OpenClawSubagentItem & { outputSummary?: string; logs?: string }> {
    const infoResult = await this.dockerExec.executeCommand(
      containerId,
      ['openclaw', 'subagents', 'info', subagentId, '--json'],
      { timeout: this.CLI_TIMEOUT_MS },
    );

    if (!infoResult.success) {
      throw new Error(infoResult.stderr || 'get subagent info failed');
    }

    const infoParsed = infoResult.stdout.trim()
      ? this.parseJsonFromOutput<Record<string, any>>(infoResult.stdout) || {}
      : {};

    const logsResult = await this.dockerExec.executeCommand(
      containerId,
      ['openclaw', 'subagents', 'logs', subagentId],
      { timeout: this.CLI_TIMEOUT_MS },
    );

    const logs = logsResult.success ? logsResult.stdout : undefined;

    return {
      ...this.normalizeSubagentItem(infoParsed),
      outputSummary:
        typeof infoParsed.outputSummary === 'string'
          ? infoParsed.outputSummary
          : undefined,
      logs,
    };
  }

  async killSubagent(containerId: string, subagentId: string): Promise<void> {
    const result = await this.dockerExec.executeCommand(
      containerId,
      ['openclaw', 'subagents', 'kill', subagentId],
      { timeout: this.CLI_TIMEOUT_MS },
    );

    if (!result.success) {
      throw new Error(result.stderr || 'kill subagent failed');
    }
  }

  private buildAgentSendCommand(params: OpenClawAgentSendParams): string[] {
    const command = ['openclaw', 'agent', 'send', params.message];

    if (params.to) command.push('--to', params.to);
    if (params.sessionId) command.push('--session-id', params.sessionId);
    if (params.agentKey) command.push('--agent', params.agentKey);
    if (params.local) command.push('--local');
    if (params.thinking) command.push('--thinking');
    if (params.verbose) command.push('--verbose');
    if (params.timeoutSeconds)
      command.push('--timeout-seconds', String(params.timeoutSeconds));
    if (params.json) command.push('--json');
    if (params.deliver) command.push('--deliver');
    if (params.channel) command.push('--channel', params.channel);
    if (params.replyTo) command.push('--reply-to', params.replyTo);
    if (params.replyChannel)
      command.push('--reply-channel', params.replyChannel);
    if (params.replyAccount)
      command.push('--reply-account', params.replyAccount);

    return command;
  }

  private buildSubagentSpawnCommand(
    params: OpenClawSubagentSpawnParams,
  ): string[] {
    const command = ['openclaw', 'subagents', 'spawn', params.task];

    if (params.mode === 'session') {
      command.push('--session');
    }
    if (params.timeoutSeconds) {
      command.push('--timeout-seconds', String(params.timeoutSeconds));
    }
    command.push('--json');

    return command;
  }

  private parseAgentSendOutput(
    stdout: string,
    isJsonMode: boolean,
  ): OpenClawAgentSendResult {
    if (isJsonMode && stdout.trim()) {
      const raw = this.parseJsonFromOutput<Record<string, any>>(stdout);
      if (raw) {
        return {
          runId: typeof raw.runId === 'string' ? raw.runId : undefined,
          sessionKey:
            typeof raw.sessionKey === 'string' ? raw.sessionKey : undefined,
          replyText:
            typeof raw.replyText === 'string'
              ? raw.replyText
              : typeof raw.text === 'string'
                ? raw.text
                : stdout,
          mediaUrls: Array.isArray(raw.mediaUrls)
            ? raw.mediaUrls.filter((item) => typeof item === 'string')
            : undefined,
          raw,
        };
      }
    }

    return {
      replyText: stdout,
    };
  }

  private parseJsonFromOutput<T>(stdout: string): T | null {
    const trimmed = stdout.trim();
    if (!trimmed) {
      return null;
    }

    const jsonStart = trimmed.search(/[[{]/);
    if (jsonStart < 0) {
      return null;
    }

    const candidate = trimmed.slice(jsonStart);
    try {
      return JSON.parse(candidate) as T;
    } catch (error) {
      this.logger.warn(
        '[OpenClawAgentCoordinationClient] failed to parse JSON output',
        {
          error: error instanceof Error ? error.message : String(error),
          outputPreview: trimmed.substring(0, 300),
        },
      );
      return null;
    }
  }

  private normalizeSubagentItem(
    item: Record<string, any>,
  ): OpenClawSubagentItem {
    return {
      id: String(item.id ?? item.subagentId ?? ''),
      parentId:
        typeof item.parentId === 'string'
          ? item.parentId
          : typeof item.parent_id === 'string'
            ? item.parent_id
            : undefined,
      status: this.normalizeSubagentStatus(item.status),
      task: typeof item.task === 'string' ? item.task : undefined,
      createdAt:
        typeof item.createdAt === 'string'
          ? item.createdAt
          : typeof item.created_at === 'string'
            ? item.created_at
            : undefined,
      completedAt:
        typeof item.completedAt === 'string'
          ? item.completedAt
          : typeof item.completed_at === 'string'
            ? item.completed_at
            : undefined,
      durationMs:
        typeof item.durationMs === 'number'
          ? item.durationMs
          : typeof item.duration_ms === 'number'
            ? item.duration_ms
            : undefined,
      tokens: typeof item.tokens === 'number' ? item.tokens : undefined,
      cost: typeof item.cost === 'number' ? item.cost : undefined,
      error: typeof item.error === 'string' ? item.error : undefined,
    };
  }

  private normalizeSubagentStatus(
    status: unknown,
  ): OpenClawSubagentItem['status'] {
    const value = typeof status === 'string' ? status.toLowerCase() : 'running';

    switch (value) {
      case 'running':
      case 'completed':
      case 'failed':
      case 'timeout':
      case 'cancelled':
        return value;
      default:
        return 'running';
    }
  }
}
