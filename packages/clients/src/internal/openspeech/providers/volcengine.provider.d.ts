/**
 * @fileoverview 火山引擎 OpenSpeech 语音识别服务提供商
 *
 * 本文件实现了火山引擎大模型录音文件识别功能。
 * 火山引擎语音识别服务文档：https://www.volcengine.com/docs/6561/1354868
 *
 * @module openspeech/providers/volcengine
 */
import { Logger } from 'winston';
import { HttpService } from '@nestjs/axios';
import { FileBucketVendor } from '@prisma/client';
import { BaseOpenspeechProvider } from './base.provider';
import { SubmitTaskParams, TaskStatusResult, VolcengineAucConfig } from '../types';
/**
 * 火山引擎语音识别服务提供商
 *
 * @description 封装了火山引擎大模型录音文件识别的核心功能：
 * - 任务提交：将音频文件提交到火山引擎进行语音识别
 * - 状态查询：查询识别任务的处理状态和结果
 *
 * API 调用方式：
 * - 通过 HTTP 请求调用火山引擎 API
 * - 使用自定义请求头传递认证信息
 * - 支持回调通知
 *
 * @class VolcengineOpenspeechProvider
 * @extends {BaseOpenspeechProvider}
 *
 * @example
 * ```typescript
 * const provider = new VolcengineOpenspeechProvider(logger, httpService, {
 *   appId: 'your-app-id',
 *   appAccessToken: 'your-access-token',
 *   endpoint: 'https://openspeech.bytedance.com/api/v3/auc/bigmodel',
 *   uid: 'your-user-id',
 * });
 *
 * // 提交任务
 * const taskId = await provider.submitTask({
 *   audioUrl: 'https://example.com/audio.mp3',
 * });
 *
 * // 查询状态
 * const result = await provider.queryTaskStatus(taskId);
 * if (result.status === 'success') {
 *   console.log('识别结果:', result.text);
 * }
 * ```
 */
export declare class VolcengineOpenspeechProvider extends BaseOpenspeechProvider {
    private readonly httpService;
    private readonly config;
    /**
     * 云服务商标识：火山引擎 TOS
     * @readonly
     */
    readonly vendor: FileBucketVendor;
    /**
     * 构造函数
     *
     * @param {Logger} logger - Winston 日志记录器
     * @param {HttpService} httpService - NestJS HTTP 服务
     * @param {VolcengineAucConfig} config - 火山引擎录音文件识别配置
     * @throws {Error} 配置缺失时抛出异常
     */
    constructor(logger: Logger, httpService: HttpService, config: VolcengineAucConfig);
    /**
     * 从音频 URL 中提取文件格式
     *
     * @private
     * @param {string} audioUrl - 音频文件 URL
     * @returns {string} 音频格式（默认 mp3）
     *
     * @example
     * ```typescript
     * extractAudioFormat('https://example.com/audio.wav?token=xxx')
     * // 返回: 'wav'
     * ```
     */
    private extractAudioFormat;
    /**
     * 构建 API 请求头
     *
     * @private
     * @param {string} requestId - 请求唯一标识
     * @returns {Record<string, string>} HTTP 请求头
     */
    private buildHeaders;
    /**
     * 提交语音识别任务到火山引擎
     *
     * @description 调用火山引擎大模型录音文件识别 API 提交任务。
     * 任务提交后，火山引擎会异步处理，可通过回调或轮询获取结果。
     *
     * API 文档：https://www.volcengine.com/docs/6561/1354868
     *
     * @param {SubmitTaskParams} params - 任务提交参数
     * @param {string} params.audioUrl - 音频文件 URL
     * @param {string} [params.callbackUrl] - 回调 URL（可选，默认使用系统配置）
     * @returns {Promise<string>} 火山引擎返回的请求 ID（作为任务 ID）
     * @throws {Error} 配置缺失或 API 调用失败时抛出异常
     *
     * @example
     * ```typescript
     * const taskId = await provider.submitTask({
     *   audioUrl: 'https://bucket.tos-cn-beijing.volces.com/audio.mp3',
     * });
     * console.log('Task ID:', taskId);
     * ```
     */
    submitTask(params: SubmitTaskParams): Promise<string>;
    /**
     * 查询火山引擎语音识别任务状态
     *
     * @description 调用火山引擎 API 查询任务状态。
     * 状态码说明：
     * - 20000000: 识别成功
     * - 20000001: 正在处理
     * - 20000002: 排队等待中
     * - 其他: 失败
     *
     * @param {string} vendorTaskId - 火山引擎任务 ID（即提交时的 requestId）
     * @returns {Promise<TaskStatusResult>} 任务状态和结果
     *
     * @example
     * ```typescript
     * const result = await provider.queryTaskStatus('uuid-task-id');
     *
     * switch (result.status) {
     *   case 'success':
     *     console.log('识别文本:', result.text);
     *     break;
     *   case 'processing':
     *     console.log('处理中，请稍后重试');
     *     break;
     *   case 'error':
     *     console.error('识别失败:', result.error);
     *     break;
     * }
     * ```
     */
    queryTaskStatus(vendorTaskId: string): Promise<TaskStatusResult>;
}
