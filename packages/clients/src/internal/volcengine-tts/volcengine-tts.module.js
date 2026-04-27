"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VolcengineTtsModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const nest_winston_1 = require("nest-winston");
const file_storage_1 = require("../../../../shared-services/src/file-storage");
const volcengine_tts_client_1 = require("./volcengine-tts.client");
let VolcengineTtsModule = class VolcengineTtsModule {
};
exports.VolcengineTtsModule = VolcengineTtsModule;
exports.VolcengineTtsModule = VolcengineTtsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            nest_winston_1.WinstonModule,
            file_storage_1.FileStorageServiceModule,
            axios_1.HttpModule.register({
                timeout: 30000, // 30秒超时
                maxRedirects: 5,
            }),
        ],
        providers: [volcengine_tts_client_1.VolcengineTtsClient],
        exports: [volcengine_tts_client_1.VolcengineTtsClient],
    })
], VolcengineTtsModule);
//# sourceMappingURL=volcengine-tts.module.js.map