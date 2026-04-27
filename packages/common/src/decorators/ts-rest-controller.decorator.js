"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TsRestController = TsRestController;
const common_1 = require("@nestjs/common");
const constants_1 = require("@nestjs/common/constants");
function TsRestController(prefixOrOptions) {
    return (target) => {
        if (prefixOrOptions === undefined) {
            // @TsRestController()
            (0, common_1.Controller)()(target);
        }
        else if (typeof prefixOrOptions === 'string' ||
            Array.isArray(prefixOrOptions)) {
            // @TsRestController('path') 或 @TsRestController(['path1', 'path2'])
            (0, common_1.Controller)(prefixOrOptions)(target);
        }
        else {
            // @TsRestController({ path: 'admin', host: '...' })
            (0, common_1.Controller)(prefixOrOptions)(target);
        }
        // 设置 VERSION_NEUTRAL，让 NestJS 放行，由 ts-rest 处理路由
        Reflect.defineMetadata(constants_1.VERSION_METADATA, common_1.VERSION_NEUTRAL, target);
    };
}
//# sourceMappingURL=ts-rest-controller.decorator.js.map