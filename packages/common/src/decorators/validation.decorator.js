"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LengthValidator = LengthValidator;
exports.IsDateFormat = IsDateFormat;
exports.IsUUIDFormat = IsUUIDFormat;
const class_validator_1 = require("class-validator");
const api_exception_1 = require("../filter/exception/api.exception");
const error_codes_1 = require("../enums/error-codes");
const string_util_1 = __importDefault(require("../../../utils/dist/string.util"));
// 自定义装饰器
function LengthValidator(min, max, errorTypeMin, errorTypeMax, field = '', validateErrorType = 'invalidParameters') {
    return function (object, propertyName) {
        const errorMin = error_codes_1.ErrorMessageEnums[errorTypeMin];
        const errorMax = error_codes_1.ErrorMessageEnums[errorTypeMax];
        (0, class_validator_1.registerDecorator)({
            name: 'LengthValidator',
            target: object.constructor,
            propertyName: propertyName,
            constraints: [min, max, errorMin.errorCode, errorMax.errorCode],
            options: {
                message: (args) => {
                    if (typeof args.value !== 'string')
                        return `类型必须为字符串`;
                    if (args.value.length < min)
                        return errorMin.message;
                    if (args.value.length > max)
                        return errorMax.message;
                    return '';
                },
            },
            validator: {
                validate(value, args) {
                    const [min, max] = args.constraints;
                    if (typeof value !== 'string') {
                        throw new api_exception_1.ApiException(validateErrorType, { field });
                    }
                    if (value.length < min) {
                        throw new api_exception_1.ApiException(errorTypeMin, { field });
                    }
                    else if (value.length > max) {
                        throw new api_exception_1.ApiException(errorTypeMax, { field });
                    }
                    return true;
                },
            },
        });
    };
}
// 自定义装饰器
function IsDateFormat(field, canbeNull = true, errorType = 'invalidParameters') {
    return function (object, propertyName) {
        const error = error_codes_1.ErrorMessageEnums[errorType];
        (0, class_validator_1.registerDecorator)({
            name: 'IsDateFormat',
            target: object.constructor,
            propertyName: propertyName,
            options: {
                message: (args) => {
                    if (typeof args.value !== 'string')
                        return `类型必须为字符串格式`;
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.value))
                        return error.message;
                    return '';
                },
            },
            validator: {
                validate(value) {
                    if (!value && canbeNull)
                        return true;
                    if (typeof value !== 'string') {
                        throw new api_exception_1.ApiException(errorType, { field });
                    }
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                        throw new api_exception_1.ApiException(errorType, { field });
                    }
                    return true;
                },
            },
        });
    };
}
// 自定义装饰器
function IsUUIDFormat(field, canbeNull = true, errorType = 'invalidParameters') {
    return function (object, propertyName) {
        const error = error_codes_1.ErrorMessageEnums[errorType];
        (0, class_validator_1.registerDecorator)({
            name: 'IsUUIDFormat',
            target: object.constructor,
            propertyName: propertyName,
            options: {
                message: (args) => {
                    if (typeof args.value !== 'string')
                        return `类型必须为字符串格式`;
                    if (!string_util_1.default.isUUID(args.value))
                        return error.message;
                    return '';
                },
            },
            validator: {
                validate(value) {
                    if (['folderId', 'parentId'].includes(field) && value == 'root') {
                        value = null;
                    }
                    if (!value && canbeNull)
                        return true;
                    if (typeof value !== 'string') {
                        throw new api_exception_1.ApiException(errorType, { field });
                    }
                    if (!string_util_1.default.isUUID(value)) {
                        throw new api_exception_1.ApiException(errorType, { field });
                    }
                    return true;
                },
            },
        });
    };
}
//# sourceMappingURL=validation.decorator.js.map