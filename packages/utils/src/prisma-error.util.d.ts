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
/**
 * 数据库操作类型
 */
export declare enum DbOperationType {
    CREATE = "create",
    UPDATE = "update",
    DELETE = "delete",
    QUERY = "query"
}
/**
 * Prisma 错误类型枚举
 */
export declare enum PrismaErrorType {
    UNIQUE_CONSTRAINT = "UNIQUE_CONSTRAINT",// P2002 - 唯一约束冲突
    FOREIGN_KEY_CONSTRAINT = "FOREIGN_KEY_CONSTRAINT",// P2003 - 外键约束失败
    CONSTRAINT_FAILED = "CONSTRAINT_FAILED",// P2004 - 约束失败
    RECORD_NOT_FOUND = "RECORD_NOT_FOUND",// P2025 - 记录不存在
    REQUIRED_RELATION_VIOLATION = "REQUIRED_RELATION_VIOLATION",// P2014 - 必需关系违规
    RELATED_RECORD_NOT_FOUND = "RELATED_RECORD_NOT_FOUND",// P2015 - 关联记录不存在
    QUERY_INTERPRETATION_ERROR = "QUERY_INTERPRETATION_ERROR",// P2016 - 查询解释错误
    RECORDS_NOT_CONNECTED = "RECORDS_NOT_CONNECTED",// P2017 - 记录未连接
    REQUIRED_CONNECTED_RECORDS_NOT_FOUND = "REQUIRED_CONNECTED_RECORDS_NOT_FOUND",// P2018 - 必需连接记录不存在
    INPUT_ERROR = "INPUT_ERROR",// P2019 - 输入错误
    VALUE_TOO_LONG = "VALUE_TOO_LONG",// P2000 - 值过长
    NULL_CONSTRAINT = "NULL_CONSTRAINT",// P2011 - 非空约束违规
    MISSING_REQUIRED_VALUE = "MISSING_REQUIRED_VALUE",// P2012 - 缺少必需值
    TRANSACTION_CONFLICT = "TRANSACTION_CONFLICT",// P2034 - 事务写冲突/死锁
    TRANSACTION_API_ERROR = "TRANSACTION_API_ERROR",// P2028 - 事务 API 错误
    CONNECTION_ERROR = "CONNECTION_ERROR",// 数据库连接错误
    VALIDATION_ERROR = "VALIDATION_ERROR",// 查询验证错误
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
}
/**
 * Prisma 错误详情接口
 */
export interface PrismaErrorDetail {
    /** 错误类型 */
    type: PrismaErrorType;
    /** 原始 Prisma 错误码 */
    prismaCode?: string;
    /** 错误描述 */
    description: string;
    /** 相关字段（如唯一约束冲突时的字段名） */
    fields?: string[];
    /** 相关模型名 */
    model?: string;
    /** 目标对象（用于约束错误） */
    target?: string | string[];
    /** 原始错误消息 */
    originalMessage?: string;
}
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
export declare class PrismaErrorHandler {
    /**
     * 处理 Prisma 错误并抛出 ApiException
     * @param error 原始错误
     * @param operationType 操作类型
     * @throws ApiException
     */
    static handle(error: unknown, operationType: DbOperationType): never;
    /**
     * 处理创建操作错误
     */
    static handleCreate(error: unknown): never;
    /**
     * 处理更新操作错误
     */
    static handleUpdate(error: unknown): never;
    /**
     * 处理删除操作错误
     */
    static handleDelete(error: unknown): never;
    /**
     * 处理查询操作错误
     */
    static handleQuery(error: unknown): never;
    /**
     * 解析 Prisma 错误，提取详细信息
     */
    static parseError(error: unknown): PrismaErrorDetail;
    /**
     * 解析 Prisma 已知请求错误
     */
    private static parseKnownRequestError;
    /**
     * 判断错误是否为 Prisma 错误
     */
    static isPrismaError(error: unknown): boolean;
    /**
     * 判断是否为可重试的错误（事务冲突/死锁）
     */
    static isRetryableError(error: unknown): boolean;
    /**
     * 判断是否为唯一约束冲突错误
     */
    static isUniqueConstraintError(error: unknown): boolean;
    /**
     * 判断是否为记录不存在错误
     */
    static isRecordNotFoundError(error: unknown): boolean;
    /**
     * 判断是否为外键约束错误
     */
    static isForeignKeyError(error: unknown): boolean;
    /**
     * 获取唯一约束冲突的字段名
     */
    static getUniqueConstraintFields(error: unknown): string[] | null;
}
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
export declare function HandlePrismaError(operationType: DbOperationType): (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
