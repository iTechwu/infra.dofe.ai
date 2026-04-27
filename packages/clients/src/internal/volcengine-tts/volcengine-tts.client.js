"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VolcengineTtsClient = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const rxjs_1 = require("rxjs");
const tos_sdk_1 = require("@volcengine/tos-sdk");
const music_metadata_1 = require("music-metadata");
const openapi_1 = require("@volcengine/openapi");
const configuration_1 = require("../../../../common/src/config/configuration");
const file_storage_1 = require("../../../../shared-services/src/file-storage");
const enviroment_util_1 = __importDefault(require("../../../../utils/dist/enviroment.util"));
/**
 * Volcengine TTS服务
 * 基于字节跳动TTS API实现语音合成功能
 */
const hotList = [
    'ICL_zh_male_BV144_paoxiaoge_v1_tob',
    'zh_male_sunwukong_mars_bigtts',
    'zh_male_xionger_mars_bigtts',
    'zh_male_zhubajie_mars_bigtts',
];
let VolcengineTtsClient = class VolcengineTtsClient {
    configService;
    httpService;
    fileApi;
    logger;
    ttsConfig;
    ttsUrl;
    tosClient = null;
    cloudUrl = '';
    constructor(configService, httpService, fileApi, logger) {
        this.configService = configService;
        this.httpService = httpService;
        this.fileApi = fileApi;
        this.logger = logger;
        const config = (0, configuration_1.getKeysConfig)()?.tts;
        // console.log('techwu config', config);
        if (!config || !config.volcengine) {
            throw new Error('Volcengine TTS config not found');
        }
        const volcengineConfig = config.volcengine;
        const storageConfig = (0, configuration_1.getKeysConfig)()?.storage?.tos;
        // 从 buckets 配置中读取 TOS bucket 信息
        const bucketConfigs = this.configService.getOrThrow('buckets');
        const tosBucket = bucketConfigs.find((b) => b.vendor === 'tos' && b.bucket === volcengineConfig.bucket);
        if (!tosBucket) {
            throw new Error(`TOS bucket "${volcengineConfig.bucket}" not found in buckets configuration`);
        }
        if (!storageConfig ||
            !storageConfig.accessKey ||
            !storageConfig.secretKey) {
            throw new Error('TOS storage credentials not found in keys/config.json');
        }
        // 构建 TOS 配置
        const tosConfig = {
            region: tosBucket.region || 'cn-shanghai',
            endpoint: this.extractTosEndpoint(tosBucket.tosEndpoint || tosBucket.endpoint),
            bucket: tosBucket.bucket,
            accessKeyId: storageConfig.accessKey,
            accessKeySecret: storageConfig.secretKey,
        };
        this.ttsConfig = {
            endpoint: volcengineConfig.endpoint ||
                'https://openspeech.bytedance.com/api/v3/tts/unidirectional',
            apiKey: volcengineConfig.apiKey || '',
            resourceId: volcengineConfig.resourceId || '',
            region: volcengineConfig.region || 'cn-shanghai',
            accessKey: volcengineConfig.accessKey || '',
            secretKey: volcengineConfig.secretKey || '',
            tos: tosConfig,
        };
        this.ttsUrl = this.ttsConfig.endpoint;
        this.validateConfiguration();
        this.initializeTOS();
    }
    /**
     * 从 endpoint URL 中提取 TOS endpoint 域名
     * 例如: https://tos-s3-cn-shanghai.volces.com -> tos-s3-cn-shanghai.volces.com
     */
    extractTosEndpoint(endpointUrl) {
        if (!endpointUrl) {
            return 'tos-cn-shanghai.volces.com';
        }
        // 移除协议前缀
        return endpointUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
    /**
     * 初始化火山云TOS客户端
     */
    initializeTOS() {
        if (!this.ttsConfig.tos) {
            this.logger.warn('火山云TOS配置未提供，云存储功能将无法使用');
            return;
        }
        try {
            const { region, endpoint, bucket, accessKeyId, accessKeySecret } = this.ttsConfig.tos;
            if (!accessKeyId || !accessKeySecret) {
                this.logger.warn('火山云TOS配置不完整，云存储功能可能无法使用');
                this.tosClient = null;
                return;
            }
            this.cloudUrl = `https://${bucket}.${endpoint}`;
            this.tosClient = new tos_sdk_1.TosClient({
                region,
                endpoint,
                accessKeyId,
                accessKeySecret,
            });
            if (enviroment_util_1.default.isProduction()) {
                this.logger.info('VolcengineTtsClient module initialized TOS client', {
                    region,
                    endpoint,
                    bucket,
                    accessKeyId,
                    accessKeySecret,
                });
            }
            else {
                this.logger.debug('VolcengineTtsClient module initialized TOS client', {
                    region,
                    endpoint,
                    bucket,
                    accessKeyId,
                    accessKeySecret,
                });
            }
        }
        catch (error) {
            this.logger.error(`火山云TOS客户端初始化失败: ${error.message}`);
            this.tosClient = null;
        }
    }
    /**
     * 验证配置信息
     */
    validateConfiguration() {
        const missingVars = [];
        if (!this.ttsConfig.apiKey) {
            missingVars.push('apiKey');
        }
        if (!this.ttsConfig.resourceId) {
            missingVars.push('resourceId');
        }
        if (missingVars.length > 0) {
            this.logger.warn(`缺少TTS配置项: ${missingVars.join(', ')}`);
            this.logger.warn('TTS服务可能无法正常工作，请检查配置文件');
        }
        else {
            if (enviroment_util_1.default.isProduction()) {
                this.logger.info('TTS configuration validated successfully');
            }
        }
    }
    /**
     * 安全解析JSON数据
     */
    safeJsonParse(jsonString) {
        try {
            return JSON.parse(jsonString);
        }
        catch (error) {
            this.logger.debug(`JSON解析失败: ${error.message}, 数据: ${jsonString.substring(0, 50)}...`);
            return null;
        }
    }
    /**
     * 获取音频时长（毫秒）
     */
    async getAudioDuration(audioData) {
        try {
            const metadata = await (0, music_metadata_1.parseBuffer)(audioData, {
                mimeType: 'audio/mpeg',
            });
            return (metadata.format.duration || 0) * 1000; // 转换为毫秒
        }
        catch (error) {
            this.logger.warn(`获取音频时长失败: ${error.message}`);
            return 0;
        }
    }
    /**
     * 直接上传音频数据到火山云TOS
     */
    async uploadAudioToCloud(audioData, fileName) {
        try {
            this.logger.info(`开始上传音频数据到火山云TOS: ${fileName}`);
            if (!this.tosClient || !this.ttsConfig.tos) {
                throw new Error('火山云TOS客户端未初始化');
            }
            // 生成TOS对象键
            const objectKey = `tts/${Date.now()}/${fileName}`;
            // 上传到火山云TOS
            await this.tosClient.putObject({
                bucket: this.ttsConfig.tos.bucket,
                key: objectKey,
                body: audioData,
                contentType: 'audio/mpeg',
            });
            return {
                success: true,
                cloudUrl: `${this.cloudUrl}/${objectKey}`,
                s3Uri: `tos://${this.ttsConfig.tos.bucket}/${objectKey}`,
            };
        }
        catch (error) {
            this.logger.error(`上传音频数据到火山云TOS失败: ${error.message}`);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    /**
     * 语音合成主方法
     */
    async textToSpeech(request) {
        try {
            // 构建请求头
            const headers = this.buildHeaders();
            // 构建请求体
            const payload = {
                req_params: {
                    text: request.text,
                    model: 'seed-tts-1.1',
                    speaker: request.speaker ||
                        (await this.getRandomVoice('🔥热门推荐')).voice.id ||
                        'zh_male_beijingxiaoye_emo_v2_mars_bigtts',
                    additions: JSON.stringify({
                        disable_markdown_filter: true,
                        enable_language_detector: true,
                        enable_latex_tn: true,
                        disable_default_bit_rate: true,
                        max_length_to_filter_parenthesis: 0,
                        cache_config: {
                            text_type: 1,
                            use_cache: true,
                        },
                        post_process: {
                            pitch: request.pitch || 0,
                        },
                    }),
                    audio_params: {
                        format: 'mp3',
                        sample_rate: 32000,
                        speech_rate: request.speech_rate || 0,
                        loudness_rate: request.loudness_rate || 0,
                    },
                },
            };
            // 执行TTS请求
            const result = await this.executeTtsRequest(headers, payload);
            this.logger.info(`TTS合成完成，云存储URL: ${result.audio}`);
            return { ...result, text: request.text };
        }
        catch (error) {
            this.logger.error(`TTS合成失败: ${error.message}`, error.stack);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    /**
     * 构建请求头
     */
    buildHeaders() {
        return {
            'x-api-key': this.ttsConfig.apiKey,
            'X-Api-Resource-Id': this.ttsConfig.resourceId,
            Connection: 'keep-alive',
            'Content-Type': 'application/json',
        };
    }
    /**
     * 执行TTS请求
     */
    async executeTtsRequest(headers, payload) {
        try {
            this.logger.info('发送TTS请求到字节跳动API');
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(this.ttsUrl, payload, {
                headers,
                responseType: 'stream',
            }));
            // 获取日志ID
            const logId = response.headers['x-tt-logid'];
            this.logger.info(`请求日志ID: ${logId}`);
            // 处理流式响应
            return await this.processStreamResponse(response.data, logId);
        }
        catch (error) {
            this.logger.error(`TTS API请求失败: ${error.message}`);
            if (error.response) {
                this.logger.error('响应状态:', error.response.status);
                this.logger.error('响应头:', error.response.headers);
                this.logger.error('响应数据:', error.response.data);
            }
            throw new common_1.BadGatewayException(`TTS API请求失败: ${error.message}`);
        }
    }
    /**
     * 处理流式响应
     */
    async processStreamResponse(stream, logId) {
        return new Promise((resolve, reject) => {
            let audioData = Buffer.alloc(0);
            let totalAudioSize = 0;
            let hasError = false;
            let errorMessage = '';
            let buffer = ''; // 用于缓存不完整的数据
            stream.on('data', (chunk) => {
                try {
                    // 将新数据添加到缓冲区
                    buffer += chunk.toString();
                    // 按行分割数据
                    const lines = buffer.split('\n');
                    // 保留最后一个可能不完整的行
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        if (!line.trim())
                            continue;
                        const data = this.safeJsonParse(line);
                        if (!data) {
                            continue;
                        }
                        // 处理音频数据
                        if (data.code === 0 && data.data) {
                            const audioChunk = Buffer.from(data.data, 'base64');
                            audioData = Buffer.concat([audioData, audioChunk]);
                            totalAudioSize += audioChunk.length;
                            continue;
                        }
                        // 处理句子信息
                        if (data.code === 0 && data.sentence) {
                            continue;
                        }
                        // 处理完成信号
                        if (data.code === 20000000) {
                            this.logger.info('TTS合成完成');
                            break;
                        }
                        // 处理错误
                        if (data.code > 0) {
                            hasError = true;
                            errorMessage = data.message || `错误码: ${data.code}`;
                            this.logger.error(`TTS API错误: ${errorMessage}`);
                            break;
                        }
                    }
                }
                catch (parseError) {
                    this.logger.error(`解析响应数据失败: ${parseError.message}`);
                }
            });
            stream.on('end', async () => {
                this.logger.info(`流式响应结束，总音频大小: ${totalAudioSize} bytes`);
                // 处理缓冲区中剩余的数据
                if (buffer.trim()) {
                    this.logger.debug(`处理缓冲区剩余数据: ${buffer.substring(0, 100)}...`);
                    const data = this.safeJsonParse(buffer);
                    if (data) {
                        // 处理音频数据
                        if (data.code === 0 && data.data) {
                            const audioChunk = Buffer.from(data.data, 'base64');
                            audioData = Buffer.concat([audioData, audioChunk]);
                            totalAudioSize += audioChunk.length;
                            this.logger.debug(`收到缓冲区音频数据块，大小: ${audioChunk.length} bytes`);
                        }
                        // 处理完成信号
                        if (data.code === 20000000) {
                            this.logger.info('TTS合成完成（缓冲区）');
                        }
                        // 处理错误
                        if (data.code > 0) {
                            hasError = true;
                            errorMessage = data.message || `错误码: ${data.code}`;
                            this.logger.error(`TTS API错误（缓冲区）: ${errorMessage}`);
                        }
                    }
                }
                if (hasError) {
                    this.logger.error(`TTS处理过程中发生错误: ${errorMessage}`);
                    resolve({
                        success: false,
                        error: errorMessage,
                    });
                    return;
                }
                if (audioData.length === 0) {
                    this.logger.warn('未收到任何音频数据');
                    resolve({
                        success: false,
                        error: '未收到音频数据',
                    });
                    return;
                }
                this.logger.info(`准备上传音频数据到云存储，大小: ${audioData.length} bytes`);
                // 生成文件名
                const fileName = `tts_${Date.now()}_${logId || 'unknown'}.mp3`;
                const audioDuration = await this.getAudioDuration(audioData);
                // 直接上传到云存储
                this.uploadAudioToCloud(audioData, fileName)
                    .then((cloudResult) => {
                    if (cloudResult.success) {
                        this.logger.info('音频数据上传到云存储成功');
                        resolve({
                            success: true,
                            audio: cloudResult.cloudUrl,
                            duration: audioDuration,
                        });
                    }
                    else {
                        this.logger.error(`云存储上传失败: ${cloudResult.error}`);
                        resolve({
                            success: false,
                            error: cloudResult.error,
                        });
                    }
                })
                    .catch((error) => {
                    this.logger.error(`云存储上传异常: ${error.message}`);
                    resolve({
                        success: false,
                        error: error.message,
                    });
                });
            });
            stream.on('error', (error) => {
                this.logger.error(`流处理错误: ${error.message}`);
                reject(error);
            });
        });
    }
    /**
     * 获取音色列表
     */
    async getVoiceList() {
        const result = await this.voiceList();
        // 统计总的声音数量
        let totalVoices = 0;
        const voiceIds = new Set();
        result.forEach((category) => {
            category.groups.forEach((group) => {
                // 统计声音ID
                group.items.forEach((item) => {
                    voiceIds.add(item.id);
                    totalVoices++;
                });
            });
        });
        return result;
    }
    /**
     * 随机获取一个音色
     */
    async getRandomVoice(category, gender) {
        const voiceData = await this.voiceList();
        // 如果指定了分类，先过滤出该分类的数据
        let filteredData = voiceData;
        if (category) {
            filteredData = voiceData.filter((item) => item.Category === category);
            if (filteredData.length === 0) {
                throw new Error(`未找到分类 "${category}" 的音色数据`);
            }
        }
        // 收集所有可用的音色
        const allVoices = [];
        filteredData.forEach((categoryItem) => {
            categoryItem.groups.forEach((group) => {
                // 如果指定了性别，只收集该性别的音色
                if (gender && group.gender_type !== gender) {
                    return;
                }
                allVoices.push({
                    ...group,
                    category: categoryItem.Category,
                });
            });
        });
        if (allVoices.length === 0) {
            throw new Error('没有可用的音色数据');
        }
        // 随机选择一个性别分组
        const randomGroup = allVoices[Math.floor(Math.random() * allVoices.length)];
        // 从该分组中随机选择一个音色
        const randomVoice = randomGroup.items[Math.floor(Math.random() * randomGroup.items.length)];
        return {
            category: randomGroup.category,
            gender_title: randomGroup.gender_title,
            gender_type: randomGroup.gender_type,
            voice: randomVoice,
        };
    }
    /**
     * 获取音色列表（原始数据）
     */
    async voiceList() {
        const list = await this.volcengineApi({
            params: {
                Action: 'ListBigModelTTSTimbres',
                Version: '2025-05-20',
            },
            body: {},
            method: 'POST',
            Service: 'speech_saas_prod',
        }).then((res) => {
            return res.Result?.Timbres ?? [];
        });
        // 用于存储按分类和性别分组的数据
        const categoryMap = new Map();
        // 遍历所有声音数据
        list.forEach((speaker) => {
            const speakerId = speaker.SpeakerID;
            speaker.TimbreInfos.forEach((timbre) => {
                const gender = timbre.Gender;
                const speakerName = timbre.SpeakerName;
                // 检查是否包含"多语种"分类，如果有则跳过整个声音
                const hasMultiLanguage = timbre.Categories.some((categoryInfo) => categoryInfo.Category === '多语种');
                if (hasMultiLanguage) {
                    return; // 跳过包含"多语种"分类的声音
                }
                // 遍历每个声音的分类
                timbre.Categories.forEach((categoryInfo) => {
                    const category = categoryInfo.Category;
                    // 如果分类不存在，创建新的分类，并初始化男女两个性别分组
                    if (!categoryMap.has(category)) {
                        categoryMap.set(category, {
                            Category: category,
                            groups: [
                                {
                                    gender_title: '女声',
                                    gender_type: 'female',
                                    items: [],
                                },
                                {
                                    gender_title: '男声',
                                    gender_type: 'male',
                                    items: [],
                                },
                            ],
                        });
                    }
                    const categoryData = categoryMap.get(category);
                    // 根据性别找到对应的分组
                    const genderGroup = categoryData.groups.find((group) => (gender === '女' && group.gender_type === 'female') ||
                        (gender === '男' && group.gender_type === 'male'));
                    if (genderGroup) {
                        // 遍历情感信息，获取演示URL
                        timbre.Emotions.forEach((emotion) => {
                            // 检查是否已存在相同的声音项（避免重复）
                            const existingItem = genderGroup.items.find((item) => item.id === speakerId && item.voice_url === emotion.DemoURL);
                            if (!existingItem) {
                                genderGroup.items.push({
                                    id: speakerId,
                                    name: speakerName,
                                    voice_url: emotion.DemoURL,
                                    emotion: emotion.Emotion,
                                    emotion_type: emotion.EmotionType,
                                    demo_text: emotion.DemoText,
                                });
                            }
                        });
                    }
                });
            });
        });
        // 转换为数组格式
        const result = Array.from(categoryMap.values());
        // 创建热门分组
        const hotGroup = this.createHotGroup(list);
        // 将热门分组添加到结果数组的开头
        return [hotGroup, ...result];
    }
    /**
     * 创建热门分组
     */
    createHotGroup(list) {
        const hotItems = [];
        // 遍历所有声音数据，筛选出热门音色
        list.forEach((speaker) => {
            const speakerId = speaker.SpeakerID;
            speaker.TimbreInfos.forEach((timbre) => {
                const gender = timbre.Gender;
                const speakerName = timbre.SpeakerName;
                // 检查是否包含"多语种"分类，如果有则跳过
                const hasMultiLanguage = timbre.Categories.some((categoryInfo) => categoryInfo.Category === '多语种');
                if (hasMultiLanguage) {
                    return;
                }
                // 检查是否在热门列表中
                const isHot = hotList.includes(speakerId);
                if (!isHot) {
                    return;
                }
                // 遍历情感信息，获取演示URL
                timbre.Emotions.forEach((emotion) => {
                    // 检查是否已存在相同的声音项（避免重复）
                    const existingItem = hotItems.find((item) => item.id === speakerId && item.voice_url === emotion.DemoURL);
                    if (!existingItem) {
                        hotItems.push({
                            id: speakerId,
                            name: speakerName,
                            voice_url: emotion.DemoURL,
                            emotion: emotion.Emotion,
                            emotion_type: emotion.EmotionType,
                            demo_text: emotion.DemoText,
                            gender: gender === '女' ? 'female' : 'male',
                            gender_title: gender === '女' ? '女声' : '男声',
                        });
                    }
                });
            });
        });
        // 按照 hotList 的顺序排序热门音色
        const sortedHotItems = hotItems.sort((a, b) => {
            const indexA = hotList.indexOf(a.id);
            const indexB = hotList.indexOf(b.id);
            return indexA - indexB;
        });
        return {
            Category: '🔥热门推荐',
            groups: [
                {
                    gender_title: '热门音色',
                    gender_type: 'hot',
                    items: sortedHotItems,
                },
            ],
        };
    }
    /**
     * 调用火山引擎 API
     */
    async volcengineApi({ body = {}, params, method = 'POST', Service, }) {
        const baseUrl = 'https://open.volcengineapi.com';
        const openApiRequestData = {
            region: this.ttsConfig.region,
            method,
            params: params,
            headers: {},
            body: JSON.stringify(body),
        };
        const signer = new openapi_1.Signer(openApiRequestData, Service);
        // 签名
        signer.addAuthorization({
            accessKeyId: this.ttsConfig.accessKey,
            secretKey: this.ttsConfig.secretKey,
        });
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.request({
                url: baseUrl,
                headers: openApiRequestData.headers,
                params: openApiRequestData.params,
                method: openApiRequestData.method,
                data: body,
            }));
            return response.data;
        }
        catch (error) {
            this.logger.error(`火山引擎API调用失败: ${error.message}`);
            return undefined;
        }
    }
};
exports.VolcengineTtsClient = VolcengineTtsClient;
exports.VolcengineTtsClient = VolcengineTtsClient = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        axios_1.HttpService,
        file_storage_1.FileStorageService,
        winston_1.Logger])
], VolcengineTtsClient);
//# sourceMappingURL=volcengine-tts.client.js.map