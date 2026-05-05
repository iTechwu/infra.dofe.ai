/**
 * 火山引擎 TOS 转码服务 DTO
 * 参考文档：
 * - https://www.volcengine.com/docs/4/127559 (VOD API)
 * - https://www.volcengine.com/docs/6448/76377?lang=zh (智能处理 API)
 * - https://www.volcengine.com/docs/6448/106885?lang=zh (任务节点输出定义)
 */

/**
 * 火山引擎 TOS 配置
 */
export interface VolcengineTosConfig {
    accessKeyId: string;
    accessKeySecret: string;
    region: string;
    spaceName: string;
    endpoint?: string;
}

/**
 * 响应元数据
 */
export interface ResponseMetadata {
    RequestId: string;
    Action: string;
    Version: string;
    Region: string;
}

/**
 * 火山引擎媒体转换任务结果
 */
export interface VolcengineMediaConvertTaskResult {
    ResponseMetadata: ResponseMetadata;
    Result: string;
}

/**
 * 火山引擎输入路径
 */
export interface VolcengineInputPath {
    Type: 'VOD' | 'TOS' | 'VODMaterial';
    TosBucket?: string;
    VodSpaceName?: string;
    FileId: string;
}

/**
 * 火山引擎输出路径
 */
export interface VolcengineOutputPath {
    Type: 'VOD' | 'TOS';
    TosBucket?: string;
    VodSpaceName?: string;
    FileName?: string;
}

/**
 * 火山引擎智能处理任务节点输出属性
 * 参考：https://www.volcengine.com/docs/6448/106885?lang=zh
 */
export interface VolcengineJobOutputProperties {
    /** 基础转码输出信息 */
    TranscodeVideo?: {
        SubtitleInfo?: VolcengineSubtitleInfo;
    };
    /** 画质检测输出信息 */
    QualityDetect?: {
        VQNRInfo?: VolcengineVQNRInfo;
        VQFRInfo?: VolcengineVQFRInfo;
        Interlace?: VolcengineInterlace;
        BlackFrame?: VolcengineBlackFrame;
        VolumeInfo?: VolcengineVolumeInfo;
    };
    /** 精细化去水印输出信息 */
    SmartErase?: {
        Watermark?: VolcengineWatermark;
        OCR?: VolcengineOCR;
    };
    /** 精彩剪辑输出信息 */
    VideoSummary?: {
        OutputPath?: VolcengineOutputPath;
    };
    /** 视频 DNA 输出信息 */
    VideoDNA?: {
        ActionType?: string;
        Candidates?: VolcengineCandidate[];
        Threshold?: number;
        Index?: VolcengineInputPath;
        NeedDetail?: string;
    };
    /** 输出节点信息 */
    Output?: {
        OutputPath?: VolcengineOutputPath;
        AutoPublish?: boolean;
    };
}

/**
 * 字幕流输出信息
 */
export interface VolcengineSubtitleInfo {
    Type?: 'VOD' | 'VODMaterial' | 'TOS';
    TosBucket?: string;
    VodSpaceName?: string;
    Subtitles?: VolcengineSubtitle[];
}

/**
 * 字幕流信息
 */
export interface VolcengineSubtitle {
    Language?: string;
    FileId?: string;
}

/**
 * 无参考评分结果
 */
export interface VolcengineVQNRInfo {
    VQScore?: number;
    FakeResolution?: number;
    Noise?: number;
    Contrast?: number;
    Colorfulness?: number;
    Brightness?: number;
    Texture?: number;
}

/**
 * 有参考评分结果
 */
export interface VolcengineVQFRInfo {
    PSNR?: number;
    SSIM?: number;
    VMAF?: number;
}

/**
 * 水波纹检测修复结果
 */
export interface VolcengineInterlace {
    Type?: 'Interlaced' | 'Normal';
    Adjust?: boolean;
}

/**
 * 黑帧检测修复结果
 */
