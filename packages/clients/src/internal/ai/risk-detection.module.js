"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskDetectionModule = void 0;
/**
 * 风险检测 Internal Client 模块
 */
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const nest_winston_1 = require("nest-winston");
const risk_detection_client_1 = require("./risk-detection.client");
let RiskDetectionModule = class RiskDetectionModule {
};
exports.RiskDetectionModule = RiskDetectionModule;
exports.RiskDetectionModule = RiskDetectionModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            nest_winston_1.WinstonModule,
            axios_1.HttpModule.register({
                timeout: 10000,
                maxRedirects: 5,
            }),
        ],
        providers: [risk_detection_client_1.RiskDetectionClient],
        exports: [risk_detection_client_1.RiskDetectionClient],
    })
], RiskDetectionModule);
//# sourceMappingURL=risk-detection.module.js.map