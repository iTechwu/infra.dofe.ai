import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';
import { FastifyReply, FastifyRequest } from 'fastify';

/**
 * 获取项目根目录路径
 * 处理 Windows 环境下 $(pwd) 未展开的问题
 */
function getProjectRoot(): string {
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

/** 日志输出模式类型 */
export type LogOutputMode = 'console' | 'file' | 'both';

function isDbLog(info: winston.Logform.TransformableInfo): boolean {
  return info.category === 'db';
}

function isDbInfoLog(info: winston.Logform.TransformableInfo): boolean {
  return (
    isDbLog(info) &&
    (info.event === 'query' || info.event === 'request-db-summary')
  );
}

function isDbSlowQueryLog(info: winston.Logform.TransformableInfo): boolean {
  return isDbLog(info) && info.event === 'slow-query';
}

function isDbErrorLog(info: winston.Logform.TransformableInfo): boolean {
  return isDbLog(info) && info.event === 'query-error';
}

function isRuntimeInfoOrWarnLog(info: winston.Logform.TransformableInfo): boolean {
  return !isDbLog(info);
}

function isRuntimeErrorLog(info: winston.Logform.TransformableInfo): boolean {
  return !isDbLog(info) || isDbErrorLog(info);
}

function withFilter(
  predicate: (info: winston.Logform.TransformableInfo) => boolean,
): winston.Logform.Format {
  return winston.format((info) => (predicate(info) ? info : false))();
}

/**
 * 日志文件名前缀：优先 MICRO_SERVER_NAME，缺省回落为进程标题，
 * 避免 `undefined-2026-xx-xx-*.log` 这类不可辨识文件名。
 */
function getLogFileNamePrefix(): string {
  return process.env.MICRO_SERVER_NAME || process.env.npm_package_name || 'app';
}

/** 请求日志允许保留的 header 白名单（路由/排障所需且无凭证语义）。 */
const SAFE_REQUEST_HEADER_KEYS = [
  'host',
  'content-type',
  'content-length',
  'user-agent',
  'accept',
  'accept-language',
  'referer',
  'origin',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-real-ip',
  'x-trace-id',
] as const;

/** query key 命中这些词根时整段键值对视为敏感并打码。 */
const SENSITIVE_QUERY_KEY_PATTERN =
  /(key|token|secret|password|passwd|signature|credential|authorization|apikey|api_key|access_token|refresh_token|session|cookie)/i;

function pickSafeHeaders(headers: unknown): Record<string, unknown> {
  if (!headers || typeof headers !== 'object') return {};
  const source = headers as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of SAFE_REQUEST_HEADER_KEYS) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}

/**
 * 规范化 URL：保留 path，query 值中的敏感键整对打码，其余 query 值仅保留长度标记，
 * 避免完整 URI 中的密钥/租户参数进入日志。
 */
function sanitizeUrl(url: unknown): string {
  if (typeof url !== 'string') return String(url ?? '');
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) return url;
  const path = url.slice(0, queryIndex);
  const query = url.slice(queryIndex + 1);
  const sanitized = query
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf('=');
      const key = eq === -1 ? pair : pair.slice(0, eq);
      if (SENSITIVE_QUERY_KEY_PATTERN.test(key)) return `${key}=***`;
      return `${key}=~${eq === -1 ? 0 : pair.length - eq - 1}`;
    })
    .join('&');
  return `${path}?${sanitized}`;
}

