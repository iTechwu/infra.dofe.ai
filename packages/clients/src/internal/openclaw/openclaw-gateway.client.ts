/**
 * OpenClaw Gateway RPC Client
 *
 * 职责：封装 OpenClaw Gateway RPC API 的 HTTP 调用
 * - 仅负责 HTTP 通信，不包含业务逻辑
 * - 使用 @nestjs/axios 的 HttpService
 *
 * OpenClaw Gateway RPC 文档：https://docs.openclaw.ai/gateway/rpc
 */
import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';

/**
 * OpenClaw Gateway RPC 响应
 */
export interface GatewayRpcResponse {
  success: boolean;
  error?: string;
  data?: unknown;
}

/**
 * OpenClaw Gateway 配置更新请求
 */
export interface ConfigUpdateRequest {
  path: string;
  value: unknown;
}

@Injectable()
export class OpenClawGatewayClient {
  /** Gateway RPC 超时时间（毫秒） */
  private readonly RPC_TIMEOUT_MS = 10000;

  constructor(
    private readonly httpService: HttpService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  /**
   * 推送配置更新到 OpenClaw Gateway
   */
  async pushConfigUpdate(
    host: string,
    port: number,
    token: string,
    updates: ConfigUpdateRequest[],
  ): Promise<GatewayRpcResponse> {
    const url = `http://${host}:${port}/rpc/config.set`;

    try {
      this.logger.debug('[OpenClawGatewayClient] Pushing config update', {
        host,
        port,
        updateCount: updates.length,
      });

      const response = await firstValueFrom(
        this.httpService
          .post(
            url,
            {
              updates: updates.map((u) => ({
                path: u.path,
                value: u.value,
              })),
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
              this.logger.error(
                '[OpenClawGatewayClient] Failed to push config update',
                {
                  host,
                  port,
                  error: error.message || String(error),
                },
              );
              return of({ status: 500, data: { error: error.message } });
            }),
          ),
      );

      const success = response.status === 200;
      const data = response.data;

      if (success) {
        this.logger.debug(
          '[OpenClawGatewayClient] Config update pushed successfully',
          {
            host,
            port,
          },
        );
      }

      return {
        success,
        error: data?.error,
        data: data,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[OpenClawGatewayClient] Config update failed', {
        host,
        port,
        error: errorMessage,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 获取当前配置
   */
  async getCurrentConfig(
    host: string,
    port: number,
    token: string,
    paths?: string[],
  ): Promise<GatewayRpcResponse> {
    const url = `http://${host}:${port}/rpc/config.get`;

    try {
      const response = await firstValueFrom(
        this.httpService
          .post(
            url,
            {
              paths: paths || ['models', 'agents.defaults.model'],
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
              return of({ status: 500, data: { error: error.message } });
            }),
          ),
      );

      return {
        success: response.status === 200,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 重新加载完整配置文件
   */
  async reloadConfig(
    host: string,
    port: number,
    token: string,
  ): Promise<GatewayRpcResponse> {
    const url = `http://${host}:${port}/rpc/config.reload`;

    try {
      const response = await firstValueFrom(
        this.httpService
          .post(
            url,
            {},
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
              return of({ status: 500, data: { error: error.message } });
            }),
          ),
      );

      return {
        success: response.status === 200,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
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
