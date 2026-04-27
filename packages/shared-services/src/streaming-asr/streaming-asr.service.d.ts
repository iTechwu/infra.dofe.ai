/**
 * @fileoverview 流式语音识别服务
 *
 * 本服务提供流式语音识别的核心业务逻辑，包括：
 * - 创建和管理流式识别会话
 * - 音频数据传输
 * - 实时识别结果处理
 * - 与会议记录的集成
 *
 * @module streaming-asr/service
 */
import { OnModuleDestroy } from '@nestjs/common';
import { Logger } from 'winston';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from "../../../redis/src";
import { CreateStreamingSessionDto, StreamingSessionResult, CompleteStreamingSessionDto, CompleteStreamingSessionResult, SessionStatusResult, StreamingAsrEvent } from './types';
/**
 * 流式语音识别服务
 *
 * @description 提供流式语音识别的业务逻辑处理：
 *
 * 1. **创建会话** - `createSession`
 *    创建流式识别会话，建立 WebSocket 连接
 *
 * 2. **发送音频** - `sendAudio`
 *    发送音频数据到识别服务
 *
 * 3. **完成会话** - `completeSession`
 *    结束识别会话，获取最终结果
 *
 * 4. **查询状态** - `getSessionStatus`
 *    获取会话的实时状态和结果
 *
 * 5. **事件订阅** - `subscribeToSession`
 *    订阅实时识别结果事件
 *
 * @class StreamingAsrService
 *
 * @example
 * ```typescript
 * @Injectable()
 * class StreamingAsrController {
 *   constructor(private readonly streamingAsr: StreamingAsrService) {}
 *
 *   async startSession(dto: CreateStreamingSessionDto) {
 *     const result = await this.streamingAsr.createSession(dto);
 *     return result;
 *   }
 *
 *   async sendAudioChunk(connectionId: string, audioData: Buffer) {
 *     await this.streamingAsr.sendAudio(connectionId, audioData);
 *   }
 * }
 * ```
 */
