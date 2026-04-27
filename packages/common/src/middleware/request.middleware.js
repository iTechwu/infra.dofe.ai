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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clsNamespace = exports.TRACE_ID_HEADER = void 0;
const common_1 = require("@nestjs/common");
const uuid_1 = require("uuid");
const cls_hooked_1 = require("cls-hooked");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const logger_util_1 = require("../../../utils/dist/logger.util");
const parser = __importStar(require("accept-language-parser"));
const ip_util_1 = __importDefault(require("../../../utils/dist/ip.util"));
const enviroment_util_1 = __importDefault(require("../../../utils/dist/enviroment.util"));
// Trace ID 请求头名称
exports.TRACE_ID_HEADER = 'x-trace-id';
exports.clsNamespace = (0, cls_hooked_1.createNamespace)('app');
/**
 * 获取或生成 Trace ID
 * 优先从请求头获取 (支持分布式追踪)，否则生成新的 UUID
 */
function getOrCreateTraceId(req) {
    const headerTraceId = req.headers[exports.TRACE_ID_HEADER];
    if (headerTraceId && typeof headerTraceId === 'string') {
        return headerTraceId;
    }
    return (0, uuid_1.v4)();
}
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
let RequestMiddleware = class RequestMiddleware {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    async use(req, res, next) {
        exports.clsNamespace.bind(req);
        exports.clsNamespace.bind(res);
        // 获取或生成 Trace ID (支持分布式追踪)
        const traceId = getOrCreateTraceId(req);
        // 添加到请求对象 (便于 Controller/Service 访问)
        // 注意：在中间件中，req 是原生 IncomingMessage
        // 但在 Controller 中，可以通过 context.switchToHttp().getRequest<FastifyRequest>() 获取 FastifyRequest
        req.traceId = traceId;
        // 添加到响应头 (使用原生 Node.js API)
        res.setHeader(exports.TRACE_ID_HEADER, traceId);
        // 解析语言
        const acceptLanguage = req.headers['accept-language'] || '';
        const languages = parser.parse(acceptLanguage);
        let primaryLanguage = languages[0]?.code || 'en';
        if (!['zh-CN', 'en'].includes(primaryLanguage)) {
            primaryLanguage = 'en';
        }
        req.locale = primaryLanguage;
        // 提取 IP 地址
        // 注意：ipUtil.extractIp 期望 FastifyRequest，但中间件中接收的是 IncomingMessage
        // 这里使用类型断言，因为 IncomingMessage 和 FastifyRequest 在 headers 属性上兼容
        const realIp = ip_util_1.default.extractIp(req);
        req.realIp = realIp;
        exports.clsNamespace.run(() => {
            exports.clsNamespace.set('traceID', traceId);
            next();
            // 记录日志 (包含 traceId)
            // 注意：getReqMainInfo 期望 FastifyRequest/FastifyReply，但中间件中是原生对象
            // 使用类型断言以兼容现有函数
            if (enviroment_util_1.default.isProduction()) {
                this.logger.info('RequestMiddleware', {
                    traceId,
                    ...(0, logger_util_1.getReqMainInfo)(req, res),
                });
            }
        });
    }
};
RequestMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [winston_1.Logger])
], RequestMiddleware);
exports.default = RequestMiddleware;
//# sourceMappingURL=request.middleware.js.map