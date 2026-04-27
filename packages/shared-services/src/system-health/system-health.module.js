"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemHealthModule = void 0;
const common_1 = require("@nestjs/common");
const system_health_service_1 = require("./system-health.service");
const system_health_controller_1 = require("./system-health.controller");
const config_1 = require("@nestjs/config");
// eslint-disable-next-line import/no-restricted-paths -- 健康检查服务需要直接访问 Prisma 检查数据库连接状态
const prisma_1 = require("../../../prisma/src/prisma");
const redis_1 = require("../../../redis/src");
const rabbitmq_1 = require("../../../rabbitmq/src");
let SystemHealthModule = class SystemHealthModule {
};
exports.SystemHealthModule = SystemHealthModule;
exports.SystemHealthModule = SystemHealthModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, prisma_1.PrismaModule, redis_1.RedisModule, rabbitmq_1.RabbitmqModule],
        controllers: [system_health_controller_1.SystemHealthController],
        providers: [system_health_service_1.SystemHealthService],
        exports: [system_health_service_1.SystemHealthService],
    })
], SystemHealthModule);
//# sourceMappingURL=system-health.module.js.map