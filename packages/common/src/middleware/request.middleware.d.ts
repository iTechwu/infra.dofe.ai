import { NestMiddleware } from '@nestjs/common';
import { IncomingMessage, ServerResponse } from 'http';
import { Logger } from 'winston';
export declare const TRACE_ID_HEADER = "x-trace-id";
declare module 'fastify' {
    interface FastifyRequest {
        traceId: string;
        locale: string;
        realIp: string;
    }
}
export declare const clsNamespace: any;
/**
 * RequestMiddleware
 *
 * 重要说明：在 Fastify 适配器下，NestMiddleware 的 use 方法接收的参数类型
 * 实际上是原生的 Node.js 对象（IncomingMessage 和 ServerResponse），
 * 而不是 Fastify 的封装对象（FastifyRequest 和 FastifyReply）。
 *
 * 这是因为：
 * 1. NestJS 中间件接口设计为接收原生对象，以保持与不同 HTTP 框架的兼容性
 * 2. Fastify 适配器通过 middie 包处理中间件，传递的是原生对象
 * 3. 虽然类型声明可以使用 FastifyRequest/FastifyReply，但运行时实际是原生对象
 *
 * 解决方案：
 * - 使用泛型参数明确指定类型：NestMiddleware<IncomingMessage, ServerResponse>
 * - 或者保持 any 类型，在运行时通过类型断言访问 Fastify 特有的属性
 */
export default class RequestMiddleware implements NestMiddleware<IncomingMessage, ServerResponse> {
    private readonly logger;
    constructor(logger: Logger);
    use(req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void>;
}
