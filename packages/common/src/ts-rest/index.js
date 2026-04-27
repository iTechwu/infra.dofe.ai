"use strict";
/**
 * ts-rest Utilities Export
 * ts-rest 工具导出
 *
 * 提供标准化的响应辅助函数：
 * - success(data) - 成功响应
 * - created(data) - 创建成功响应 (201)
 * - deleted() - 删除成功响应
 * - paginated(list, total, page, limit) - 分页响应
 * - error(errorCode) - 错误码响应
 * - errorFromType(type, code, status) - 错误类型响应
 * - errorSimple(code, msg) - 简单错误响应
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeDates = exports.errorSimple = exports.errorFromType = exports.error = exports.paginated = exports.deletedWithData = exports.deleted = exports.created = exports.success = void 0;
var response_helper_1 = require("./response.helper");
Object.defineProperty(exports, "success", { enumerable: true, get: function () { return response_helper_1.success; } });
Object.defineProperty(exports, "created", { enumerable: true, get: function () { return response_helper_1.created; } });
Object.defineProperty(exports, "deleted", { enumerable: true, get: function () { return response_helper_1.deleted; } });
Object.defineProperty(exports, "deletedWithData", { enumerable: true, get: function () { return response_helper_1.deletedWithData; } });
Object.defineProperty(exports, "paginated", { enumerable: true, get: function () { return response_helper_1.paginated; } });
Object.defineProperty(exports, "error", { enumerable: true, get: function () { return response_helper_1.error; } });
Object.defineProperty(exports, "errorFromType", { enumerable: true, get: function () { return response_helper_1.errorFromType; } });
Object.defineProperty(exports, "errorSimple", { enumerable: true, get: function () { return response_helper_1.errorSimple; } });
Object.defineProperty(exports, "serializeDates", { enumerable: true, get: function () { return response_helper_1.serializeDates; } });
//# sourceMappingURL=index.js.map