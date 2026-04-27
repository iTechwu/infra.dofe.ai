"use strict";
/**
 * Prisma Error Handler Utility
 * 统一处理 Prisma 数据库操作错误
 *
 * 使用四种错误码区分操作类型：
 * - DbCreateError: 创建操作失败
 * - DbUpdateError: 更新操作失败
 * - DbDeleteError: 删除操作失败
 * - DbQueryError: 查询操作失败
 *
 * 具体错误详情通过 ApiException 的 data 字段返回
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaErrorHandler = exports.PrismaErrorType = exports.DbOperationType = void 0;
exports.HandlePrismaError = HandlePrismaError;
const client_1 = require("@prisma/client");
const errors_1 = require("@repo/contracts/errors");
const api_exception_1 = require("./filter/exception/api.exception");
/**
 * 数据库操作类型
 */
var DbOperationType;
(function (DbOperationType) {
    DbOperationType["CREATE"] = "create";
    DbOperationType["UPDATE"] = "update";
    DbOperationType["DELETE"] = "delete";
    DbOperationType["QUERY"] = "query";
})(DbOperationType || (exports.DbOperationType = DbOperationType = {}));
/**
 * Prisma 错误类型枚举
 */
var PrismaErrorType;
(function (PrismaErrorType) {
    // 已知请求错误
    PrismaErrorType["UNIQUE_CONSTRAINT"] = "UNIQUE_CONSTRAINT";
    PrismaErrorType["FOREIGN_KEY_CONSTRAINT"] = "FOREIGN_KEY_CONSTRAINT";
    PrismaErrorType["CONSTRAINT_FAILED"] = "CONSTRAINT_FAILED";
    PrismaErrorType["RECORD_NOT_FOUND"] = "RECORD_NOT_FOUND";
    PrismaErrorType["REQUIRED_RELATION_VIOLATION"] = "REQUIRED_RELATION_VIOLATION";
    PrismaErrorType["RELATED_RECORD_NOT_FOUND"] = "RELATED_RECORD_NOT_FOUND";
    PrismaErrorType["QUERY_INTERPRETATION_ERROR"] = "QUERY_INTERPRETATION_ERROR";
    PrismaErrorType["RECORDS_NOT_CONNECTED"] = "RECORDS_NOT_CONNECTED";
    PrismaErrorType["REQUIRED_CONNECTED_RECORDS_NOT_FOUND"] = "REQUIRED_CONNECTED_RECORDS_NOT_FOUND";
    PrismaErrorType["INPUT_ERROR"] = "INPUT_ERROR";
    PrismaErrorType["VALUE_TOO_LONG"] = "VALUE_TOO_LONG";
    PrismaErrorType["NULL_CONSTRAINT"] = "NULL_CONSTRAINT";
    PrismaErrorType["MISSING_REQUIRED_VALUE"] = "MISSING_REQUIRED_VALUE";
    PrismaErrorType["TRANSACTION_CONFLICT"] = "TRANSACTION_CONFLICT";
    PrismaErrorType["TRANSACTION_API_ERROR"] = "TRANSACTION_API_ERROR";
    // 初始化错误
    PrismaErrorType["CONNECTION_ERROR"] = "CONNECTION_ERROR";
    // 验证错误
    PrismaErrorType["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    // 未知错误
    PrismaErrorType["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(PrismaErrorType || (exports.PrismaErrorType = PrismaErrorType = {}));
/**
 * 操作类型到错误码的映射
 */
const OPERATION_ERROR_CODE_MAP = {
    [DbOperationType.CREATE]: errors_1.CommonErrorCode.DbCreateError,
    [DbOperationType.UPDATE]: errors_1.CommonErrorCode.DbUpdateError,
    [DbOperationType.DELETE]: errors_1.CommonErrorCode.DbDeleteError,
    [DbOperationType.QUERY]: errors_1.CommonErrorCode.DbQueryError,
};
/**
 * Prisma 错误码到错误类型的映射
 */
const PRISMA_ERROR_CODE_MAP = {
    P2000: PrismaErrorType.VALUE_TOO_LONG,
    P2002: PrismaErrorType.UNIQUE_CONSTRAINT,
    P2003: PrismaErrorType.FOREIGN_KEY_CONSTRAINT,
    P2004: PrismaErrorType.CONSTRAINT_FAILED,
    P2011: PrismaErrorType.NULL_CONSTRAINT,
    P2012: PrismaErrorType.MISSING_REQUIRED_VALUE,
    P2014: PrismaErrorType.REQUIRED_RELATION_VIOLATION,
    P2015: PrismaErrorType.RELATED_RECORD_NOT_FOUND,
    P2016: PrismaErrorType.QUERY_INTERPRETATION_ERROR,
    P2017: PrismaErrorType.RECORDS_NOT_CONNECTED,
    P2018: PrismaErrorType.REQUIRED_CONNECTED_RECORDS_NOT_FOUND,
    P2019: PrismaErrorType.INPUT_ERROR,
    P2025: PrismaErrorType.RECORD_NOT_FOUND,
    P2028: PrismaErrorType.TRANSACTION_API_ERROR,
    P2034: PrismaErrorType.TRANSACTION_CONFLICT,
};
/**
 * 错误类型描述映射
 */
const ERROR_TYPE_DESCRIPTION_MAP = {
    [PrismaErrorType.UNIQUE_CONSTRAINT]: '数据已存在，违反唯一约束',
    [PrismaErrorType.FOREIGN_KEY_CONSTRAINT]: '外键约束失败，关联数据不存在',
    [PrismaErrorType.CONSTRAINT_FAILED]: '数据库约束检查失败',
    [PrismaErrorType.RECORD_NOT_FOUND]: '记录不存在',
    [PrismaErrorType.REQUIRED_RELATION_VIOLATION]: '必需的关联关系违规',
    [PrismaErrorType.RELATED_RECORD_NOT_FOUND]: '关联记录不存在',
    [PrismaErrorType.QUERY_INTERPRETATION_ERROR]: '查询解释错误',
    [PrismaErrorType.RECORDS_NOT_CONNECTED]: '记录未建立连接',
    [PrismaErrorType.REQUIRED_CONNECTED_RECORDS_NOT_FOUND]: '必需的连接记录不存在',
    [PrismaErrorType.INPUT_ERROR]: '输入数据错误',
    [PrismaErrorType.VALUE_TOO_LONG]: '字段值超出长度限制',
    [PrismaErrorType.NULL_CONSTRAINT]: '字段不能为空',
    [PrismaErrorType.MISSING_REQUIRED_VALUE]: '缺少必需的字段值',
    [PrismaErrorType.TRANSACTION_CONFLICT]: '事务冲突或死锁，请重试',
    [PrismaErrorType.TRANSACTION_API_ERROR]: '事务执行错误',
    [PrismaErrorType.CONNECTION_ERROR]: '数据库连接错误',
    [PrismaErrorType.VALIDATION_ERROR]: '查询参数验证错误',
    [PrismaErrorType.UNKNOWN_ERROR]: '未知数据库错误',
};
/**
 * Prisma 错误处理器
 *
 * @example
 * ```typescript
 * // 在 Service 中使用
 * async createUser(data: CreateUserInput) {
 *   try {
 *     return await this.prisma.write.user.create({ data });
 *   } catch (error) {
 *     PrismaErrorHandler.handle(error, DbOperationType.CREATE);
 *   }
 * }
 *
 * // 使用便捷方法
 * async updateUser(id: string, data: UpdateUserInput) {
 *   try {
 *     return await this.prisma.write.user.update({ where: { id }, data });
 *   } catch (error) {
 *     PrismaErrorHandler.handleUpdate(error);
 *   }
 * }
 * ```
 */
class PrismaErrorHandler {
    /**
     * 处理 Prisma 错误并抛出 ApiException
     * @param error 原始错误
     * @param operationType 操作类型
     * @throws ApiException
     */
    static handle(error, operationType) {
        const errorDetail = this.parseError(error);
        const errorCode = OPERATION_ERROR_CODE_MAP[operationType];
        throw (0, api_exception_1.apiError)(errorCode, errorDetail);
    }
    /**
     * 处理创建操作错误
     */
    static handleCreate(error) {
        return this.handle(error, DbOperationType.CREATE);
    }
    /**
     * 处理更新操作错误
     */
    static handleUpdate(error) {
        return this.handle(error, DbOperationType.UPDATE);
    }
    /**
     * 处理删除操作错误
     */
    static handleDelete(error) {
        return this.handle(error, DbOperationType.DELETE);
    }
    /**
     * 处理查询操作错误
     */
    static handleQuery(error) {
        return this.handle(error, DbOperationType.QUERY);
    }
    /**
     * 解析 Prisma 错误，提取详细信息
     */
    static parseError(error) {
        // 处理 Prisma 已知请求错误
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            return this.parseKnownRequestError(error);
        }
        // 处理 Prisma 验证错误
        if (error instanceof client_1.Prisma.PrismaClientValidationError) {
            const validationError = error;
            return {
                type: PrismaErrorType.VALIDATION_ERROR,
                description: ERROR_TYPE_DESCRIPTION_MAP[PrismaErrorType.VALIDATION_ERROR],
                originalMessage: validationError.message,
            };
        }
        // 处理 Prisma 初始化/连接错误
        if (error instanceof client_1.Prisma.PrismaClientInitializationError) {
            const initError = error;
            return {
                type: PrismaErrorType.CONNECTION_ERROR,
                description: ERROR_TYPE_DESCRIPTION_MAP[PrismaErrorType.CONNECTION_ERROR],
                originalMessage: initError.message,
            };
        }
        // 处理未知错误
        const originalMessage = error instanceof Error ? error.message : String(error);
        return {
            type: PrismaErrorType.UNKNOWN_ERROR,
            description: ERROR_TYPE_DESCRIPTION_MAP[PrismaErrorType.UNKNOWN_ERROR],
            originalMessage,
        };
    }
    /**
     * 解析 Prisma 已知请求错误
     */
    static parseKnownRequestError(error) {
        const errorType = PRISMA_ERROR_CODE_MAP[error.code] || PrismaErrorType.UNKNOWN_ERROR;
        const meta = error.meta;
        const detail = {
            type: errorType,
            prismaCode: error.code,
            description: ERROR_TYPE_DESCRIPTION_MAP[errorType],
            originalMessage: error.message,
        };
        // 提取 meta 信息
        if (meta) {
            // 模型名称
            if (typeof meta.modelName === 'string') {
                detail.model = meta.modelName;
            }
            // 目标字段（用于唯一约束等）
            if (meta.target) {
                detail.target = meta.target;
                if (Array.isArray(meta.target)) {
                    detail.fields = meta.target;
                }
            }
            // 字段名
            if (Array.isArray(meta.field_name)) {
                detail.fields = meta.field_name;
            }
            else if (typeof meta.field_name === 'string') {
                detail.fields = [meta.field_name];
            }
            // cause 信息（P2025 特有）
            if (typeof meta.cause === 'string') {
                detail.description = `${detail.description}: ${meta.cause}`;
            }
        }
        return detail;
    }
    /**
     * 判断错误是否为 Prisma 错误
     */
    static isPrismaError(error) {
        return (error instanceof client_1.Prisma.PrismaClientKnownRequestError ||
            error instanceof client_1.Prisma.PrismaClientValidationError ||
            error instanceof client_1.Prisma.PrismaClientInitializationError ||
            error instanceof client_1.Prisma.PrismaClientRustPanicError ||
            error instanceof client_1.Prisma.PrismaClientUnknownRequestError);
    }
    /**
     * 判断是否为可重试的错误（事务冲突/死锁）
     */
    static isRetryableError(error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            const prismaError = error;
            // P2034: 写冲突或死锁
            // P2028: 事务 API 错误
            return ['P2034', 'P2028'].includes(prismaError.code);
        }
        return false;
    }
    /**
     * 判断是否为唯一约束冲突错误
     */
    static isUniqueConstraintError(error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            const prismaError = error;
            return prismaError.code === 'P2002';
        }
        return false;
    }
    /**
     * 判断是否为记录不存在错误
     */
    static isRecordNotFoundError(error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            const prismaError = error;
            return prismaError.code === 'P2025';
        }
        return false;
    }
    /**
     * 判断是否为外键约束错误
     */
    static isForeignKeyError(error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            const prismaError = error;
            return prismaError.code === 'P2003';
        }
        return false;
    }
    /**
     * 获取唯一约束冲突的字段名
     */
    static getUniqueConstraintFields(error) {
        if (!this.isUniqueConstraintError(error)) {
            return null;
        }
        const prismaError = error;
        const meta = prismaError.meta;
        if (meta?.target && Array.isArray(meta.target)) {
            return meta.target;
        }
        return null;
    }
}
exports.PrismaErrorHandler = PrismaErrorHandler;
/**
 * 便捷的错误处理装饰器工厂函数
 * 用于自动捕获并处理 Prisma 错误
 *
 * @example
 * ```typescript
 * class UserService {
 *   @HandlePrismaError(DbOperationType.CREATE)
 *   async createUser(data: CreateUserInput) {
 *     return await this.prisma.write.user.create({ data });
 *   }
 * }
 * ```
 */
function HandlePrismaError(operationType) {
    return function (_target, _propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            try {
                return await originalMethod.apply(this, args);
            }
            catch (error) {
                if (PrismaErrorHandler.isPrismaError(error)) {
                    PrismaErrorHandler.handle(error, operationType);
                }
                throw error;
            }
        };
        return descriptor;
    };
}
//# sourceMappingURL=prisma-error.util.js.map