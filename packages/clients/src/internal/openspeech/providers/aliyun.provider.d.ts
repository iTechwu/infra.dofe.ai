/**
 * @fileoverview 阿里云 OpenSpeech 语音识别服务提供商
 *
 * 本文件实现了阿里云 NLS（自然语言服务）的录音文件识别功能。
 * 阿里云语音识别服务文档：https://help.aliyun.com/document_detail/90727.html
 *
 * @module openspeech/providers/aliyun
 */
import { Logger } from 'winston';
import { FileBucketVendor } from '@prisma/client';
import { BaseOpenspeechProvider } from './base.provider';
import { SubmitTaskParams, TaskStatusResult, AliyunOpenspeechConfig } from '../types';
/**
 * 阿里云语音识别服务提供商
 *
 * @description 封装了阿里云 NLS 录音文件识别的核心功能：
 * - 任务提交：将音频文件提交到阿里云进行语音识别
 * - 状态查询：查询识别任务的处理状态和结果
 *
 * 主要特性：
 * - 支持智能分轨（双声道对话场景）
 * - 支持语义句子检测
 * - 支持时间戳对齐
 * - 支持回调通知
 *
 * @class AliyunOpenspeechProvider
 * @extends {BaseOpenspeechProvider}
 *
 * @example
 * ```typescript
 * const provider = new AliyunOpenspeechProvider(logger, {
 *   accessKeyId: 'your-access-key-id',
 *   accessKeySecret: 'your-access-key-secret',
 *   endpoint: 'https://nls-meta.cn-shanghai.aliyuncs.com',
 *   nslAppKey: 'your-app-key',
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
export declare class AliyunOpenspeechProvider extends BaseOpenspeechProvider {
    private readonly config;
    /**
     * 云服务商标识：阿里云 OSS
     * @readonly
     */
    readonly vendor: FileBucketVendor;
    /**
     * 构造函数
     *
     * @param {Logger} logger - Winston 日志记录器
     * @param {AliyunOpenspeechConfig} config - 阿里云配置
     * @throws {Error} 配置缺失时抛出异常
     */
    constructor(logger: Logger, config: AliyunOpenspeechConfig);
    /**
     * 提交语音识别任务到阿里云
     *
     * @description 调用阿里云 NLS API 提交录音文件识别任务。
     * 任务提交后，阿里云会异步处理，可通过回调或轮询获取结果。
     *
     * 任务配置说明：
     * - auto_split: 开启智能分轨，适用于双方对话场景
     * - enable_semantic_sentence_detection: 开启语义句子检测
     * - enable_timestamp_alignment: 开启时间戳对齐
     * - enable_callback: 开启回调通知
     *
     * @param {SubmitTaskParams} params - 任务提交参数
     * @param {string} params.audioUrl - 音频文件 URL
     * @param {string} [params.callbackUrl] - 回调 URL（可选，默认使用系统配置）
     * @returns {Promise<string>} 阿里云返回的任务 ID (TaskId)
     * @throws {Error} 配置缺失或 API 调用失败时抛出异常
     *
     * @example
     * ```typescript
     * const taskId = await provider.submitTask({
     *   audioUrl: 'https://bucket.oss-cn-hangzhou.aliyuncs.com/audio.mp3',
     * });
     * console.log('Task ID:', taskId);
     * ```
     */
    submitTask(params: SubmitTaskParams): Promise<string>;
    /**
     * 查询阿里云语音识别任务状态
     *
     * @description 调用阿里云 NLS API 查询任务状态。
     * 任务状态包括：
     * - SUCCESS: 识别成功，返回识别文本
     * - RUNNING: 正在处理中
     * - QUEUEING: 排队等待中
     * - FAIL: 识别失败
     * - EXPIRED: 任务过期
     *
     * @param {string} vendorTaskId - 阿里云任务 ID
     * @returns {Promise<TaskStatusResult>} 任务状态和结果
     *
     * @example
     * ```typescript
     * const result = await provider.queryTaskStatus('task-123456');
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
