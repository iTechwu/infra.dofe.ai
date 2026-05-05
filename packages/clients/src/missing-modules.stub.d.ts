/**
 * Ambient module declarations for optional peer dependencies.
 * These packages are installed by consuming applications, not in the infra monorepo.
 */
declare module 'form-data' {
  class FormData {
    append(key: string, value: any, options?: any): void;
    getHeaders(): Record<string, string>;
  }
  export = FormData;
}

declare module '@alicloud/dysmsapi20170525' {
  export class SendSmsRequest {
    constructor(options?: {
      phoneNumbers?: string;
      signName?: string;
      templateCode?: string;
      templateParam?: string;
    });
  }
  export class SendSmsResponse { body?: any; }
  class Client {
    constructor(config: any);
    sendSms(request: SendSmsRequest): Promise<SendSmsResponse>;
    sendSmsWithOptions(request: SendSmsRequest, runtime: any): Promise<SendSmsResponse>;
  }
  export default Client;
}

declare module '@alicloud/openapi-client' {
  export class Config {
    constructor(options?: {
      accessKeyId?: string;
      accessKeySecret?: string;
    });
    endpoint?: string;
  }
}

declare module 'tencentcloud-sdk-nodejs-sms' {
  export namespace sms {
    namespace v20210111 {
      class Client {
        constructor(...args: any[]);
        SendSms(req: any): Promise<any>;
      }
    }
  }
}

declare module 'tencentcloud-sdk-nodejs-sms/tencentcloud/services/sms/v20210111/sms_client' {
  export class Client {
    constructor(...args: any[]);
    SendSms(req: any): Promise<any>;
  }
}

declare module 'music-metadata' {
  export function parseFile(filePath: string): Promise<any>;
  export function parseStream(stream: any, mimeType?: string): Promise<any>;
}
