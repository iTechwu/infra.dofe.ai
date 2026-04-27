"use strict";
/**
 * App Version Module
 *
 * 提供应用版本管理和前后端版本一致性检查。
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppVersionModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const app_version_service_1 = require("./app-version.service");
const app_version_controller_1 = require("./app-version.controller");
const app_version_interceptor_1 = require("./app-version.interceptor");
let AppVersionModule = class AppVersionModule {
};
exports.AppVersionModule = AppVersionModule;
exports.AppVersionModule = AppVersionModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        controllers: [app_version_controller_1.AppVersionController],
        providers: [
            app_version_service_1.AppVersionService,
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: app_version_interceptor_1.AppVersionInterceptor,
            },
        ],
        exports: [app_version_service_1.AppVersionService],
    })
], AppVersionModule);
//# sourceMappingURL=app-version.module.js.map