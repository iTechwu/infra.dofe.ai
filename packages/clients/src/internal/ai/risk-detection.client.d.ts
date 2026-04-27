import { HttpService } from '@nestjs/axios';
import { Logger } from 'winston';
export interface VolcengineRiskConfig {
    accessKey: string;
    secretKey: string;
    region: string;
    appId: number;
    baseUrl: string;
}
export interface TextRiskResult {
    DataId: string;
    Decision: 'PASS' | 'REVIEW' | 'BLOCK';
    FinalLabel: string;
    DecisionLabel: string;
    PassThrough?: any;
    TextCount?: number;
    Results?: any[];
}
export interface ImageRiskResult {
    DataId: string;
    Decision: 'PASS' | 'REVIEW' | 'BLOCK';
    FinalLabel: string;
    DecisionLabel: string;
    PassThrough?: any;
    Results?: any[];
}
export interface VideoRiskSubmitResult {
    DataId: string;
    TaskId?: string;
}
export interface VideoRiskQueryResult {
    DataId: string;
    FinalLabel?: string;
    DecisionLabel?: string;
    PassThrough?: any;
    VideoResults?: {
        Decision: 'PASS' | 'REVIEW' | 'BLOCK';
        ImageSliceCount: number;
        Frames?: any[];
    };
    AudioResults?: {
        Decision: 'PASS' | 'REVIEW' | 'BLOCK';
        Details?: any[];
        AudioText?: string;
    };
}
export declare class RiskDetectionClient {
    private readonly httpService;
    private readonly logger;
    private readonly riskConfig;
    private readonly isConfigured;
    constructor(httpService: HttpService, logger: Logger);
    /**
     * 文本风险检测
     */
    detectTextRisk(text: string, dataId: string): Promise<TextRiskResult | undefined>;
    /**
     * 图片内容风险检测
     */
    detectImageRisk(url: string, dataId: string): Promise<ImageRiskResult | undefined>;
    /**
     * 提交视频风险检测任务（异步）
     */
    submitVideoRisk(url: string, dataId: string): Promise<VideoRiskSubmitResult | undefined>;
    /**
     * 查询视频风险检测结果
     */
    queryVideoRisk(dataId: string): Promise<VideoRiskQueryResult | undefined>;
    /**
     * 调用火山引擎 API
     */
    private volcengineApi;
}
