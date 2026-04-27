"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COUNTRY_TO_CONTINENT = exports.CONTINENT_COUNTRIES = exports.getContinentByCountry = exports.IpGeoService = exports.IpGeoModule = void 0;
/**
 * @fileoverview IP 地理位置服务导出入口（Infra 层）
 *
 * 本模块提供纯 infra 层的 IP 地理位置服务：
 * - IpGeoService: IP 地理位置查询服务
 * - IpGeoModule: NestJS 模块
 * - getContinentByCountry: 静态大洲映射函数
 *
 * @example
 * ```typescript
 * import { IpGeoModule, IpGeoService } from '@app/shared-services/ip-geo';
 *
 * @Module({
 *   imports: [IpGeoModule],
 * })
 * export class MyModule {}
 *
 * @Injectable()
 * class MyService {
 *   constructor(private readonly ipGeo: IpGeoService) {}
 *
 *   async getRegion(ip: string) {
 *     return await this.ipGeo.getContinent(ip);
 *   }
 * }
 * ```
 *
 * @module ip-geo
 */
var ip_geo_module_1 = require("./ip-geo.module");
Object.defineProperty(exports, "IpGeoModule", { enumerable: true, get: function () { return ip_geo_module_1.IpGeoModule; } });
var ip_geo_service_1 = require("./ip-geo.service");
Object.defineProperty(exports, "IpGeoService", { enumerable: true, get: function () { return ip_geo_service_1.IpGeoService; } });
var continent_mapping_1 = require("./continent-mapping");
Object.defineProperty(exports, "getContinentByCountry", { enumerable: true, get: function () { return continent_mapping_1.getContinentByCountry; } });
Object.defineProperty(exports, "CONTINENT_COUNTRIES", { enumerable: true, get: function () { return continent_mapping_1.CONTINENT_COUNTRIES; } });
Object.defineProperty(exports, "COUNTRY_TO_CONTINENT", { enumerable: true, get: function () { return continent_mapping_1.COUNTRY_TO_CONTINENT; } });
//# sourceMappingURL=index.js.map