"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWinstonConfig = getWinstonConfig;
exports.getReqMainInfo = getReqMainInfo;
const winston = __importStar(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const _ = __importStar(require("lodash"));
const path = __importStar(require("path"));
/**
 * 获取项目根目录路径
 * 处理 Windows 环境下 $(pwd) 未展开的问题
 */
function getProjectRoot() {
    let projectRoot = process.env.PROJECT_ROOT;
    // 如果 PROJECT_ROOT 包含 $(pwd)，则替换为实际的工作目录
    if (projectRoot && projectRoot.includes('$(pwd)')) {
        projectRoot = projectRoot.replace('$(pwd)', process.cwd());
    }
    // 如果 PROJECT_ROOT 未设置或为空，使用当前工作目录
    if (!projectRoot) {
        projectRoot = process.cwd();
    }
    return projectRoot;
}
/**
 * 生成 winston 配置
 * @param output 日志输出模式 (从 YAML config.app.nestLogOutput 获取)
 */
function getWinstonConfig(output = 'file') {
    const projectRoot = getProjectRoot();
    const logsDir = path.join(projectRoot, 'logs');
    const transports = [];
    // 文件输出 (file 或 both 模式)
    if (output === 'file' || output === 'both') {
        transports.push(new winston_daily_rotate_file_1.default({
            dirname: logsDir,
            filename: `${process.env.MICRO_SERVER_NAME}-%DATE%-info.log`,
            level: 'info',
            zippedArchive: true,
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
        }), new winston_daily_rotate_file_1.default({
            dirname: logsDir,
            filename: `${process.env.MICRO_SERVER_NAME}-%DATE%-error.log`,
            level: 'error',
            zippedArchive: true,
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
        }), new winston_daily_rotate_file_1.default({
            dirname: logsDir,
            filename: `${process.env.MICRO_SERVER_NAME}-%DATE%-warn.log`,
            level: 'warn',
            zippedArchive: true,
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
        }));
    }
    // 控制台输出 (console 或 both 模式)
    if (output === 'console' || output === 'both') {
        transports.push(new winston.transports.Console());
    }
    // 格式化配置
    const formats = [winston.format.timestamp(), winston.format.json()];
    // if (output !== 'file') {
    formats.push(winston.format.prettyPrint()); // 日志格式化
    // }
    return {
        format: winston.format.combine(...formats),
        transports: transports,
    };
}
function getReqMainInfo(req, res) {
    return {
        ..._.pick(req, [
            'ip',
            'hostname',
            'method',
            'url',
            'body',
            'user',
            'httpVersion',
            'headers',
        ]),
        ..._.pick(res, ['statusCode']),
    };
}
// 访问日志
// export const accessLogger = winston.createLogger(getWinstonConfig('ACCESS'))
// // 调用其他系统的请求日志
// export const requestLogger = winston.createLogger(getWinstonConfig('REQUEST'))
// // DB 日志
// export const dbLogger = winston.createLogger(getWinstonConfig('DB'))
// // 通用日志
// export const logger = winston.createLogger(getWinstonConfig('DEFAULT'))
// // 系统错误日志
// export const errorLogger = winston.createLogger(getWinstonConfig('ERROR'))
//# sourceMappingURL=logger.util.js.map