export interface VolcengineBlackFrame {
    BlackList?: VolcengineBlackInfo[];
    Adjust?: boolean;
}

/**
 * 黑帧信息
 */
export interface VolcengineBlackInfo {
    Start?: number;
    End?: number;
    Duration?: number;
}

/**
 * 音量检测结果
 */
export interface VolcengineVolumeInfo {
    Loudness?: number;
    Peak?: number;
    MeanVolume?: number;
    MaxVolume?: number;
}

/**
 * 水印检测修复结果
 */
export interface VolcengineWatermark {
    WatermarkList?: VolcengineWatermarkInfo[];
    Adjust?: boolean;
}

/**
 * 水印信息
 */
export interface VolcengineWatermarkInfo {
    rect?: VolcengineRect;
    start_time?: number;
    end_time?: number;
}

/**
 * 字幕检测修复结果
 */
export interface VolcengineOCR {
    OCRList?: VolcengineOCRInfo[];
    HasOCR?: boolean;
    Adjust?: boolean;
}

/**
 * 字幕信息
 */
export interface VolcengineOCRInfo {
    rect?: VolcengineRect;
    start_time?: number;
    end_time?: number;
}

/**
 * 矩形位置信息
 */
export interface VolcengineRect {
    x0?: number;
    y0?: number;
    w?: number;
    h?: number;
}

/**
 * 相似视频候选信息
 */
export interface VolcengineCandidate {
    DuplicatedIndex?: VolcengineInputPath;
    Duplication?: VolcengineTimeInfo;
    Input?: VolcengineTimeInfo;
    Similarity?: number;
}

/**
 * 时间信息
 */
export interface VolcengineTimeInfo {
    End?: number;
    Start?: number;
}

/**
 * 火山引擎任务输出信息
 */
export interface VolcengineJobOutput {
    TemplateId?: string;
    TemplateName?: string;
    Properties?: VolcengineJobOutputProperties;
}

export interface VolcengineSubmitJobRequestOrigin {
    /** 接口名称，固定为 SubmitJob */
    Action: string;
    /** 接口版本，固定为 2021-06-11 */
    Version: string;
    /** 任务输入文件，JSON 对象字符串 */
    InputPath?: string;
    /** 拼接视频多输入文件，JSON 数组字符串，最大 20 个 */
    MultiInputs?: string;
    /** 工作流模板 ID */
    TemplateId: string;
    /** 是否开启闲时任务，true/false */
    EnableLowPriority?: string;
    /** 任务执行参数，JSON 对象字符串 */
    Params?: string;
    /** 自定义回调参数，最大长度 512 字节 */
    CallbackArgs?: string;
    /** 回调地址，长度小于等于 200，仅支持 http(s) */
    CallbackUri?: string;
    /** 任务回调数据类型，application/octet-stream 或 application/json */
    CallbackContentType?: 'application/octet-stream' | 'application/json';
    /** 单任务触发参数，JSON 对象字符串 */
    Job?: any;
    /** 输出文件路径，单任务触发时生效，JSON 对象字符串 */
    OutputPath?: string;
}

/**
 * SubmitJob 接口请求参数
 * 参考：https://www.volcengine.com/docs/6448/76377?lang=zh
 */
export interface VolcengineSubmitJobRequest {
    /** 接口名称，固定为 SubmitJob */
    Action: string;
    /** 接口版本，固定为 2021-06-11 */
    Version: string;
    /** 任务输入文件，JSON 对象字符串 */
    InputPath?: VolcengineInputPath;
    /** 拼接视频多输入文件，JSON 数组字符串，最大 20 个 */
    MultiInputs?: VolcengineMultiInput[];
    /** 工作流模板 ID */
    TemplateId: string;
    /** 是否开启闲时任务，true/false */
    EnableLowPriority?: string;
    /** 任务执行参数，JSON 对象字符串 */
    Params?: VolcengineWorkflowParams;
    /** 自定义回调参数，最大长度 512 字节 */
    CallbackArgs?: string;
    /** 回调地址，长度小于等于 200，仅支持 http(s) */
    CallbackUri?: string;
    /** 任务回调数据类型，application/octet-stream 或 application/json */
    CallbackContentType?: 'application/octet-stream' | 'application/json';
    /** 单任务触发参数，JSON 对象字符串 */
    Job?: any;
    /** 输出文件路径，单任务触发时生效，JSON 对象字符串 */
    OutputPath?: VolcengineOutputPath;
}

