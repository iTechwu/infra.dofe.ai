"use strict";
/**
 * @fileoverview OpenSpeech 服务提供商基类
 *
 * 本文件定义了语音识别服务提供商的抽象基类，提供了通用的日志记录功能，
 * 并定义了子类必须实现的抽象方法。
 *
 * @module openspeech/providers/base
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseOpenspeechProvider = void 0;
/**
 * 语音识别服务提供商抽象基类
 *
 * @description 提供了所有云服务商实现类的公共基础设施：
 * - 统一的日志记录器注入
 * - 定义子类必须实现的抽象方法
 * - 提供便捷的日志记录方法
 *
 * @abstract
 * @class BaseOpenspeechProvider
 * @implements {IOpenspeechProvider}
 *
 * @example
 * ```typescript
 * class MyProvider extends BaseOpenspeechProvider {
 *   readonly vendor = 'oss';
 *
 *   constructor(logger: Logger) {
 *     super(logger);
 *   }
 *
 *   async submitTask(params: SubmitTaskParams): Promise<string> {
 *     this.logInfo('Submitting task', { audioUrl: params.audioUrl });
 *     // 实现提交逻辑
 *   }
 *
 *   async queryTaskStatus(vendorTaskId: string): Promise<TaskStatusResult> {
 *     // 实现查询逻辑
 *   }
 * }
 * ```
 */
class BaseOpenspeechProvider {
    logger;
    /**
     * 构造函数
     *
     * @param {Logger} logger - Winston 日志记录器实例
     * @protected
     */
    constructor(logger) {
        this.logger = logger;
    }
    /**
     * 记录信息日志
     *
     * @protected
     * @param {string} message - 日志消息
     * @param {Record<string, unknown>} [meta] - 附加元数据
     */
    logInfo(message, meta) {
        this.logger.info(`[${this.vendor}] ${message}`, meta);
    }
    /**
     * 记录错误日志
     *
     * @protected
     * @param {string} message - 日志消息
     * @param {Record<string, unknown>} [meta] - 附加元数据
     */
    logError(message, meta) {
        this.logger.error(`[${this.vendor}] ${message}`, meta);
    }
    /**
     * 记录警告日志
     *
     * @protected
     * @param {string} message - 日志消息
     * @param {Record<string, unknown>} [meta] - 附加元数据
     */
    logWarn(message, meta) {
        this.logger.warn(`[${this.vendor}] ${message}`, meta);
    }
}
exports.BaseOpenspeechProvider = BaseOpenspeechProvider;
//# sourceMappingURL=base.provider.js.map