export declare class StreamingAsrService implements OnModuleDestroy {
    private readonly config;
    private readonly jwt;
    private readonly redis;
    private readonly logger;
    /**
     * 流式识别 Provider
     */
    private provider;
    /**
     * 会话信息存储
     * key: sessionId
     */
    private readonly sessions;
    /**
     * connectionId -> sessionId 映射
     */
    private readonly connectionToSession;
    /**
     * 事件发射器（用于 SSE 推送）
     */
    private readonly eventEmitter;
    /**
     * 会话超时清理定时器
     */
    private cleanupTimer;
    constructor(config: ConfigService, jwt: JwtService, redis: RedisService, logger: Logger);
    /**
     * 模块销毁时清理资源
     */
    onModuleDestroy(): Promise<void>;
    /**
     * 初始化流式识别 Provider
     */
    private initProvider;
    /**
     * 检查 Provider 是否可用
     */
    private ensureProviderAvailable;
    /**
     * 创建流式识别会话
     *
     * @param {CreateStreamingSessionDto} dto - 创建会话参数
     * @returns {Promise<StreamingSessionResult>} 会话创建结果
     *
     * @example
     * ```typescript
     * const session = await streamingAsrService.createSession({
     *   userId: 'user-uuid',
     *   meetingRecordId: 'meeting-uuid', // 可选
     *   audioFormat: 'pcm',
     * });
     * console.log('Session ID:', session.sessionId);
     * console.log('Connection ID:', session.connectionId);
     * ```
     */
    createSession(dto: CreateStreamingSessionDto): Promise<StreamingSessionResult>;
    /**
     * 发送音频数据
     *
     * @param {string} sessionIdOrConnectionId - 会话 ID 或连接 ID
     * @param {Buffer} audioData - 音频数据
     * @param {boolean} [isLast=false] - 是否为最后一帧
     *
     * @description
     * 此方法同时支持传入 sessionId 或 connectionId（向后兼容）：
     * - 优先作为 sessionId 查找（API 设计的主要方式，路径参数为 sessionId）
     * - 如果找不到，再尝试作为 connectionId 查找（向后兼容）
     *
     * @example
     * ```typescript
     * // 使用 sessionId 发送音频数据（推荐，符合 API 设计）
     * await streamingAsrService.sendAudio(sessionId, audioBuffer);
     *
     * // 使用 connectionId 发送音频数据（向后兼容）
     * await streamingAsrService.sendAudio(connectionId, audioBuffer);
     *
     * // 发送最后一帧
     * await streamingAsrService.sendAudio(sessionId, lastBuffer, true);
     * ```
     */
    sendAudio(sessionIdOrConnectionId: string, audioData: Buffer, isLast?: boolean): Promise<void>;
    /**
     * 完成流式识别会话
     *
     * @param {CompleteStreamingSessionDto} dto - 完成会话参数
     * @returns {Promise<CompleteStreamingSessionResult>} 完成结果
     */
    completeSession(dto: CompleteStreamingSessionDto): Promise<CompleteStreamingSessionResult>;
    /**
     * 更新会话活动时间（心跳）
     *
     * @param {string} sessionId - 会话 ID
     * @returns {Promise<{ success: boolean; lastActivityAt: Date }>} 更新结果
     */
    updateSessionActivity(sessionId: string): Promise<{
        success: boolean;
        lastActivityAt: Date;
    }>;
    /**
     * 获取会话状态
     *
     * @param {string} sessionId - 会话 ID
     * @returns {SessionStatusResult} 会话状态
     */
    getSessionStatus(sessionId: string): Promise<SessionStatusResult>;
    /**
     * 获取会话的 sessionToken
     * 如果不存在则重新生成
     *
     * @param {string} sessionId - 会话 ID
     * @returns {Promise<string>} sessionToken
     */
    getSessionToken(sessionId: string): Promise<string>;
    /**
     * 取消/断开会话
     *
     * @param {string} sessionId - 会话 ID
     */
    cancelSession(sessionId: string): Promise<void>;
    /**
     * 订阅会话事件（用于 SSE）
     *
     * @param {string} sessionId - 会话 ID
     * @param {function} callback - 事件回调
     * @returns {function} 取消订阅函数
     */
    subscribeToSession(sessionId: string, callback: (event: StreamingAsrEvent) => void): () => void;
    /**
     * 获取活跃会话数
     */
    getActiveSessionCount(): number;
    /**
     * 根据 connectionId 获取 sessionId
     */
    getSessionIdByConnectionId(connectionId: string): string | undefined;
    /**
     * 处理连接建立事件
     */
    private handleConnected;
    /**
     * 处理识别结果事件
     */
    private handleResult;
    /**
     * 处理错误事件
     */
    private handleError;
    /**
     * 处理断开连接事件
     */
    private handleDisconnected;
    /**
     * 发送事件
     */
    private emitEvent;
    /**
     * 清理会话
     */
    private cleanupSession;
    /**
     * 启动会话清理定时器
     */
    private startCleanupTimer;
    /**
     * 停止会话清理定时器
     */
    private stopCleanupTimer;
    /**
     * 检查并清理超时会话
     */
    private checkAndCleanupSessions;
    /**
     * 自动完成会议（超时时调用）
     * @private
     */
    private autoCompleteMeeting;
    /**
     * 保存会话数据到 Redis（用于服务重启后恢复）
     *
     * ⚠️ P2: Redis 持久化 - 保存转写数据，避免服务重启导致数据丢失
     */
    private saveSessionToRedis;
    /**
     * 从 Redis 恢复会话数据（用于服务重启后恢复）
     *
     * ⚠️ P2: Redis 持久化 - 服务重启时恢复会话数据
     */
    private restoreSessionFromRedis;
    /**
     * 强制清理会话（用于超时清理）
     */
    private forceCleanupSession;
    /**
     * 清理所有会话
     */
    private cleanupAllSessions;
    /**
     * 获取会话统计信息
     */
    getSessionStats(): {
        activeCount: number;
        streamingCount: number;
        completedCount: number;
        errorCount: number;
    };
    /**
     * 生成 session token
     *
     * @description
     * 生成长期有效的 session token (4小时)，用于音频发送认证
     * 解决 JWT token refresh 导致的音频数据丢失问题
     *
     * @param sessionId - Session ID
     * @param userId - User ID
     * @returns Session token
     */
    private generateSessionToken;
}
