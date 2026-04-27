"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyModule = void 0;
const common_1 = require("@nestjs/common");
const verify_client_1 = require("./verify.client");
const redis_1 = require("../../../../redis/src");
let VerifyModule = class VerifyModule {
};
exports.VerifyModule = VerifyModule;
exports.VerifyModule = VerifyModule = __decorate([
    (0, common_1.Module)({
        imports: [redis_1.RedisModule],
        providers: [verify_client_1.VerifyClient],
        exports: [verify_client_1.VerifyClient],
    })
], VerifyModule);
//# sourceMappingURL=verify.module.js.map