import { ConfigService } from '@nestjs/config';
export declare class EncryptionService {
    private readonly configService;
    private readonly encryptionKey;
    constructor(configService: ConfigService);
    encrypt(plainText: string): Uint8Array;
    decrypt(encryptedBuffer: Uint8Array): string;
    hash(input: string): string;
}
