/**
 * @fileoverview 火山引擎流式语音识别 Provider
 *
 * 本文件实现了火山引擎大模型流式语音识别功能，支持实时音频流转写。
 * 火山引擎流式语音识别文档：https://www.volcengine.com/docs/6561/1354869
 *
 * 支持的模式：
 * - 双向流式模式（优化版本）：wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async
 *   推荐使用，只有结果变化时才返回新数据包，性能更优
 *
 * @module openspeech/providers/volcengine-streaming
 */
import { Logger } from 'winston';
import { VolcengineSaucConfig, IStreamingAsrProvider, StreamingConnectParams, StreamingAsrCallbacks, StreamingAsrStatus, StreamingUtterance } from '../types';
/**
 * 重连配置接口
 */
interface ReconnectConfig {
    /** 最大重试次数 */
    maxRetries: number;
    /** 初始重试延迟（毫秒） */
    initialDelay: number;
    /** 最大重试延迟（毫秒） */
    maxDelay: number;
    /** 延迟增长因子 */
    backoffMultiplier: number;
}
/**
 * 火山引擎流式语音识别 Provider
 *
 * @description 封装了火山引擎大模型流式语音识别的核心功能：
 * - WebSocket 连接管理
 * - 二进制协议编解码
 * - 音频数据分包发送
 * - 实时识别结果解析
 *
 * @class VolcengineStreamingAsrProvider
 * @implements {IStreamingAsrProvider}
 *
 * @example
 * ```typescript
 * const provider = new VolcengineStreamingAsrProvider(logger, config);
 *
 * // 建立连接
 * const connectionId = await provider.connect(
 *   { sessionId: 'session-123', audioFormat: 'pcm' },
 *   {
 *     onResult: (result) => console.log('识别结果:', result.text),
 *     onConnected: () => console.log('已连接'),
 *     onError: (error) => console.error('错误:', error),
 *   }
 * );
 *
 * // 发送音频数据
 * await provider.sendAudio(connectionId, audioBuffer);
 *
 * // 发送最后一帧
 * await provider.sendAudio(connectionId, lastAudioBuffer, true);
 *
 * // 关闭连接
 * await provider.disconnect(connectionId);
 * ```
 */
