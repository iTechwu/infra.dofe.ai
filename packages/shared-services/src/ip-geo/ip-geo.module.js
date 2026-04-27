"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpGeoModule = void 0;
/**
 * @fileoverview IP 地理位置服务模块（Infra 层）
 *
 * @module ip-geo/module
 */
const common_1 = require("@nestjs/common");
const redis_1 = require("../../../redis/src");
const ip_info_1 = require("../../../clients/src/internal/ip-info");
const ip_geo_service_1 = require("./ip-geo.service");
/**
 * IP 地理位置服务模块
 *
 * @description 提供纯 infra 层的 IP 地理位置服务，不依赖 domain 层。
 */
let IpGeoModule = class IpGeoModule {
};
exports.IpGeoModule = IpGeoModule;
exports.IpGeoModule = IpGeoModule = __decorate([
    (0, common_1.Module)({
        imports: [redis_1.RedisModule, ip_info_1.IpInfoClientModule],
        providers: [ip_geo_service_1.IpGeoService],
        exports: [ip_geo_service_1.IpGeoService],
    })
], IpGeoModule);
//# sourceMappingURL=ip-geo.module.js.map