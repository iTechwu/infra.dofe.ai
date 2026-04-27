"use strict";
/**
 * Transaction Module
 * 事务模块导出
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionalServiceBase = exports.isInTransaction = exports.runInTransactionContext = exports.getTransactionClient = exports.UnitOfWorkService = exports.TransactionModule = void 0;
var transaction_module_1 = require("./transaction.module");
Object.defineProperty(exports, "TransactionModule", { enumerable: true, get: function () { return transaction_module_1.TransactionModule; } });
var unit_of_work_service_1 = require("./unit-of-work.service");
Object.defineProperty(exports, "UnitOfWorkService", { enumerable: true, get: function () { return unit_of_work_service_1.UnitOfWorkService; } });
var transaction_context_1 = require("./transaction-context");
Object.defineProperty(exports, "getTransactionClient", { enumerable: true, get: function () { return transaction_context_1.getTransactionClient; } });
Object.defineProperty(exports, "runInTransactionContext", { enumerable: true, get: function () { return transaction_context_1.runInTransactionContext; } });
Object.defineProperty(exports, "isInTransaction", { enumerable: true, get: function () { return transaction_context_1.isInTransaction; } });
var transactional_service_base_1 = require("./transactional-service.base");
Object.defineProperty(exports, "TransactionalServiceBase", { enumerable: true, get: function () { return transactional_service_base_1.TransactionalServiceBase; } });
//# sourceMappingURL=index.js.map