import { RedisService } from "../../../../redis/src";
import { ConfigService } from '@nestjs/config';
import { Observable, Subject } from 'rxjs';
export declare class SseClient {
    private readonly config;
    private readonly redis;
    private clients;
    private sseChannelKey;
    constructor(config: ConfigService, redis: RedisService);
    publish(clientId: string, data: any, needDeleteClient?: boolean): Promise<void>;
    subscribe(clientId: string): Promise<{
        t: string;
        data: any;
        needDeleteClient: any;
    }>;
    registerClient(id: string): Subject<any>;
    unregisterClient(id: string): void;
    private isClientRegistered;
    broadcast(data: any): void;
    sendToClient(clientId: string, data: any, unregister?: boolean): void;
    initSse(clientId: string, callback: () => void | Promise<void>, needIntervalCallback?: boolean): Observable<any>;
    /**
     * 推送会议相关 SSE 事件（统一入口）
     *
     * @description P1 优化：统一的会议相关 SSE 事件推送方法
     * 用于转写、摘要生成、知识提取等会议相关任务的实时状态推送
     *
     * @param meetingId - 会议 ID
     * @param type - 事件类型
     * @param status - 任务状态
     * @param data - 事件数据（可选）
     * @param error - 错误信息（可选，仅在 status='error' 时存在）
     * @param taskId - 任务 ID（可选，用于关联 Python Task）
     * @param progress - 进度（0-100，可选）
     * @param currentStep - 当前步骤描述（可选）
     * @param needDeleteClient - 是否在推送后删除客户端连接（默认 false）
     *
     * @example
     * ```typescript
     * // 推送转写完成事件
     * await sseClient.publishMeetingEvent(
     *   'meeting-uuid',
     *   'transcription',
     *   'success',
     *   { transcript: '...', utterances: [...] },
     * );
     *
     * // 推送摘要生成进度事件
     * await sseClient.publishMeetingEvent(
     *   'meeting-uuid',
     *   'summary',
     *   'processing',
     *   undefined,
     *   undefined,
     *   'task-uuid',
     *   50,
     *   '正在生成摘要...',
     * );
     * ```
     */
    publishMeetingEvent(meetingId: string, type: 'transcription' | 'summary', status: 'processing' | 'success' | 'error', data?: any, error?: string, taskId?: string, progress?: number, currentStep?: string, needDeleteClient?: boolean): Promise<void>;
}
