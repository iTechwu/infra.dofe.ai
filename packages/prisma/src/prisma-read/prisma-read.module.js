"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaReadModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const db_metrics_module_1 = require("../db-metrics/src/db-metrics.module");
const prisma_read_service_1 = require("./prisma-read.service");
let PrismaReadModule = class PrismaReadModule {
};
exports.PrismaReadModule = PrismaReadModule;
exports.PrismaReadModule = PrismaReadModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, db_metrics_module_1.DbMetricsModule],
        providers: [prisma_read_service_1.PrismaReadService],
        exports: [prisma_read_service_1.PrismaReadService],
    })
], PrismaReadModule);
//# sourceMappingURL=prisma-read.module.js.map