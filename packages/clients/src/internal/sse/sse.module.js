"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SseModule = void 0;
/**
 * SSE Client Module
 *
 * 纯 Client 模块 - Server-Sent Events 客户端服务
 * 仅使用 Redis 进行消息传递，不依赖数据库
 */
const common_1 = require("@nestjs/common");
const sse_client_1 = require("./sse.client");
const redis_1 = require("../../../../redis/src");
const config_1 = require("@nestjs/config");
let SseModule = class SseModule {
};
exports.SseModule = SseModule;
exports.SseModule = SseModule = __decorate([
    (0, common_1.Module)({
        imports: [redis_1.RedisModule, config_1.ConfigModule],
        providers: [sse_client_1.SseClient],
        exports: [sse_client_1.SseClient],
    })
], SseModule);
//# sourceMappingURL=sse.module.js.map