export declare class VolcengineStreamingAsrProvider implements IStreamingAsrProvider {
    private readonly logger;
    private readonly config;
    /**
     * 云服务商标识
     */
    readonly vendor = "volcengine-streaming";
    /**
     * 连接池
     * @description 存储所有活跃的 WebSocket 连接
     */
    private readonly connections;
    /**
     * 重连配置
     */
    private readonly reconnectConfig;
    /**
     * 构造函数
     *
     * @param {Logger} logger - Winston 日志记录器
     * @param {VolcengineSaucConfig} config - 火山引擎流式语音识别配置
     * @param {Partial<ReconnectConfig>} reconnectConfig - 重连配置（可选）
     */
    constructor(logger: Logger, config: VolcengineSaucConfig, reconnectConfig?: Partial<ReconnectConfig>);
    /**
     * 记录信息日志
     */
    private logInfo;
    /**
     * 记录错误日志
     */
    private logError;
    /**
     * 记录警告日志
     */
    private logWarn;
    /**
     * 记录调试日志
     */
    private logDebug;
    /**
     * 构建 WebSocket 连接认证头
     *
     * @param connectId - 连接唯一标识
     * @returns HTTP 请求头
     */
    private buildHeaders;
    /**
     * 构建消息头（4 bytes）
     *
     * @description 按照火山引擎 WebSocket 二进制协议构建消息头
     *
     * 协议格式：
     * - Byte 0: Version (4 bits) + Header Size (4 bits)
     * - Byte 1: Message Type (4 bits) + Message Type Specific Flags (4 bits)
     * - Byte 2: Serialization Method (4 bits) + Compression (4 bits)
     * - Byte 3: Reserved
     *
     * @param messageType - 消息类型
     * @param specificFlags - 消息类型特定标志
     * @param serialization - 序列化方法
     * @param compression - 压缩方法
     * @returns 4 字节的消息头 Buffer
     */
    private buildMessageHeader;
    /**
     * 构建完整客户端请求消息（初始请求）
     *
     * @param data - 请求参数（JSON 对象）
     * @returns 完整的二进制消息
     */
    private buildFullClientRequest;
    /**
     * 构建音频数据请求消息
     *
     * @param audioData - 音频数据
     * @param isLast - 是否为最后一帧
     * @returns 完整的二进制消息
     */
    private buildAudioOnlyRequest;
    /**
     * 构建初始请求参数对象
     *
     * @description 根据连接参数构建符合火山引擎 API 规范的初始请求
     * @param options - 连接参数选项
     * @returns 初始请求对象
     */
    private buildInitRequest;
    /**
     * 解析服务器响应
     *
     * @param data - 原始二进制响应数据
     * @returns 解析后的识别结果
     */
    private parseServerResponse;
    /**
     * 建立流式识别连接
     *
     * @description 建立 WebSocket 连接并发送初始配置请求
     *
     * @param params - 连接参数
     * @param callbacks - 事件回调
     * @returns 连接 ID
     */
    connect(params: StreamingConnectParams, callbacks: StreamingAsrCallbacks): Promise<string>;
    /**
     * 计算音频时长（毫秒）
     *
     * @description 根据音频数据大小和采样参数计算时长
     * @param audioBytes - 音频数据字节数
     * @param sampleRate - 采样率（默认 16000）
     * @param channels - 声道数（默认 1）
     * @param bitsPerSample - 采样位深（默认 16）
     * @returns 音频时长（毫秒）
     */
    private calculateAudioDurationMs;
    /**
     * 发送音频数据
     *
     * @description 将音频数据分包发送到火山引擎服务
     * 文档建议单包音频大小 100-200ms，双向流式模式推荐 200ms
     *
     * @param connectionId - 连接 ID
     * @param audioData - 音频数据（Buffer）
     * @param isLast - 是否为最后一帧
     */
    sendAudio(connectionId: string, audioData: Buffer, isLast?: boolean): Promise<void>;
    /**
     * 关闭连接
     *
     * @param connectionId - 连接 ID
     */
    disconnect(connectionId: string): Promise<void>;
    /**
     * 获取连接状态
     *
     * @param connectionId - 连接 ID
     * @returns 连接状态
     */
    getConnectionStatus(connectionId: string): StreamingAsrStatus;
    /**
     * 获取累积的转写结果
     *
     * @param connectionId - 连接 ID
     * @returns 转写结果
     */
    getTranscript(connectionId: string): {
        transcript: string;
        utterances: StreamingUtterance[];
    } | null;
    /**
     * 获取活跃连接数
     *
     * @returns 活跃连接数量
     */
    getActiveConnectionCount(): number;
    /**
     * 清理所有连接
     *
     * @description 关闭所有活跃的 WebSocket 连接
     */
    cleanupAllConnections(): Promise<void>;
    /**
     * 启动心跳机制
     *
     * @description 定期发送心跳包以保持连接活跃
     * @param connectionId - 连接 ID
     */
    private startHeartbeat;
    /**
     * 停止心跳机制
     *
     * @param connectionId - 连接 ID
     */
    private stopHeartbeat;
    /**
     * 发送心跳包
     *
     * @description 发送一个空的音频包作为心跳
     * @param connectionId - 连接 ID
     */
    private sendHeartbeat;
    /**
     * 重置心跳超时
     *
     * @description 收到服务器响应时重置超时检测
     * @param connectionId - 连接 ID
     */
    private resetHeartbeatTimeout;
    /**
     * 处理心跳超时
     *
     * @description 心跳超时表示连接可能已断开，触发重连
     * @param connectionId - 连接 ID
     */
    private handleHeartbeatTimeout;
    /**
     * 尝试重新连接
     *
     * @description 使用指数退避策略进行重连
     * @param connectionId - 连接 ID
     */
    private attemptReconnect;
    /**
     * 执行重连
     *
     * @description 创建新的 WebSocket 连接并恢复状态
     * @param connectionId - 连接 ID
     */
    private reconnect;
    /**
     * 缓冲音频数据（用于重连期间）
     *
     * @description 在重连期间缓冲音频数据，重连成功后发送
     * @param connectionId - 连接 ID
     * @param audioData - 音频数据
     */
    bufferAudioDuringReconnect(connectionId: string, audioData: Buffer): void;
    /**
     * 检查连接是否正在重连
     *
     * @param connectionId - 连接 ID
     * @returns 是否正在重连
     */
    isReconnecting(connectionId: string): boolean;
}
export {};
