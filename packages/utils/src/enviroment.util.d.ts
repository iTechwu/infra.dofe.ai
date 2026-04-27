import { FastifyRequest } from 'fastify';
import { FileEnvType } from '@prisma/client';
declare const _default: {
    getBaseZone(): string;
    getNeedSsoLogin(): string;
    getDevDebug(): string;
    getDevConnectProdDB(): string;
    getEnv(): FileEnvType;
    isDevDebug(): boolean;
    isDevConnectProdDB(): boolean;
    isDev(): boolean;
    isTest(): boolean;
    isProduction(): any;
    isCheckSha256(): any;
    isCnProduction(): boolean;
    isApProduction(): boolean;
    checkEnvCanSso(): boolean;
    isWeChatMiniProgram(req: FastifyRequest): boolean;
    generateEnvironmentUrls(): {
        web: string;
        api: string;
        internalApi: string;
        short: string;
        corsDomains: string[];
    };
};
export default _default;
