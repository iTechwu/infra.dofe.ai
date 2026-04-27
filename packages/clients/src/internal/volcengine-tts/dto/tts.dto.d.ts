/**
 * TTS 服务 DTO 定义
 */
import { z } from 'zod';
export declare const TtsRequestSchema: any;
export declare const TtsResponseSchema: any;
export declare const TtsResultSchema: any;
export type TtsRequest = z.infer<typeof TtsRequestSchema>;
export type TtsResponse = z.infer<typeof TtsResponseSchema>;
export type TtsResult = z.infer<typeof TtsResultSchema>;
export declare class TtsRequestDto implements TtsRequest {
    text: string;
    speaker?: string;
    format: string;
    speech_rate: number;
    loudness_rate: number;
    pitch: number;
}
export declare class TtsResponseDto implements TtsResponse {
    code: number;
    data?: string;
    sentence?: any;
    message?: string;
}
export declare class TtsResultDto implements TtsResult {
    success: boolean;
    audio?: string;
    s3Uri?: string;
    duration?: number;
    error?: string;
    text?: string;
}
