import { ExceptionFilter, ArgumentsHost, HttpException } from '@nestjs/common';
import { ApiException } from "./api.exception";
import { Logger } from 'winston';
export declare class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger;
    constructor(logger: Logger);
    catch(exception: HttpException | ApiException, host: ArgumentsHost): void;
    private getChannelFromHost;
    private buildResponseBody;
}
