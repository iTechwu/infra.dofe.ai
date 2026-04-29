/**
 * Health Check Client
 *
 * 职责：封装本地服务健康检查的 HTTP 调用
 * - 仅负责 HTTP 通信，不包含业务逻辑
 * - 使用 @nestjs/axios 的 HttpService
 */
import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  status: number;
  data: any;
  healthy: boolean;
}

/**
 * 端点检查结果
 */
export interface EndpointCheckResult {
  ok: boolean;
  status: number;
  data?: any;
}

@Injectable()
export class HealthCheckClient {
  private readonly DEFAULT_TIMEOUT = 5000;

  constructor(
    private readonly httpService: HttpService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  /**
   * 检查本地服务健康状态
   */
  async checkLocalService(
    port: number,
    endpoint: string = '/health',
    timeoutMs: number = this.DEFAULT_TIMEOUT,
  ): Promise<HealthCheckResult> {
    const url = `http://localhost:${port}${endpoint}`;

    try {
      this.logger.debug('[HealthCheckClient] Checking service health', {
        port,
        endpoint,
      });

      const response = await firstValueFrom(
        this.httpService.get(url).pipe(
          timeout(timeoutMs),
          catchError((error) => {
            this.logger.debug('[HealthCheckClient] Health check failed', {
              port,
              error: error.message,
            });
            return of({ status: 500, data: null });
          }),
        ),
      );

      const healthy = response.status === 200;

      return {
        status: response.status,
        data: response.data,
        healthy,
      };
    } catch (error) {
      this.logger.error('[HealthCheckClient] Health check exception', {
        port,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        status: 500,
        data: null,
        healthy: false,
      };
    }
  }

  /**
   * 检查任意 URL 端点（用于 MCP HTTP 服务器）
   */
  async checkEndpoint(
    url: string,
    headers?: Record<string, string>,
    timeoutMs: number = this.DEFAULT_TIMEOUT,
  ): Promise<EndpointCheckResult> {
    try {
      this.logger.debug('[HealthCheckClient] Checking endpoint', { url });

      const response = await firstValueFrom(
        this.httpService
          .get(url, {
            headers,
            validateStatus: () => true, // Accept any status code
          })
          .pipe(
            timeout(timeoutMs),
            catchError((error) => {
              this.logger.debug('[HealthCheckClient] Endpoint check failed', {
                url,
                error: error.message,
              });
              return of({ status: 500, data: null });
            }),
          ),
      );

      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        data: response.data,
      };
    } catch (error) {
      this.logger.error('[HealthCheckClient] Endpoint check exception', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        status: 500,
      };
    }
  }

  /**
   * 检查健康端点（baseUrl + path）
   */
  async checkHealth(
    baseUrl: string,
    path: string = '/health',
    timeoutMs: number = this.DEFAULT_TIMEOUT,
  ): Promise<boolean> {
    const url = `${baseUrl}${path}`;

    try {
      this.logger.debug('[HealthCheckClient] Checking health', {
        baseUrl,
        path,
      });

      const response = await firstValueFrom(
        this.httpService.get(url).pipe(
          timeout(timeoutMs),
          catchError((error) => {
            this.logger.debug('[HealthCheckClient] Health check failed', {
              url,
              error: error.message,
            });
            return of({ status: 500 });
          }),
        ),
      );

      return response.status === 200;
    } catch (error) {
      this.logger.error('[HealthCheckClient] Health check exception', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
