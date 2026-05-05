/**
 * Ambient module declarations for optional peer dependencies.
 * These packages are installed by consuming applications, not in the infra monorepo.
 */
declare module '@nestjs/swagger' {
  type MixedDecorator = ClassDecorator & MethodDecorator & ParameterDecorator;
  export function ApiProperty(options?: any): PropertyDecorator;
  export function ApiOperation(options?: any): MixedDecorator;
  export function ApiTags(...tags: string[]): ClassDecorator;
  export function ApiBearerAuth(): MixedDecorator;
  export function ApiParam(options?: any): MixedDecorator;
  export function ApiQuery(options?: any): MixedDecorator;
  export function ApiBody(options?: any): MixedDecorator;
  export function ApiResponse(options?: any): MixedDecorator;
  export function ApiOkResponse(options?: any): MixedDecorator;
  export function ApiHeader(options?: any): MixedDecorator;
  export function ApiExtraModels(...models: any[]): MixedDecorator;
  export function ApiExcludeEndpoint(): MixedDecorator;
  export function getSchemaPath(model: any): string;
  export class SwaggerModule {
    static createDocument(app: any, config: any): any;
    static setup(path: string, app: any, document: any): void;
  }
  export class DocumentBuilder {
    setTitle(title: string): DocumentBuilder;
    setDescription(description: string): DocumentBuilder;
    setVersion(version: string): DocumentBuilder;
    addBearerAuth(): DocumentBuilder;
    build(): any;
  }
}

declare module '@nestjs/jwt' {
  export class JwtModule {
    static register(options?: any): any;
    static registerAsync(options?: any): any;
  }
  export class JwtService {
    sign(payload: any, options?: any): string;
    signAsync(payload: any, options?: any): Promise<string>;
    verify(token: string, options?: any): any;
    verifyAsync(token: string, options?: any): Promise<any>;
    decode(token: string, options?: any): any;
  }
}

declare module 'unleash-client' {
  export class UnleashClient {
    constructor(config: any);
    start(): void;
    stop(): void;
    isEnabled(name: string, context?: any): boolean;
    getVariant(name: string, context?: any): any;
  }
  export function initialize(options: any): UnleashClient;
}

declare module 'uuid' {
  export function v1(options?: any, buffer?: any, offset?: number): string;
  export function v3(name: string | any[], namespace: string | any[], buffer?: any, offset?: number): string;
  export function v4(options?: any, buffer?: any, offset?: number): string;
  export function v5(name: string | any[], namespace: string | any[], buffer?: any, offset?: number): string;
  export function validate(uuid: string): boolean;
  export function version(uuid: string): number;
  export function parse(uuid: string): Uint8Array;
  export function stringify(buffer: Uint8Array): string;
}

declare module '@prisma/client' {
  export const FileBucketVendor: {
    readonly s3: 's3';
    readonly oss: 'oss';
    readonly tos: 'tos';
    readonly gcs: 'gcs';
    readonly qiniu: 'qiniu';
    readonly us3: 'us3';
    readonly cos: 'cos';
  };
  export type FileBucketVendor = (typeof FileBucketVendor)[keyof typeof FileBucketVendor];

  export const FileEnvType: {
    readonly dev: 'dev';
    readonly test: 'test';
    readonly prod: 'prod';
    readonly produs: 'produs';
    readonly prodap: 'prodap';
  };
  export type FileEnvType = (typeof FileEnvType)[keyof typeof FileEnvType];

  export interface FileSource {
    id: string;
    vendor?: FileBucketVendor;
    bucket?: string;
    key?: string;
    ext?: string;
    env?: string;
    [key: string]: unknown;
  }

  export class PrismaClient {
    constructor(options?: Record<string, unknown>);
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $extends(extension: Record<string, unknown>): this;
    $transaction<T>(fn: (client: any) => Promise<T>, options?: { maxWait?: number; timeout?: number; isolationLevel?: string }): Promise<T>;
    [model: string]: any;
  }

  export namespace Prisma {
    export type TransactionIsolationLevel = string;
    export type SortOrder = 'asc' | 'desc';
    export type InputJsonValue = string | number | boolean | null | InputJsonValue[] | { [key: string]: InputJsonValue };
    export const dmmf: unknown;
    export class PrismaClientKnownRequestError extends Error {
      code: string;
      meta?: Record<string, unknown>;
    }
    export class PrismaClientValidationError extends Error {}
    export class PrismaClientInitializationError extends Error {
      errorCode?: string;
    }
    export class PrismaClientUnknownRequestError extends Error {}
    export class PrismaClientRustPanicError extends Error {}
  }
}
