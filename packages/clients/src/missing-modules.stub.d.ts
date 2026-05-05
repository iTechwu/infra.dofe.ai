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

declare module 'nodemailer' {
  import { Transporter } from 'nodemailer';
  export interface TransportOptions {
    [key: string]: any;
  }
  export interface Transporter {
    sendMail(mailOptions: any, callback?: (err: Error | null, info: any) => void): Promise<any>;
    use(step: string, transport: any): Transporter;
  }
  export function createTransport(transport?: any, defaults?: any): Transporter;
  const nodemailer: {
    createTransport(transport?: any, defaults?: any): Transporter;
  };
  export default nodemailer;
}

declare module 'nodemailer-sendcloud-transport' {
  interface SendCloudOptions {
    auth: {
      apiUser: string;
      apiKey: string;
    };
  }
  export default function sendCloudTransport(options: SendCloudOptions): any;
}

declare module 'lodash' {
  const _: any;
  export default _;
  export function assign(object: any, ...sources: any[]): any;
  export function cloneDeep(value: any): any;
  export function merge(object: any, ...sources: any[]): any;
  export function get(object: any, path: string | string[], defaultValue?: any): any;
  export function set(object: any, path: string | string[], value: any): any;
  export function pick(object: any, ...paths: string[][]): any;
  export function omit(object: any, ...paths: string[][]): any;
  export function flatten(array: any[]): any[];
  export function flattenDeep(array: any[]): any[];
  export function debounce<T extends (...args: any[]) => any>(func: T, wait?: number, options?: any): T;
  export function throttle<T extends (...args: any[]) => any>(func: T, wait?: number, options?: any): T;
}

declare module 'js-yaml' {
  export function load(input: string | Buffer, options?: any): any;
  export function loadAll(input: string | Buffer, iterator?: (doc: any) => void, options?: any): any[];
  export function safeLoad(input: string | Buffer, options?: any): any;
  export function dump(input: any, options?: any): string;
  export function safeDump(input: any, options?: any): string;
  const yaml: {
    load(input: string | Buffer, options?: any): any;
    loadAll(input: string | Buffer, iterator?: (doc: any) => void, options?: any): any[];
    safeLoad(input: string | Buffer, options?: any): any;
    dump(input: any, options?: any): string;
    safeDump(input: any, options?: any): string;
  };
  export default yaml;
}

declare module 'ws' {
  import { EventEmitter } from 'events';

  interface ClientOptions {
    headers?: { [key: string]: string };
    protocol?: string;
    followRedirects?: boolean;
    handshakeTimeout?: number;
    maxRedirects?: number;
    maxPayload?: number;
    perMessageDeflate?: boolean | any;
    rejectUnauthorized?: boolean;
    origin?: string;
  }

  class WebSocket extends EventEmitter {
    static CONNECTING: 0;
    static OPEN: 1;
    static CLOSING: 2;
    static CLOSED: 3;
    static Data: typeof Data;
    readonly CONNECTING: 0;
    readonly OPEN: 1;
    readonly CLOSING: 2;
    readonly CLOSED: 3;
    readonly readyState: number;
    readonly protocol: string;
    readonly url: string;
    readonly bufferedAmount: number;
    binaryType: string;
    onopen: ((event: any) => void) | null;
    onclose: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    onmessage: ((event: any) => void) | null;
    constructor(url: string, options?: ClientOptions);
    close(code?: number, reason?: string): void;
    send(data: any, cb?: (err?: Error) => void): void;
    ping(data?: any, mask?: boolean, cb?: (err?: Error) => void): void;
    pong(data?: any, mask?: boolean, cb?: (err?: Error) => void): void;
    terminate(): void;
  }

  type Data = Buffer | ArrayBuffer | Buffer[];
  export { Data };
  export default WebSocket;
}
