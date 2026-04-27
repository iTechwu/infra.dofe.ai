"use strict";
/**
 * @fileoverview 流式语音识别服务模块
 *
 * 本模块提供流式语音识别服务的 NestJS 模块配置。
 *
 * @module streaming-asr/module
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamingAsrServiceModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_module_1 = require("../../../jwt/src/jwt.module");
const redis_1 = require("../../../redis/src");
const streaming_asr_service_1 = require("./streaming-asr.service");
/**
 * 流式语音识别服务模块
 *
 * @description 提供流式语音识别服务的依赖注入配置。
 *
 * 导出服务：
 * - `StreamingAsrService`: 流式语音识别服务
 *
 * 依赖模块：
 * - `ConfigModule`: 配置服务
 * - `MeetingServiceModule`: 会议服务（用于保存转写结果）
 *
 * @example
 * ```typescript
 * // 在其他模块中导入
 * @Module({
 *   imports: [StreamingAsrServiceModule],
 * })
 * export class StreamingAsrApiModule {}
 *
 * // 在服务中使用
 * @Injectable()
 * class StreamingAsrController {
 *   constructor(private readonly streamingAsr: StreamingAsrService) {}
 * }
 * ```
 */
let StreamingAsrServiceModule = class StreamingAsrServiceModule {
};
exports.StreamingAsrServiceModule = StreamingAsrServiceModule;
exports.StreamingAsrServiceModule = StreamingAsrServiceModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, jwt_module_1.JwtModule, redis_1.RedisModule],
        providers: [streaming_asr_service_1.StreamingAsrService],
        exports: [streaming_asr_service_1.StreamingAsrService],
    })
], StreamingAsrServiceModule);
//# sourceMappingURL=streaming-asr.module.js.map