"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponse = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const response_1 = require("../../../utils/dist/response");
const baseTypeNames = ['String', 'Number', 'Boolean'];
/**
 * 封装 swagger 返回统一结构
 * 支持复杂类型 { code, msg, data }
 * @param model 返回的 data 的数据类型
 * @param isArray data 是否是数组
 * @param isPager 设置为 true, 则 data 类型为 { list, total } , false data 类型是纯数组
 */
const ApiResponse = (model, isArray, isPager) => {
    const modelIsBaseType = model && baseTypeNames.includes(model.name);
    const items = modelIsBaseType
        ? { type: model.name.toLocaleLowerCase() }
        : model
            ? { $ref: (0, swagger_1.getSchemaPath)(model) }
            : null;
    const prop = isArray && isPager
        ? {
            type: 'object',
            properties: {
                list: {
                    type: 'array',
                    items,
                },
                total: {
                    type: 'number',
                    default: 0,
                },
            },
        }
        : isArray
            ? {
                type: 'array',
                items,
            }
            : items
                ? items
                : { type: 'null', default: null };
    return (0, common_1.applyDecorators)((0, swagger_1.ApiExtraModels)(...(model && !modelIsBaseType ? [response_1.Response, model] : [response_1.Response])), (0, swagger_1.ApiOkResponse)({
        schema: {
            allOf: [
                { $ref: (0, swagger_1.getSchemaPath)(response_1.Response) },
                {
                    properties: {
                        data: prop,
                    },
                },
            ],
        },
    }));
};
exports.ApiResponse = ApiResponse;
//# sourceMappingURL=response.decorator.js.map