// Stub declarations for third-party modules that lack TypeScript type definitions.
// This file allows the package to compile without installing @types/* for every dep.

declare module 'ali-oss' {
  interface OSSOptions {
    region?: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket?: string;
    endpoint?: string;
    authorizationV4?: boolean;
    timeout?: number;
    retryMax?: number;
    debug?: boolean;
    [key: string]: unknown;
  }

  class OSS {
    constructor(options: OSSOptions);
    processObjectSave(
      sourceKey: string,
      targetKey: string | null,
      process: string,
      bucket?: string,
    ): Promise<any>;
    authorization(
      method: string,
      resource: string,
      subres?: Record<string, string>,
      headers?: Record<string, string>,
    ): string;
    get(name: string, options?: any): Promise<any>;
    head(name: string, options?: any): Promise<any>;
    [key: string]: any;
  }

  export = OSS;
}

declare module 'ws' {
  import { EventEmitter } from 'events';

  class WebSocket extends EventEmitter {
    static CONNECTING: 0;
    static OPEN: 1;
    static CLOSING: 2;
    static CLOSED: 3;
    readonly readyState: number;
    readonly url: string;
    constructor(url: string, protocols?: string | string[] | WebSocket.ClientOptions);
    send(data: Buffer | string | ArrayBufferLike | DataView, cb?: (err?: Error) => void): void;
    close(code?: number, reason?: string | Buffer): void;
    terminate(): void;
    ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    pong(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    on(event: 'open', listener: () => void): this;
    on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'message', listener: (data: Buffer, isBinary: boolean) => void): this;
    on(event: 'ping', listener: (data: Buffer) => void): this;
    on(event: 'pong', listener: (data: Buffer) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  namespace WebSocket {
    interface ClientOptions {
      headers?: Record<string, string>;
      perMessageDeflate?: boolean | object;
      maxPayload?: number;
      [key: string]: unknown;
    }
  }

  export = WebSocket;
}

declare module 'uuid' {
  function v4(options?: any, buffer?: any, offset?: number): string;
  function v1(options?: any, buffer?: any, offset?: number): string;
  function v3(name: string | any[], namespace: string | any[], buffer?: any, offset?: number): string;
  function v5(name: string | any[], namespace: string | any[], buffer?: any, offset?: number): string;
  function validate(uuid: string): boolean;
  function version(uuid: string): number;
}

declare module 'music-metadata' {
  export function parseBuffer(buffer: Buffer, options?: string | { mimeType?: string; [key: string]: any }): Promise<any>;
  export function parseStream(stream: any, mimeType?: string | { mimeType?: string; [key: string]: any }, options?: any): Promise<any>;
  export function parseFile(filePath: string, options?: any): Promise<any>;
}

declare module '@volcengine/openapi' {
  export class Signer {
    constructor(params: any, serviceName?: string);
    sign(request: any): void;
    addAuthorization(credentials: any): void;
    addAuthorization(credentials: any, date: any): void;
    static sign(request: any, credentials: any): void;
  }
}

declare module '@volcengine/tos-sdk' {
  class TosClient {
    constructor(options: any);
    [key: string]: any;
  }
  export { TosClient };
}

declare module '@alicloud/imm20200930' {
  export class DetectMediaMetaRequest {
    constructor(params?: any);
    projectName?: string;
    sourceURI?: string;
    [key: string]: any;
  }

  export class CreateMediaConvertTaskRequest {
    constructor(params?: any);
    projectName?: string;
    sources?: any[];
    targets?: any[];
    notification?: any;
    userData?: string;
    tags?: Record<string, string>;
    [key: string]: any;
  }

  export class GetTaskRequest {
    constructor(params?: any);
    taskId?: string;
    projectName?: string;
    requestDefinition?: boolean;
    taskType?: any;
    [key: string]: any;
  }

  export class DetectMediaMetaResponseBody {
    duration?: string;
    formatName?: string;
    videoStreams?: any[];
    audioStreams?: any[];
    videoWidth?: number;
    videoHeight?: number;
    [key: string]: any;
  }

  export default class IMM {
    constructor(config: any);
    detectMediaMetaWithOptions(request: DetectMediaMetaRequest, runtime: any): Promise<{
      body: DetectMediaMetaResponseBody;
      [key: string]: any;
    }>;
    createMediaConvertTaskWithOptions(request: CreateMediaConvertTaskRequest, runtime: any): Promise<{
      body: {
        taskId: string;
        eventId: string;
        requestId: string;
        [key: string]: any;
      };
      [key: string]: any;
    }>;
    getTaskWithOptions(request: GetTaskRequest, runtime: any): Promise<{
      body: {
        status: string;
        progress?: number;
        result?: any;
        error?: string;
        [key: string]: any;
      };
      [key: string]: any;
    }>;
    [key: string]: any;
  }
}

declare module '@alicloud/openapi-core' {
  export class Config {
    constructor(params?: any);
    [key: string]: any;
  }
  export const $OpenApiUtil: {
    Config: typeof Config;
    [key: string]: any;
  };
}

declare module '@darabonba/typescript' {
  export class RuntimeOptions {
    constructor(params?: any);
    [key: string]: any;
  }
}

declare module '@alicloud/credentials' {
  export default class Credential {
    constructor(options?: any);
    getAccessKeyId(): Promise<string>;
    getAccessKeySecret(): Promise<string>;
    [key: string]: any;
  }
}