/**
 * 多输入文件中的单个输入
 */
export interface VolcengineMultiInput {
    /** 输入文件 */
    InputPath: VolcengineInputPath;
    /** 片段时间裁剪区域，默认为视频开始到结束 */
    Clip?: VolcengineClip;
}

/**
 * 片段时间裁剪区域
 */
export interface VolcengineClip {
    /** 片段开始时间，单位为毫秒，非负值，默认为 0 */
    StartTime?: number;
    /** 片段结束时间，单位为毫秒，非负值，默认为视频结束 */
    EndTime?: number;
}

/**
 * 工作流参数
 */
export interface VolcengineWorkflowParams {
    /** 动态参数，需配合工作流模版使用 */
    OverrideParams: VolcengineOverrideParams;
}

/**
 * 动态参数覆盖
 */
export interface VolcengineOverrideParams {
    /** 精细化擦除动态参数 */
    SmartErase?: VolcengineSmartEraseOverrideParams[];
    /** 智能表情合成动态参数 */
    SmartEmoticon?: VolcengineSmartEmoticonOverrideParams[];
    /** 输出节点动态参数 */
    Output?: VolcengineOutputOverrideParams[];
}

/**
 * 精细化擦除动态参数
 */
export interface VolcengineSmartEraseOverrideParams {
    /** 动态参数替换的任务 ActivityId，设置为 * 表示所有精细化擦除任务设置均被替换 */
    ActivityId: string[];
    /** 水印擦除动态参数 */
    Watermark?: VolcengineWatermarkOverrideParams;
    /** 字幕擦除动态参数 */
    OCR?: VolcengineOCROverrideParams;
}

/**
 * 水印擦除动态参数
 */
export interface VolcengineWatermarkOverrideParams {
    /** 水印擦除区域，最大 5 个 */
    DetectRect?: VolcengineDetectRect[];
}

/**
 * 字幕擦除动态参数
 */
export interface VolcengineOCROverrideParams {
    /** 字幕擦除区域，最大 5 个 */
    DetectRect?: VolcengineDetectRect[];
}

/**
 * 检测区域（归一化坐标）
 */
export interface VolcengineDetectRect {
    /** 左上角 x 点归一化坐标，取值范围为 [0,1] */
    X1?: number;
    /** 右下角 x 点归一化坐标，取值范围为 [0,1] */
    X2?: number;
    /** 左上角 y 点归一化坐标，取值范围为 [0,1] */
    Y1?: number;
    /** 右下角 y 点归一化坐标，取值范围为 [0,1] */
    Y2?: number;
}

/**
 * 智能表情合成动态参数
 */
export interface VolcengineSmartEmoticonOverrideParams {
    /** 动态参数替换的任务 ActivityId，设置为 * 表示所有智能表情合成任务设置均被替换 */
    ActivityId: string[];
    /** 视频驱动文件 */
    DrivenVideo?: VolcengineInputPath;
    /** 音频驱动文件 */
    DrivenAudio?: VolcengineInputPath;
    /** 文本驱动参数 */
    DrivenTextParams?: VolcengineDrivenTextParams;
}

/**
 * 文本驱动参数
 */
export interface VolcengineDrivenTextParams {
    /** 文本驱动文件，1000字符以内 */
    DrivenText?: string;
    /** 文本转语音参数 */
    TTSParams?: VolcengineTTSParams;
}

