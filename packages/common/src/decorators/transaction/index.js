"use strict";
/**
 * Transaction Decorators Export
 * 事务装饰器导出
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactionClient = exports.TransactionalService = exports.Transactional = void 0;
var transactional_decorator_1 = require("./transactional.decorator");
Object.defineProperty(exports, "Transactional", { enumerable: true, get: function () { return transactional_decorator_1.Transactional; } });
Object.defineProperty(exports, "TransactionalService", { enumerable: true, get: function () { return transactional_decorator_1.TransactionalService; } });
Object.defineProperty(exports, "getTransactionClient", { enumerable: true, get: function () { return transactional_decorator_1.getTransactionClient; } });
//# sourceMappingURL=index.js.map