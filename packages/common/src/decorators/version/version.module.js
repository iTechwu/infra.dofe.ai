"use strict";
/**
 * Version Decorator Module
 *
 * 提供 API 版本控制功能的全局模块。
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionDecoratorModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const version_interceptor_1 = require("./version.interceptor");
let VersionDecoratorModule = class VersionDecoratorModule {
};
exports.VersionDecoratorModule = VersionDecoratorModule;
exports.VersionDecoratorModule = VersionDecoratorModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: version_interceptor_1.VersionInterceptor,
            },
        ],
        exports: [],
    })
], VersionDecoratorModule);
//# sourceMappingURL=version.module.js.map