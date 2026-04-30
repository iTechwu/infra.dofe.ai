import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { firstValueFrom } from 'rxjs';
import type { AxiosError } from 'axios';
import { getKeysConfig } from '@dofe/infra-common';
import type { ExchangeRateConfig } from '@dofe/infra-common';

interface ExchangeRateConvertResponse {
  success?: boolean;
  query?: {
    from?: string;
    to?: string;
    amount?: number;
  };
  info?: {
    rate?: number;
    quote?: number;
  };
  result?: number;
  date?: string;
  historical?: boolean;
  error?: {
    code?: number | string;
    type?: string;
    info?: string;
  };
}

export interface ConvertCurrencyParams {
  from: string;
  to: string;
  amount: number;
}

export interface ConvertCurrencyResult {
  from: string;
  to: string;
  amount: number;
  convertedAmount: number;
  rate: number;
}

/**
 * ExchangeRate Client
 *
 * 职责：仅负责与 exchangerate.host API 通信
 * - 调用 exchangerate.host API 进行货币转换
 * - 不访问数据库
 * - 不包含业务逻辑
 */
@Injectable()
export class ExchangeRateClient implements OnModuleInit {
  private baseUrl = '';
  private apiKey = '';
  private exchangeRateConfig: ExchangeRateConfig | undefined;

  constructor(
    private readonly httpService: HttpService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  onModuleInit() {
    const keysConfig = getKeysConfig();
    this.exchangeRateConfig = keysConfig?.exchangerate;
    this.baseUrl = this.exchangeRateConfig?.baseUrl || '';
    this.apiKey = this.exchangeRateConfig?.apiKey || '';

    if (!this.baseUrl) {
      this.logger.warn('ExchangeRate baseUrl not configured');
      return;
    }

    if (!this.apiKey) {
      this.logger.warn('ExchangeRate apiKey not configured');
      return;
    }

    this.logger.info(
      `ExchangeRate Client initialized with baseUrl: ${this.baseUrl}`,
    );
  }

  /**
   * 获取汇率
   * @param from 源货币
   * @param to 目标货币
   * @returns 汇率
   */
  async getRate(from: string, to: string): Promise<number> {
    const result = await this.convert({ from, to, amount: 1 });
    return result.rate;
  }

  /**
   * 货币转换
   * @param params 转换参数
   * @returns 转换结果
   */
  async convert(params: ConvertCurrencyParams): Promise<ConvertCurrencyResult> {
    this.ensureConfigured();

    const from = params.from.trim().toUpperCase();
    const to = params.to.trim().toUpperCase();

    try {
      const response = await firstValueFrom(
        this.httpService.get<ExchangeRateConvertResponse>(
          `${this.baseUrl}/convert`,
          {
            params: {
              access_key: this.apiKey,
              from,
              to,
              amount: params.amount,
            },
            headers: {
              Accept: 'application/json',
            },
            timeout: 10000,
          },
        ),
      );

      const data = response.data;

      if (data.success === false) {
        throw new Error(data.error?.info || 'ExchangeRate API returned error');
      }

      const convertedAmount = data.result;
      const rate =
        data.info?.quote ??
        data.info?.rate ??
        (typeof convertedAmount === 'number' && params.amount !== 0
          ? convertedAmount / params.amount
          : undefined);

      if (
        typeof convertedAmount !== 'number' ||
        !Number.isFinite(convertedAmount) ||
        typeof rate !== 'number' ||
        !Number.isFinite(rate)
      ) {
        throw new Error('Exchange rate API returned invalid data');
      }

      return {
        from,
        to,
        amount: params.amount,
        convertedAmount,
        rate,
      };
    } catch (error) {
      this.handleError('convert', error as AxiosError, {
        from,
        to,
        amount: params.amount,
        baseUrl: this.baseUrl,
      });
    }
  }

  private ensureConfigured() {
    if (!this.baseUrl) {
      throw new Error(
        'ExchangeRate baseUrl not configured in keys/config.json (exchangerate.baseUrl)',
      );
    }

    if (!this.apiKey) {
      throw new Error(
        'ExchangeRate apiKey not configured in keys/config.json (exchangerate.apiKey)',
      );
    }
  }

  private handleError(
    operation: string,
    error: AxiosError,
    context?: Record<string, unknown>,
  ): never {
    const errorMessage = this.extractErrorMessage(error);
    const statusCode = error.response?.status;

    this.logger.error(
      `ExchangeRate API Error [${operation}]: ${errorMessage}`,
      {
        statusCode,
        context,
        responseData: error.response?.data,
      },
    );

    if (statusCode === 401 || statusCode === 403) {
      throw new Error('ExchangeRate API authentication failed');
    }

    if (statusCode === 429) {
      throw new Error('ExchangeRate API rate limit exceeded');
    }

    if (error.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to ExchangeRate server: ${this.baseUrl}`);
    }

    if (error.code === 'ETIMEDOUT') {
      throw new Error('ExchangeRate request timeout');
    }

    throw new Error(`ExchangeRate API error: ${errorMessage}`);
  }

  private extractErrorMessage(error: AxiosError): string {
    const responseData = error.response?.data;

    if (responseData && typeof responseData === 'object') {
      const data = responseData as ExchangeRateConvertResponse & {
        message?: string;
      };

      return (
        data.error?.info || data.message || error.message || 'Unknown error'
      );
    }

    return error.message || 'Unknown error';
  }
}
