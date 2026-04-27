"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailServiceModule = void 0;
/**
 * Email Service Module
 *
 * 职责：提供邮件发送的业务逻辑服务
 */
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const redis_1 = require("../../../redis/src");
const rabbitmq_1 = require("../../../rabbitmq/src");
const verify_1 = require("../../../clients/src/internal/verify");
const email_service_1 = require("./email.service");
let EmailServiceModule = class EmailServiceModule {
};
exports.EmailServiceModule = EmailServiceModule;
exports.EmailServiceModule = EmailServiceModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            axios_1.HttpModule,
            redis_1.RedisModule,
            rabbitmq_1.RabbitmqModule,
            verify_1.VerifyModule,
        ],
        providers: [email_service_1.EmailService],
        exports: [email_service_1.EmailService],
    })
], EmailServiceModule);
//# sourceMappingURL=email.module.js.map