import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { I18nContext } from 'nestjs-i18n';
import { ApiException } from '@/filter/exception/api.exception';

import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

/**
 * 格式化的验证错误项
 */
interface FormattedValidationError {
  path: (string | number)[];
  message: string;
  code?: string;
}

/**
 * ts-rest 验证错误中各部分的类型
 * 兼容 ZodError（旧版）和 StandardSchemaError（新版）
 */
interface TsRestValidationPart {
  issues: Array<{
    path?: readonly (string | number)[] | readonly PropertyKey[];
    message: string;
    code?: string;
  }>;
}

/**
 * 检查是否为 ts-rest RequestValidationError / TsRestRequestValidationError
 * 两者都有 pathParams, headers, query, body 属性，且都继承 BadRequestException
 */
function isTsRestValidationError(
  exception: unknown,
): exception is BadRequestException & {
  pathParams: TsRestValidationPart | null;
  headers: TsRestValidationPart | null;
  query: TsRestValidationPart | null;
  body: TsRestValidationPart | null;
} {
  if (!(exception instanceof BadRequestException)) {
    return false;
  }
  const exc = exception as unknown as Record<string, unknown>;
  return (
    'pathParams' in exc && 'headers' in exc && 'query' in exc && 'body' in exc
  );
}

/**
 * 格式化验证错误（兼容 ZodError 和 StandardSchemaError）
 */
function formatValidationIssues(
  error: TsRestValidationPart,
): FormattedValidationError[] {
  return error.issues.map((issue) => ({
    path: (issue.path ?? []).filter(
      (p): p is string | number =>
        typeof p === 'string' || typeof p === 'number',
    ),
    message: issue.message,
    code: issue.code,
  }));
}

@Catch(HttpException, ApiException)
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  catch(exception: HttpException | ApiException, host: ArgumentsHost) {
    // console.log('TECHWU HttpExceptionFilter', exception);
    const { channel, message } = this.getChannelFromHost(host);
    // console.log('TECHWU exception', exception);
    if (channel) {
      this.logger.error(exception.message, exception.stack);
      channel.nack(message, false, false);
    } else {
      const i18n = I18nContext.current(host);
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<FastifyReply>();
      const request = ctx.getRequest<FastifyRequest>();
      const status = exception.getStatus();

      // 特殊处理参数校验失败
      let validationErrors = null;

      if (exception instanceof BadRequestException) {
        const exceptionResponse = exception.getResponse() as any;
        if (exceptionResponse && exceptionResponse.message) {
          if (Array.isArray(exceptionResponse.message)) {
            validationErrors = exceptionResponse.message;
          } else {
            validationErrors = [exceptionResponse.message];
          }
        }
      }
      const responseBody = this.buildResponseBody(
        exception,
        request,
        status,
        i18n,
        validationErrors,
      );

      const { timestamp, path, ...responseRet } = responseBody;
      // console.log('TECHWU , responseBody', responseBody)
      response.status(status).send(responseRet);
    }
  }

  private getChannelFromHost(host: ArgumentsHost): {
    channel: any;
    message: any;
  } {
    try {
      const ctx = host.switchToRpc();
      const context = ctx.getContext();
      const channel = context.getChannelRef ? context.getChannelRef() : null;
      const message = context.getMessage ? context.getMessage() : null;
      return { channel, message };
    } catch (error) {
      console.error('获取通道或消息时发生错误', error);
      return { channel: null, message: null };
    }
  }

  private buildResponseBody(
    exception: HttpException,
    request: FastifyRequest,
    status: number,
    i18n: I18nContext,
    validationErrors?: string[] | null,
  ): any {
    const isApiException = exception instanceof ApiException;
    const timestamp = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
    });
    const path = request.url;

    // Get traceId for error tracking
    const traceId = request.traceId;

    // Get error code
    const code = isApiException ? exception.getErrorCode() : status;

    // Get error message
    const message = isApiException
      ? exception.getErrorMessage(i18n)
      : exception.message || exception.getResponse();

    // Get error data
    const data = isApiException ? exception.getErrorData() : undefined;

    const responseBody: any = {
      code,
      msg: message, // 使用 msg 与成功响应保持一致
      traceId, // 添加 traceId 便于问题追踪
      timestamp,
      path,
    };

    // Add enhanced error details for ApiException
    if (isApiException) {
      responseBody.error = data;
    }

    // 特殊处理 ts-rest 验证错误
    if (isTsRestValidationError(exception)) {
      const tsRestErrors: Record<string, FormattedValidationError[]> = {};
      const errorMessages: string[] = [];

      if (exception.pathParams) {
        tsRestErrors.pathParams = formatValidationIssues(exception.pathParams);
        errorMessages.push(
          `Path params: ${tsRestErrors.pathParams.map((e) => `${e.path.join('.')} (${e.message})`).join(', ')}`,
        );
      }
      if (exception.headers) {
        tsRestErrors.headers = formatValidationIssues(exception.headers);
        errorMessages.push(
          `Headers: ${tsRestErrors.headers.map((e) => `${e.path.join('.')} (${e.message})`).join(', ')}`,
        );
      }
      if (exception.query) {
        tsRestErrors.query = formatValidationIssues(exception.query);
        errorMessages.push(
          `Query: ${tsRestErrors.query.map((e) => `${e.path.join('.')} (${e.message})`).join(', ')}`,
        );
      }
      if (exception.body) {
        tsRestErrors.body = formatValidationIssues(exception.body);
        errorMessages.push(
          `Body: ${tsRestErrors.body.map((e) => `${e.path.join('.')} (${e.message})`).join(', ')}`,
        );
      }

      // 记录详细日志
      this.logger.warn('ts-rest request validation failed', {
        url: request.url,
        method: request.method,
        errors: tsRestErrors,
        traceId,
      });

      responseBody.msg = 'Request validation failed';
      responseBody.error = {
        message:
          errorMessages.length > 0
            ? errorMessages.join('; ')
            : 'Validation failed',
        details: tsRestErrors,
      };
      return responseBody;
    }

    // 如果是参数校验失败，添加详细的错误信息
    if (validationErrors && validationErrors.length > 0) {
      responseBody.error = { errorData: validationErrors };
    }

    return responseBody;
  }
}
