/**
 * @fileoverview OpenSpeech 服务提供商工厂
 *
 * 本文件实现了语音识别服务提供商的工厂模式，负责：
 * - 根据云服务商类型创建对应的提供商实例
 * - 管理提供商实例的生命周期（单例模式）
 * - 提供统一的提供商获取接口
 * - 支持录音文件识别（AUC）和流式识别（SAUC）两种模式
 *
 * @module openspeech/factory
 */
import { HttpService } from '@nestjs/axios';
import { Logger } from 'winston';
import { FileBucketVendor } from '@prisma/client';
import { IOpenspeechProvider, IStreamingAsrProvider } from './types';
/**
 * OpenSpeech 服务提供商工厂
 *
 * @description 使用工厂模式管理不同云服务商的语音识别服务提供商。
 * 主要职责：
 * - 根据 vendor 类型创建对应的提供商实例
 * - 使用单例模式缓存提供商实例，避免重复创建
 * - 提供统一的提供商获取接口
 * - 支持录音文件识别和流式识别两种模式
 *
 * 支持的云服务商：
 * - 'oss': 阿里云 NLS 语音识别
 * - 'tos': 火山引擎大模型语音识别（支持 AUC 录音识别和 SAUC 流式识别）
 *
 * @class OpenspeechProviderFactory
 *
 * @example
 * ```typescript
 * @Injectable()
 * class MyService {
 *   constructor(private readonly factory: OpenspeechProviderFactory) {}
 *
 *   // 录音文件识别
 *   async transcribe(vendor: FileBucketVendor, audioUrl: string) {
 *     const provider = this.factory.getProvider(vendor);
 *     const taskId = await provider.submitTask({ audioUrl });
 *     // ...
 *   }
 *
 *   // 流式语音识别
 *   async streamingTranscribe(sessionId: string) {
 *     const provider = this.factory.getStreamingProvider('tos');
 *     const connectionId = await provider.connect(
 *       { sessionId, audioFormat: 'pcm' },
 *       { onResult: (result) => console.log(result.text) }
 *     );
 *     // ...
 *   }
 * }
 * ```
 */
