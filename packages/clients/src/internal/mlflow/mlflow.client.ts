/**
 * MLflow Tracking Client
 *
 * 职责：
 * - 通过 MLflow REST API 记录 proxy 请求的 Experiments / Runs / Metrics
 * - 每次 proxy 请求对应一个 MLflow Run
 * - 异步上报，不阻塞主链路
 */
import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { firstValueFrom } from 'rxjs';
import { getEnv } from '@dofe/infra-common/dist/config/env-config.service';

export interface MlflowProxyLog {
  botId: string;
  vendor: string;
  model: string | null;
  endpoint: string | null;
  protocolType: string | null;
  statusCode: number | null;
  durationMs: number | null;
  requestTokens: number | null;
  responseTokens: number | null;
  errorMessage: string | null;
  timestamp: number;
}

interface MlflowMetric {
  key: string;
  value: number;
  timestamp: number;
  step: number;
}

interface MlflowParam {
  key: string;
  value: string;
}

interface MlflowTag {
  key: string;
  value: string;
}

@Injectable()
export class MlflowClient implements OnModuleInit {
  private experimentId: string | null = null;
  private readonly experimentName = 'proxy-requests';
  private trackingUri = '';
  private enabled = false;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly httpService: HttpService,
  ) {}

  onModuleInit(): void {
    this.trackingUri =
      (getEnv('MLFLOW_TRACKING_URI') as string | undefined) ?? '';
    const enabledRaw = String(getEnv('MLFLOW_ENABLED') ?? '');
    this.enabled = enabledRaw === 'true' || enabledRaw === '1';

    if (this.enabled && this.trackingUri) {
      this.logger.info(
        '[MLflow] Initialization scheduled in background (non-blocking)',
      );
      void this.initExperiment().catch((err) => {
        this.logger.warn(
          `[MLflow] Init failed, tracking disabled: ${err.message}`,
        );
        this.enabled = false;
      });
    }
  }

  /**
   * 记录一次 proxy 请求（fire-and-forget，不阻塞主链路）
   */
  logProxyRequest(data: MlflowProxyLog): void {
    if (!this.enabled || !this.experimentId) return;

    this.doLog(data).catch((err) => {
      this.logger.warn(`[MLflow] Failed to log run: ${err.message}`);
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async doLog(data: MlflowProxyLog): Promise<void> {
    const modelLabel = data.model ?? 'unknown';
    const runName = `${data.vendor}/${modelLabel}`;
    const runId = await this.createRun(data.timestamp, runName);

    const metrics: MlflowMetric[] = [];
    const params: MlflowParam[] = [];
    const tags: MlflowTag[] = [];

    // Params
    params.push({ key: 'vendor', value: data.vendor });
    params.push({ key: 'bot_id', value: data.botId });
    params.push({
      key: 'success',
      value: data.errorMessage ? 'false' : 'true',
    });
    if (data.model) params.push({ key: 'model', value: data.model });
    if (data.endpoint) params.push({ key: 'endpoint', value: data.endpoint });
    if (data.protocolType)
      params.push({ key: 'protocol_type', value: data.protocolType });

    // Metrics
    const ts = data.timestamp;
    if (data.durationMs !== null)
      metrics.push({
        key: 'duration_ms',
        value: data.durationMs,
        timestamp: ts,
        step: 0,
      });
    if (data.requestTokens !== null)
      metrics.push({
        key: 'request_tokens',
        value: data.requestTokens,
        timestamp: ts,
        step: 0,
      });
    if (data.responseTokens !== null)
      metrics.push({
        key: 'response_tokens',
        value: data.responseTokens,
        timestamp: ts,
        step: 0,
      });
    if (data.requestTokens !== null && data.responseTokens !== null)
      metrics.push({
        key: 'total_tokens',
        value: data.requestTokens + data.responseTokens,
        timestamp: ts,
        step: 0,
      });
    if (data.statusCode !== null)
      metrics.push({
        key: 'status_code',
        value: data.statusCode,
        timestamp: ts,
        step: 0,
      });

    // Tags — runName already passed to createRun; keep tag for search/filter
    tags.push({
      key: 'mlflow.runName',
      value: runName,
    });
    if (data.errorMessage)
      tags.push({ key: 'error', value: data.errorMessage.substring(0, 250) });

    await this.logBatch(runId, metrics, params, tags);

    const status = data.errorMessage ? 'FAILED' : 'FINISHED';
    const endTime = data.timestamp + (data.durationMs ?? 0);
    await this.finishRun(runId, status, endTime);
  }

  private async initExperiment(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.httpService.get(
          `${this.trackingUri}/api/2.0/mlflow/experiments/get-by-name`,
          { params: { experiment_name: this.experimentName } },
        ),
      );
      this.experimentId = res.data.experiment.experiment_id as string;
      this.logger.info(`[MLflow] Using experiment id=${this.experimentId}`);
    } catch (err: any) {
      if (err.response?.status === 404) {
        const res = await firstValueFrom(
          this.httpService.post(
            `${this.trackingUri}/api/2.0/mlflow/experiments/create`,
            { name: this.experimentName },
          ),
        );
        this.experimentId = res.data.experiment_id as string;
        this.logger.info(`[MLflow] Created experiment id=${this.experimentId}`);
      } else {
        throw err;
      }
    }
  }

  private async createRun(startTime: number, runName: string): Promise<string> {
    const res = await firstValueFrom(
      this.httpService.post(`${this.trackingUri}/api/2.0/mlflow/runs/create`, {
        experiment_id: this.experimentId,
        start_time: startTime,
        run_name: runName,
      }),
    );
    return res.data.run.info.run_id as string;
  }

  private async logBatch(
    runId: string,
    metrics: MlflowMetric[],
    params: MlflowParam[],
    tags: MlflowTag[],
  ): Promise<void> {
    await firstValueFrom(
      this.httpService.post(
        `${this.trackingUri}/api/2.0/mlflow/runs/log-batch`,
        {
          run_id: runId,
          metrics,
          params,
          tags,
        },
      ),
    );
  }

  private async finishRun(
    runId: string,
    status: 'FINISHED' | 'FAILED',
    endTime: number,
  ): Promise<void> {
    await firstValueFrom(
      this.httpService.post(`${this.trackingUri}/api/2.0/mlflow/runs/update`, {
        run_id: runId,
        status,
        end_time: endTime,
      }),
    );
  }
}
