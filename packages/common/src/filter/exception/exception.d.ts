import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Logger } from 'winston';
export declare class ExceptionsFilter implements ExceptionFilter {
    private readonly logger;
    constructor(logger: Logger);
    catch(exception: any, host: ArgumentsHost): void;
}
