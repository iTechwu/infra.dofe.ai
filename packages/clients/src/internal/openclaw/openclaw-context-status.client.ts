/**
 * OpenClaw Context Status Client
 *
 * 职责：从 OpenClaw Gateway 获取会话上下文状态
 * - 仅负责 HTTP 通信，不包含业务逻辑
 * - 使用 @nestjs/axios 的 HttpService
 */
import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';

/**
 * 会话上下文状态
 */
export interface SessionContextStatus {
  sessionKey: string;
  currentTokens: number;
  maxTokens: number;
  percentage: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  lastUpdatedAt?: Date;
}

/**
 * 上下文压力级别
 */
export type ContextPressureLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Bot 上下文压力概览
 */
export interface BotContextPressureOverview {
  botId: string;
  sessions: Array<SessionContextStatus & { level: ContextPressureLevel }>;
  summary: {
    low: number;
    medium: number;
    high: number;
  };
  activeSessionCount: number;
  totalTokensUsed: number;
  avgPressurePercentage: number;
}

/**
 * OpenClaw Context Status Client
 */
@Injectable()
export class OpenClawContextStatusClient {
  /** Gateway RPC 超时时间（毫秒） */
  private readonly RPC_TIMEOUT_MS = 10000;

  constructor(
    private readonly httpService: HttpService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  /**
   * 获取会话上下文压力级别
   */
  private getPressureLevel(percentage: number): ContextPressureLevel {
    if (percentage >= 90) return 'critical';
    if (percentage >= 70) return 'high';
    if (percentage >= 40) return 'medium';
    return 'low';
  }

  /**
   * 从 OpenClaw Gateway 获取会话上下文状态
   *
   * 注意：此方法需要 OpenClaw Gateway 支持 /rpc/session.get_context 端点
   * 如果端点不可用，将返回模拟数据（用于开发/测试）
   */
  async getSessionContextStatus(
    host: string,
    port: number,
    token: string,
    sessionKey?: string,
  ): Promise<SessionContextStatus[]> {
    const url = `http://${host}:${port}/rpc/session.list`;

    try {
      this.logger.debug(
        '[OpenClawContextStatusClient] Fetching session context status',
        {
          host,
          port,
          sessionKey,
        },
      );

      const response = await firstValueFrom(
        this.httpService
          .post(
            url,
            {
              sessionKey,
              includeTokens: true,
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            },
          )
          .pipe(
            timeout(this.RPC_TIMEOUT_MS),
            catchError((error) => {
              this.logger.warn(
                '[OpenClawContextStatusClient] Failed to fetch session context status',
                {
                  host,
                  port,
                  error: error.message || String(error),
                },
              );
              // Return empty result instead of throwing
              return of({ status: 503, data: { sessions: [] } });
            }),
          ),
      );

      if (response.status !== 200 || !response.data?.sessions) {
        this.logger.debug(
          '[OpenClawContextStatusClient] No session data available, returning empty',
          { status: response.status },
        );
        return [];
      }

      const sessions = response.data.sessions as Array<Record<string, any>>;
      return sessions.map((s) => ({
        sessionKey: s.sessionKey || s.session_key || s.id || '',
        currentTokens: s.totalTokens || s.total_tokens || s.currentTokens || 0,
        maxTokens: s.maxTokens || s.max_tokens || s.contextWindow || 128000,
        percentage: Math.min(
          100,
          Math.round(
            ((s.totalTokens || s.total_tokens || 0) /
              (s.maxTokens || s.max_tokens || s.contextWindow || 128000)) *
              100,
          ),
        ),
        inputTokens: s.inputTokens || s.input_tokens,
        outputTokens: s.outputTokens || s.output_tokens,
        model: s.model,
        lastUpdatedAt:
          s.updatedAt || s.updated_at
            ? new Date(s.updatedAt || s.updated_at)
            : undefined,
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        '[OpenClawContextStatusClient] Error fetching session context status',
        {
          host,
          port,
          error: errorMessage,
        },
      );
      return [];
    }
  }

  /**
   * 获取 Bot 上下文压力概览
   */
  async getBotContextPressureOverview(
    botId: string,
    host: string,
    port: number,
    token: string,
  ): Promise<BotContextPressureOverview> {
    const sessions = await this.getSessionContextStatus(host, port, token);

    // 计算压力级别分布
    const sessionsWithLevel = sessions.map((s) => ({
      ...s,
      level: this.getPressureLevel(s.percentage),
    }));

    const summary = {
      low: sessionsWithLevel.filter((s) => s.level === 'low').length,
      medium: sessionsWithLevel.filter((s) => s.level === 'medium').length,
      high: sessionsWithLevel.filter((s) =>
        ['high', 'critical'].includes(s.level),
      ).length,
    };

    const totalTokensUsed = sessions.reduce(
      (sum, s) => sum + s.currentTokens,
      0,
    );

    const avgPressurePercentage =
      sessions.length > 0
        ? Math.round(
            sessions.reduce((sum, s) => sum + s.percentage, 0) /
              sessions.length,
          )
        : 0;

    return {
      botId,
      sessions: sessionsWithLevel,
      summary,
      activeSessionCount: sessions.length,
      totalTokensUsed,
      avgPressurePercentage,
    };
  }

  /**
   * 健康检查
   */
  async checkHealth(host: string, port: number): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`http://${host}:${port}/health`).pipe(
          timeout(5000),
          catchError(() => of({ status: 500 })),
        ),
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