/**
 * 文本转语音参数
 */
export interface VolcengineTTSParams {
    /** 音色，支持 female 和 male */
    VoiceType?: 'female' | 'male';
}

/**
 * 输出节点动态参数
 */
export interface VolcengineOutputOverrideParams {
    /** 动态参数替换的任务 ActivityId，设置为 * 表示所有输出任务设置均被替换 */
    ActivityId: string[];
    /** 输出文件路径 */
    OutputPath?: VolcengineOutputPath;
}

/**
 * SubmitJob 接口响应结果
 */
export interface VolcengineSubmitJobResponse {
    ResponseMetadata: ResponseMetadata;
    Result: string; // 任务 ID
}

/**
 * GetJob 接口请求参数
 * 参考：https://www.volcengine.com/docs/6448/76377?lang=zh
 */
export interface VolcengineGetJobRequest {
    /** 接口名称，固定为 GetJob */
    Action: 'GetJob';
    /** 接口版本，固定为 2021-06-11 */
    Version: '2021-06-11';
    /** 任务 ID */
    JobId: string;
}

/**
 * GetJob 接口响应结果
 */
export interface VolcengineGetJobResponse {
    ResponseMetadata: ResponseMetadata;
    Result: VolcengineJobResult;
}

/**
 * 任务结果信息
 */
export interface VolcengineJobResult {
    /** 任务状态 */
    Status?: string;
    /** 任务进度，0-100 */
    Progress?: number;
    /** 任务输出信息 */
    Output?: VolcengineJobOutput[];
    /** 错误信息 */
    Error?: string;
}

/**
 * CancelJob 接口请求参数
 * 参考：https://www.volcengine.com/docs/6448/76377?lang=zh
 */
export interface VolcengineCancelJobRequest {
    /** 接口名称，固定为 CancelJob */
    Action: 'CancelJob';
    /** 接口版本，固定为 2021-06-11 */
    Version: '2021-06-11';
    /** 任务 ID */
    JobId: string;
}

/**
 * CancelJob 接口响应结果
 */
export interface VolcengineCancelJobResponse {
    ResponseMetadata: ResponseMetadata;
    Result?: any;
}

/**
 * RetrieveJob 接口请求参数
 * 参考：https://www.volcengine.com/docs/6448/76379?lang=zh
 */
export interface VolcengineRetrieveJobRequest {
    /** 接口名称，固定为 RetrieveJob */
    Action: 'RetrieveJob';
    /** 接口版本，固定为 2021-06-11 */
    Version: '2021-06-11';
    /** 任务 ID，JSON 数组字符串，多个任务 ID 用逗号隔开 */
    JobIds: string;
}

/**
 * RetrieveJob 接口响应结果
 */
export interface VolcengineRetrieveJobResponse {
    ResponseMetadata: ResponseMetadata;
    Result: Record<string, VolcengineRetrievedJobInfo>;
}

/**
 * 查询到的任务信息
 */
export interface VolcengineRetrievedJobInfo {
    /** 任务 ID */
    JobId?: string;
    /** 输入路径 */
    InputPath?: VolcengineInputPath;
    /** 输出路径 */
    OutputPath?: VolcengineOutputPath;
    /** 任务内容 */
    JobContent?: any;
    /** 任务状态 */
    Status?: string;
    /** 回调参数 */
    CallbackArgs?: string;
    /** 创建时间 */
    CreatedAt?: string;
    /** 完成时间 */
    FinishedAt?: string;
    /** 模板 ID */
    TemplateId?: string;
    /** 任务列表 ID */
    TaskListId?: string;
    /** 是否开启闲时任务 */
    EnableLowPriority?: string;
    /** 任务来源 */
    JobSource?: string;
}

/**
 * 提交任务结果（兼容 MediaConvertTaskResult）
 */
export interface VolcengineSubmitJobResult {
    taskId: string;
    requestId: string;
    eventId: string;
}