export declare class OpenspeechProviderFactory {
    private readonly httpService;
    private readonly logger;
    /**
     * 录音文件识别提供商实例缓存
     * @private
     */
    private readonly providers;
    /**
     * 流式识别提供商实例缓存
     * @private
     */
    private readonly streamingProviders;
    /**
     * OpenSpeech 配置
     * @private
     */
    private readonly openspeechConfig;
    /**
     * 构造函数
     *
     * @param {HttpService} httpService - NestJS HTTP 服务（用于火山引擎）
     * @param {Logger} logger - Winston 日志记录器
     */
    constructor(httpService: HttpService, logger: Logger);
    /**
     * 获取指定云服务商的录音文件识别提供商实例
     *
     * @description 根据 vendor 类型返回对应的提供商实例。
     * 使用单例模式，同一 vendor 只会创建一个实例。
     *
     * @param {FileBucketVendor} vendor - 云服务商类型
     * @returns {IOpenspeechProvider} 提供商实例
     * @throws {Error} 不支持的 vendor 类型或配置缺失时抛出异常
     *
     * @example
     * ```typescript
     * // 获取阿里云提供商
     * const aliyunProvider = factory.getProvider('oss');
     *
     * // 获取火山引擎提供商
     * const volcengineProvider = factory.getProvider('tos');
     * ```
     */
    getProvider(vendor: FileBucketVendor): IOpenspeechProvider;
    /**
     * 获取指定云服务商的流式识别提供商实例
     *
     * @description 根据 vendor 类型返回对应的流式识别提供商实例。
     * 目前仅支持火山引擎 (tos)。
     *
     * @param {FileBucketVendor} vendor - 云服务商类型（目前仅支持 'tos'）
     * @returns {IStreamingAsrProvider} 流式识别提供商实例
     * @throws {Error} 不支持的 vendor 类型或配置缺失时抛出异常
     *
     * @example
     * ```typescript
     * const streamingProvider = factory.getStreamingProvider('tos');
     * const connectionId = await streamingProvider.connect(
     *   { sessionId: 'session-123', audioFormat: 'pcm' },
     *   { onResult: (result) => console.log(result.text) }
     * );
     * ```
     */
    getStreamingProvider(vendor: FileBucketVendor): IStreamingAsrProvider;
    /**
     * 创建录音文件识别提供商实例
     *
     * @private
     * @param {FileBucketVendor} vendor - 云服务商类型
     * @returns {IOpenspeechProvider} 新创建的提供商实例
     * @throws {Error} 不支持的 vendor 类型或配置缺失时抛出异常
     */
    private createProvider;
    /**
     * 创建流式识别提供商实例
     *
     * @private
     * @param {FileBucketVendor} vendor - 云服务商类型
     * @returns {IStreamingAsrProvider} 新创建的流式识别提供商实例
     * @throws {Error} 不支持的 vendor 类型或配置缺失时抛出异常
     */
    private createStreamingProvider;
    /**
     * 将阿里云配置转换为 Provider 配置
     *
     * @private
     * @param {NonNullable<OpenSpeechConfig['oss']>} config - 阿里云原始配置
     * @returns {AliyunOpenspeechConfig} 阿里云 Provider 配置
     */
    private toAliyunConfig;
    /**
     * 将火山引擎配置转换为录音文件识别（AUC）Provider 配置
     *
     * @private
     * @param {NonNullable<OpenSpeechConfig['tos']>} config - 火山引擎原始配置
     * @returns {VolcengineAucConfig} 火山引擎 AUC Provider 配置
     * @throws {Error} AUC 配置缺失时抛出异常
     */
    private toVolcengineAucConfig;
    /**
     * 将火山引擎配置转换为流式识别（SAUC）Provider 配置
     *
     * @private
     * @param {NonNullable<OpenSpeechConfig['tos']>} config - 火山引擎原始配置
     * @returns {VolcengineSaucConfig} 火山引擎 SAUC Provider 配置
     * @throws {Error} SAUC 配置缺失时抛出异常
     */
    private toVolcengineSaucConfig;
    /**
     * 创建阿里云提供商实例
     *
     * @private
     * @returns {AliyunOpenspeechProvider} 阿里云提供商实例
     * @throws {Error} 配置缺失时抛出异常
     */
    private createAliyunProvider;
    /**
     * 创建火山引擎录音文件识别提供商实例
     *
     * @private
     * @returns {VolcengineOpenspeechProvider} 火山引擎 AUC 提供商实例
     * @throws {Error} 配置缺失时抛出异常
     */
    private createVolcengineAucProvider;
    /**
     * 创建火山引擎流式识别提供商实例
     *
     * @private
     * @returns {VolcengineStreamingAsrProvider} 火山引擎 SAUC 提供商实例
     * @throws {Error} 配置缺失时抛出异常
     */
    private createVolcengineSaucProvider;
    /**
     * 检查指定云服务商的录音文件识别是否可用
     *
     * @param {FileBucketVendor} vendor - 云服务商类型
     * @returns {boolean} 是否可用（配置存在）
     *
     * @example
     * ```typescript
     * if (factory.isVendorAvailable('oss')) {
     *   const provider = factory.getProvider('oss');
     *   // ...
     * }
     * ```
     */
    isVendorAvailable(vendor: FileBucketVendor): boolean;
    /**
     * 检查指定云服务商的流式识别是否可用
     *
     * @param {FileBucketVendor} vendor - 云服务商类型
     * @returns {boolean} 是否可用（配置存在）
     *
     * @example
     * ```typescript
     * if (factory.isStreamingAvailable('tos')) {
     *   const provider = factory.getStreamingProvider('tos');
     *   // ...
     * }
     * ```
     */
    isStreamingAvailable(vendor: FileBucketVendor): boolean;
    /**
     * 获取所有可用的云服务商列表（录音文件识别）
     *
     * @returns {FileBucketVendor[]} 可用的云服务商列表
     *
     * @example
     * ```typescript
     * const vendors = factory.getAvailableVendors();
     * console.log('Available vendors:', vendors);
     * // 输出: ['oss', 'tos']
     * ```
     */
    getAvailableVendors(): FileBucketVendor[];
    /**
     * 获取所有支持流式识别的云服务商列表
     *
     * @returns {FileBucketVendor[]} 支持流式识别的云服务商列表
     *
     * @example
     * ```typescript
     * const vendors = factory.getStreamingAvailableVendors();
     * console.log('Streaming available vendors:', vendors);
     * // 输出: ['tos']
     * ```
     */
    getStreamingAvailableVendors(): FileBucketVendor[];
}