/** 主体只保留身份标识字段，绝不变量输出整个 user 对象。 */
function pickSafeUser(user: unknown): Record<string, unknown> | undefined {
  if (!user || typeof user !== 'object') return undefined;
  const identityKeys = ['id', 'userId', 'user_id', 'tenantId', 'tenant_id', 'teamId', 'team_id'];
  const result: Record<string, unknown> = {};
  for (const key of identityKeys) {
    if (key in (user as Record<string, unknown>)) {
      result[key] = (user as Record<string, unknown>)[key];
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * 生成 winston 配置
 * @param output 日志输出模式 (从 YAML config.app.nestLogOutput 获取)
 */
export function getWinstonConfig(output: LogOutputMode = 'file'): {
  format: winston.Logform.Format;
  transports: winston.transport[];
} {
  const projectRoot = getProjectRoot();
  const logsDir = path.join(projectRoot, 'logs');
  const transports: winston.transport[] = [];

  // 文件输出 (file 或 both 模式)
  if (output === 'file' || output === 'both') {
    transports.push(
      new DailyRotateFile({
        dirname: logsDir,
        filename: `${getLogFileNamePrefix()}-%DATE%-info.log`,
        level: 'info',
        format: withFilter(isRuntimeInfoOrWarnLog),
        zippedArchive: true,
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
      }),
      new DailyRotateFile({
        dirname: logsDir,
        filename: `${getLogFileNamePrefix()}-%DATE%-error.log`,
        level: 'error',
        format: withFilter(isRuntimeErrorLog),
        zippedArchive: true,
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
      }),
      new DailyRotateFile({
        dirname: logsDir,
        filename: `${getLogFileNamePrefix()}-%DATE%-warn.log`,
        level: 'warn',
        format: withFilter(isRuntimeInfoOrWarnLog),
        zippedArchive: true,
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
      }),
      new DailyRotateFile({
        dirname: logsDir,
        filename: `${getLogFileNamePrefix()}-%DATE%-db-info.log`,
        // 仅 info 及以上：db-info 只保留 request-db-summary，
        // 逐条 query debug 事件不再落盘（此前每天产生数百 MB 噪声）
        level: 'info',
        format: withFilter(isDbInfoLog),
        zippedArchive: true,
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
      }),
      new DailyRotateFile({
        dirname: logsDir,
        filename: `${getLogFileNamePrefix()}-%DATE%-db-slow-query.log`,
        level: 'info',
        format: withFilter(isDbSlowQueryLog),
        zippedArchive: true,
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
      }),
      new DailyRotateFile({
        dirname: logsDir,
        filename: `${getLogFileNamePrefix()}-%DATE%-db-error.log`,
        level: 'error',
        format: withFilter(isDbErrorLog),
        zippedArchive: true,
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
      }),
    );
  }

  // 控制台输出 (console 或 both 模式)
  if (output === 'console' || output === 'both') {
    transports.push(new winston.transports.Console());
  }

  // 格式化配置：文件输出统一单行 JSON（多行 prettyPrint 破坏采集/关联）；
  // 仅 console 模式保留 prettyPrint 以便人工阅读。
  const formats = [winston.format.timestamp(), winston.format.json()];
  if (output === 'console') {
    formats.push(winston.format.prettyPrint());
  }

  return {
    format: winston.format.combine(...formats),
    transports: transports,
  };
}

/**
 * 请求日志摘要（脱敏）：
 * - 只允许 method、url（query 已打码）、ip、hostname、httpVersion；
 * - headers 走白名单，禁止原样输出 Authorization/Cookie/Set-Cookie/x-api-key 等；
 * - body 永不输出内容，仅记录是否存在与字节长度；
 * - user 只保留身份标识字段。
 * P0（2026-09-11 运行分析）：此前 headers/body/user 全量落盘，
 * 生产日志中出现 5 万+ 次完整 Bearer 凭证与 Cookie 明文。
 */
export function getReqMainInfo(
  req: FastifyRequest,
  res: FastifyReply,
): Record<string, unknown> {
  const body = (req as { body?: unknown }).body;
  let bodyMeta: Record<string, unknown> | undefined;
  if (body !== undefined) {
    let bodySize: number | undefined;
    try {
      bodySize = typeof body === 'string' ? Buffer.byteLength(body) : JSON.stringify(body).length;
    } catch {
      bodySize = undefined;
    }
    bodyMeta = { bodyPresent: true, ...(bodySize !== undefined ? { bodyBytes: bodySize } : {}) };
  }

  const safeUser = pickSafeUser((req as { user?: unknown }).user);
  const httpVersion =
    (req as { raw?: { httpVersion?: string } }).raw?.httpVersion ??
    (req as unknown as { httpVersion?: string }).httpVersion;

  return {
    ip: req.ip,
    hostname: req.hostname,
    method: req.method,
    url: sanitizeUrl(req.url),
    httpVersion,
    ...bodyMeta,
    headers: pickSafeHeaders(req.headers),
    ...(safeUser ? { user: safeUser } : {}),
    statusCode: res.statusCode,
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
