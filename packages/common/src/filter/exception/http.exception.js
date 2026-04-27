"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const nestjs_i18n_1 = require("nestjs-i18n");
const api_exception_1 = require("./api.exception");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
/**
 * 检查是否为 ts-rest RequestValidationError / TsRestRequestValidationError
 * 两者都有 pathParams, headers, query, body 属性，且都继承 BadRequestException
 */
function isTsRestValidationError(exception) {
    if (!(exception instanceof common_1.BadRequestException)) {
        return false;
    }
    const exc = exception;
    return ('pathParams' in exc && 'headers' in exc && 'query' in exc && 'body' in exc);
}
/**
 * 格式化验证错误（兼容 ZodError 和 StandardSchemaError）
 */
function formatValidationIssues(error) {
    return error.issues.map((issue) => ({
        path: (issue.path ?? []).filter((p) => typeof p === 'string' || typeof p === 'number'),
        message: issue.message,
        code: issue.code,
    }));
}
let HttpExceptionFilter = class HttpExceptionFilter {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    catch(exception, host) {
        // console.log('TECHWU HttpExceptionFilter', exception);
        const { channel, message } = this.getChannelFromHost(host);
        // console.log('TECHWU exception', exception);
        if (channel) {
            this.logger.error(exception.message, exception.stack);
            channel.nack(message, false, false);
        }
        else {
            const i18n = nestjs_i18n_1.I18nContext.current(host);
            const ctx = host.switchToHttp();
            const response = ctx.getResponse();
            const request = ctx.getRequest();
            const status = exception.getStatus();
            // 特殊处理参数校验失败
            let validationErrors = null;
            if (exception instanceof common_1.BadRequestException) {
                const exceptionResponse = exception.getResponse();
                if (exceptionResponse && exceptionResponse.message) {
                    if (Array.isArray(exceptionResponse.message)) {
                        validationErrors = exceptionResponse.message;
                    }
                    else {
                        validationErrors = [exceptionResponse.message];
                    }
                }
            }
            const responseBody = this.buildResponseBody(exception, request, status, i18n, validationErrors);
            const { timestamp, path, ...responseRet } = responseBody;
            // console.log('TECHWU , responseBody', responseBody)
            response.status(status).send(responseRet);
        }
    }
    getChannelFromHost(host) {
        try {
            const ctx = host.switchToRpc();
            const context = ctx.getContext();
            const channel = context.getChannelRef ? context.getChannelRef() : null;
            const message = context.getMessage ? context.getMessage() : null;
            return { channel, message };
        }
        catch (error) {
            console.error('获取通道或消息时发生错误', error);
            return { channel: null, message: null };
        }
    }
    buildResponseBody(exception, request, status, i18n, validationErrors) {
        const isApiException = exception instanceof api_exception_1.ApiException;
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
        const responseBody = {
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
            const tsRestErrors = {};
            const errorMessages = [];
            if (exception.pathParams) {
                tsRestErrors.pathParams = formatValidationIssues(exception.pathParams);
                errorMessages.push(`Path params: ${tsRestErrors.pathParams.map((e) => `${e.path.join('.')} (${e.message})`).join(', ')}`);
            }
            if (exception.headers) {
                tsRestErrors.headers = formatValidationIssues(exception.headers);
                errorMessages.push(`Headers: ${tsRestErrors.headers.map((e) => `${e.path.join('.')} (${e.message})`).join(', ')}`);
            }
            if (exception.query) {
                tsRestErrors.query = formatValidationIssues(exception.query);
                errorMessages.push(`Query: ${tsRestErrors.query.map((e) => `${e.path.join('.')} (${e.message})`).join(', ')}`);
            }
            if (exception.body) {
                tsRestErrors.body = formatValidationIssues(exception.body);
                errorMessages.push(`Body: ${tsRestErrors.body.map((e) => `${e.path.join('.')} (${e.message})`).join(', ')}`);
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
                message: errorMessages.length > 0
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
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = __decorate([
    (0, common_1.Catch)(common_1.HttpException, api_exception_1.ApiException),
    __param(0, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [winston_1.Logger])
], HttpExceptionFilter);
//# sourceMappingURL=http.exception.js.map