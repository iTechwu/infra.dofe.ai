import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Logger } from 'winston';
import { FileStorageService } from "../../../../shared-services/src/file-storage";
import { TtsRequestDto, TtsResultDto } from './dto/tts.dto';
export interface VolcengineTtsConfig {
    endpoint: string;
    apiKey: string;
    resourceId: string;
    region: string;
    accessKey: string;
    secretKey: string;
    tos?: {
        region: string;
        endpoint: string;
        bucket: string;
        accessKeyId: string;
        accessKeySecret: string;
    };
}
export declare class VolcengineTtsClient {
    private readonly configService;
    private readonly httpService;
    private readonly fileApi;
    private readonly logger;
    private readonly ttsConfig;
    private readonly ttsUrl;
    private tosClient;
    private cloudUrl;
    constructor(configService: ConfigService, httpService: HttpService, fileApi: FileStorageService, logger: Logger);
    /**
     * 从 endpoint URL 中提取 TOS endpoint 域名
     * 例如: https://tos-s3-cn-shanghai.volces.com -> tos-s3-cn-shanghai.volces.com
     */
    private extractTosEndpoint;
    /**
     * 初始化火山云TOS客户端
     */
    private initializeTOS;
    /**
     * 验证配置信息
     */
    private validateConfiguration;
    /**
     * 安全解析JSON数据
     */
    private safeJsonParse;
    /**
     * 获取音频时长（毫秒）
     */
    private getAudioDuration;
    /**
     * 直接上传音频数据到火山云TOS
     */
    uploadAudioToCloud(audioData: Buffer, fileName: string): Promise<{
        success: boolean;
        cloudUrl?: string;
        s3Uri?: string;
        duration?: number;
        error?: string;
    }>;
    /**
     * 语音合成主方法
     */
    textToSpeech(request: TtsRequestDto): Promise<TtsResultDto>;
    /**
     * 构建请求头
     */
    private buildHeaders;
    /**
     * 执行TTS请求
     */
    private executeTtsRequest;
    /**
     * 处理流式响应
     */
    private processStreamResponse;
    /**
     * 获取音色列表
     */
    getVoiceList(): Promise<any>;
    /**
     * 随机获取一个音色
     */
    getRandomVoice(category?: string, gender?: 'female' | 'male'): Promise<any>;
    /**
     * 获取音色列表（原始数据）
     */
    voiceList(): Promise<any>;
    /**
     * 创建热门分组
     */
    private createHotGroup;
    /**
     * 调用火山引擎 API
     */
    volcengineApi({ body, params, method, Service, }: {
        params: any;
        body?: any;
        method?: 'POST' | 'GET' | 'PUT' | 'DELETE' | 'PATCH';
        Service: string;
    }): Promise<any>;
}
