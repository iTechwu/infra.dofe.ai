import * as winston from 'winston';
import { FastifyReply, FastifyRequest } from 'fastify';
/** 日志输出模式类型 */
export type LogOutputMode = 'console' | 'file' | 'both';
/**
 * 生成 winston 配置
 * @param output 日志输出模式 (从 YAML config.app.nestLogOutput 获取)
 */
export declare function getWinstonConfig(output?: LogOutputMode): {
    format: winston.Logform.Format;
    transports: winston.transport[];
};
export declare function getReqMainInfo(req: FastifyRequest, res: FastifyReply): Record<string, unknown>;
