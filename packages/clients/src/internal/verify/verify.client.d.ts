import { RedisService } from "../../../../redis/src";
export declare class VerifyClient {
    private readonly redis;
    constructor(redis: RedisService);
    getMobileCode(mobile: string): Promise<any>;
    validateMobileCode(mobile: string, code: string): Promise<boolean>;
    generateMobileCode(mobile: string, expireIn?: number): Promise<string>;
    getEmailCode(email: string): Promise<any>;
    validateEmailCode(email: string, code: string): Promise<boolean>;
    generateEmailCode(email: string, expireIn?: number): Promise<string>;
}
