"use strict";
/**
 * TTS 服务 DTO 定义
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TtsResultDto = exports.TtsResponseDto = exports.TtsRequestDto = exports.TtsResultSchema = exports.TtsResponseSchema = exports.TtsRequestSchema = void 0;
const zod_1 = require("zod");
// TTS Request Schema
exports.TtsRequestSchema = zod_1.z.object({
    text: zod_1.z.string(),
    speaker: zod_1.z.string().optional(),
    format: zod_1.z.string().default('mp3'),
    speech_rate: zod_1.z.number().default(0),
    loudness_rate: zod_1.z.number().default(0),
    pitch: zod_1.z.number().default(0),
});
// TTS Response Schema
exports.TtsResponseSchema = zod_1.z.object({
    code: zod_1.z.number(),
    data: zod_1.z.string().optional(),
    sentence: zod_1.z.any().optional(),
    message: zod_1.z.string().optional(),
});
// TTS Result Schema
exports.TtsResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    audio: zod_1.z.string().optional(),
    s3Uri: zod_1.z.string().optional(),
    duration: zod_1.z.number().optional(),
    error: zod_1.z.string().optional(),
    text: zod_1.z.string().optional(),
});
// Legacy class exports for backward compatibility
class TtsRequestDto {
    text;
    speaker;
    format = 'mp3';
    speech_rate = 0;
    loudness_rate = 0;
    pitch = 0;
}
exports.TtsRequestDto = TtsRequestDto;
class TtsResponseDto {
    code;
    data;
    sentence;
    message;
}
exports.TtsResponseDto = TtsResponseDto;
class TtsResultDto {
    success;
    audio;
    s3Uri;
    duration;
    error;
    text;
}
exports.TtsResultDto = TtsResultDto;
//# sourceMappingURL=tts.dto.js.map