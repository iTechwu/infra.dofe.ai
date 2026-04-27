import { Logger } from 'winston';
import { ConfigService } from '@nestjs/config';
export declare class CryptClient {
    private readonly configService;
    private readonly logger;
    private config;
    constructor(configService: ConfigService, logger: Logger);
    encrypt(text: string, iv?: string, key?: string): string;
    decrypt(text: string, iv?: string, key?: string): string;
    getSignUrl(url: string): string;
}
