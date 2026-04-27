"use strict";
/**
 * Unit of Work Service
 * 工作单元服务 - 统一管理跨服务事务
 *
 * 职责：
 * 1. 提供统一的事务管理接口
 * 2. 支持跨多个 db 服务的事务操作
 * 3. 自动处理事务的提交和回滚
 * 4. 支持嵌套事务检测
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class SignService {
 *   constructor(
 *     private readonly uow: UnitOfWorkService,
 *     private readonly userService: UserService,
 *   ) {}
 *
 *   async createAccount(data: CreateAccountDto) {
 *     return await this.uow.execute(async () => {
 *       // 在事务中调用服务层方法，服务层会自动使用事务客户端
 *       const user = await this.userService.createUser(data);
 *       return { user };
 *     });
 *   }
 * }
 * ```
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnitOfWorkService = void 0;
const common_1 = require("@nestjs/common");
const prisma_1 = require("../../prisma/src/prisma");
const transaction_context_1 = require("./transaction-context");
/**
 * Unit of Work Service
 * 工作单元服务
 */
let UnitOfWorkService = class UnitOfWorkService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Execute a callback within a transaction
     * 在事务中执行回调
     *
     * 使用 AsyncLocalStorage 在调用链中传递事务客户端
     * db 服务层会自动检测并使用事务客户端
     *
     * @param callback - Callback function (no need to pass tx parameter)
     * @param options - Transaction options
     * @returns Result of the callback
     */
    async execute(callback, options) {
        return await this.prisma.write.$transaction(async (tx) => {
            // 在事务上下文中运行回调
            // db 服务层会自动通过 getTransactionClient() 获取事务客户端
            return await (0, transaction_context_1.runInTransactionContext)(tx, callback);
        }, options);
    }
    /**
     * Execute with retry on deadlock/conflict
     * 在死锁/冲突时重试执行
     *
     * Uses exponential backoff with jitter to prevent thundering herd
     * 使用带抖动的指数退避来防止惊群效应
     *
     * @param callback - Callback function
     * @param options - Transaction options with retry config
     * @returns Result of the callback
     */
    async executeWithRetry(callback, options) {
        const maxRetries = options?.maxRetries ?? 3;
        const retryDelay = options?.retryDelay ?? 100;
        const { maxRetries: _, retryDelay: __, ...txOptions } = options || {};
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await this.execute(callback, txOptions);
            }
            catch (error) {
                lastError = error;
                if (this.isRetryableError(error) && attempt < maxRetries) {
                    // Exponential backoff with jitter to prevent thundering herd
                    // 指数退避 + 抖动，防止惊群效应
                    const baseDelay = retryDelay * Math.pow(2, attempt);
                    const jitter = Math.random() * retryDelay;
                    await this.sleep(baseDelay + jitter);
                    continue;
                }
                throw error;
            }
        }
        throw lastError || new Error('Transaction failed after max retries');
    }
    /**
     * Check if error is retryable
     * 检查错误是否可重试
     */
    isRetryableError(error) {
        if (!error || typeof error !== 'object')
            return false;
        const prismaCode = error.code;
        const retryableCodes = ['P2034', 'P2028', '40001', '40P01'];
        if (prismaCode && retryableCodes.includes(prismaCode)) {
            return true;
        }
        const message = error.message || '';
        return retryableCodes.some((code) => message.includes(code));
    }
    /**
     * Sleep for specified milliseconds
     * 睡眠指定毫秒数
     */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.UnitOfWorkService = UnitOfWorkService;
exports.UnitOfWorkService = UnitOfWorkService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_1.PrismaService])
], UnitOfWorkService);
//# sourceMappingURL=unit-of-work.service.js.map