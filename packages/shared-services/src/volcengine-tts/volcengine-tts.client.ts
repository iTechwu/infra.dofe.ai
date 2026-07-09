import { BadGatewayException, Injectable, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { YamlConfig } from "@dofe/infra-common";
import { HttpService } from "@nestjs/axios";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { firstValueFrom } from "rxjs";
import { TosClient } from "@volcengine/tos-sdk";
import { parseBuffer } from "music-metadata";
import { Signer } from "@volcengine/openapi";
import { getKeysConfig, initKeysConfig } from "@dofe/infra-common";
import { StorageCredentialsConfig, TtsConfig } from "@dofe/infra-common";
import { FeatureNotConfiguredError } from "@dofe/infra-common";
import { FileStorageService } from "../file-storage/file-storage.service";
import { TtsRequestDto, TtsResultDto, TtsResponseDto } from "./dto/tts.dto";
import { environmentUtil as environment } from "@dofe/infra-utils";
import {
  createTtsChunkReducerState,
  reduceTtsChunk,
} from "./tts-stream-reducer";
import { buildTtsPayload } from "./tts-payload";
import { readVolcengineHeader } from "../volcengine-speech/headers";

/**
 * Volcengine TTS服务
 * 基于字节跳动TTS API实现语音合成功能
 */

const hotList = [
  "ICL_zh_male_BV144_paoxiaoge_v1_tob",
  "zh_male_sunwukong_mars_bigtts",
  "zh_male_xionger_mars_bigtts",
  "zh_male_zhubajie_mars_bigtts",
];

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

/**
 * 显式配置注入路径的运行时依赖
 *
 * @description 通过 {@link VolcengineTtsClient.create} 创建独立实例时所需的最小依赖。
 * 不包含 ConfigService / FileStorageService —— 显式模式不读取 keys/config.json，
 * TOS 凭证直接由 {@link VolcengineTtsConfig.tos} 提供。
 */
export interface VolcengineTtsDeps {
  /** HTTP 客户端（调用火山 TTS API） */
  httpService: HttpService;
  /** Winston 日志记录器 */
  logger: Logger;
}

@Injectable()
export class VolcengineTtsClient {
  private ttsConfig!: VolcengineTtsConfig;
  private ttsUrl!: string;
  private tosClient: TosClient | null = null;
  private cloudUrl: string = "";

  /**
   * 构造函数（NestJS DI 路径）
   *
   * @description 从 `keys/config.json` 解析配置（fail-fast：缺失抛 FeatureNotConfiguredError），
   * 保持与历史行为一致，现有调用方零改动。需要多账号/多租户或 DB 驱动配置时，改用静态工厂
   * {@link VolcengineTtsClient.create} 注入显式 config。
   *
   * @param {ConfigService} configService - NestJS 配置服务
   * @param {HttpService} httpService - HTTP 客户端
   * @param {FileStorageService} fileApi - 文件存储服务（保留 DI 兼容，TTS 实际直连火山 TOS）
   * @param {Logger} logger - Winston 日志记录器
   */
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly fileApi: FileStorageService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.applyConfig(VolcengineTtsClient.resolveConfig(configService));
  }

  /**
   * 从 `keys/config.json` 解析火山 TTS 配置（含 TOS）
   *
   * @description fail-fast：tts.volcengine、storage.tos、buckets 任一缺失即抛错。
   * 供 DI 构造路径使用；外部服务（models.dofe.ai）应直接组装 {@link VolcengineTtsConfig}
   * 走 {@link VolcengineTtsClient.create}，不走此方法。
   *
   * @static
   * @param {ConfigService} configService - NestJS 配置服务（读取 buckets）
   * @returns {VolcengineTtsConfig} 解析后的 TTS 配置
   * @throws {FeatureNotConfiguredError|Error} 配置缺失时抛出
   */
  static resolveConfig(configService: ConfigService): VolcengineTtsConfig {
    const config = getKeysConfig()?.tts as TtsConfig | undefined;
    if (!config || !config.volcengine) {
      throw new FeatureNotConfiguredError("tts", "keys.tts");
    }

    const volcengineConfig = config.volcengine;
    const storageConfig = getKeysConfig()?.storage?.tos as
      | StorageCredentialsConfig
      | undefined;

    // Direct TOS access is a storage-client capability; SSO-only consumers do
    // not need buckets.
    const bucketConfigs =
      configService.get<YamlConfig["buckets"]>("buckets") ?? [];
    if (bucketConfigs.length === 0) {
      throw new FeatureNotConfiguredError("storage-client", "buckets");
    }

    const tosBucket = bucketConfigs.find(
      (b) => b.vendor === "tos" && b.bucket === volcengineConfig.bucket,
    );

    if (!tosBucket) {
      throw new Error(
        `TOS bucket "${volcengineConfig.bucket}" not found in storage-client buckets configuration`,
      );
    }

    if (!storageConfig?.accessKey || !storageConfig?.secretKey) {
      throw new Error("TOS storage credentials not found in keys/config.json");
    }

    return {
      endpoint:
        volcengineConfig.endpoint ||
        "https://openspeech.bytedance.com/api/v3/tts/unidirectional",
      apiKey: volcengineConfig.apiKey || "",
      resourceId: volcengineConfig.resourceId || "",
      region: volcengineConfig.region || "cn-shanghai",
      accessKey: volcengineConfig.accessKey || "",
      secretKey: volcengineConfig.secretKey || "",
      tos: {
        region: tosBucket.region || "cn-shanghai",
        endpoint: VolcengineTtsClient.extractTosEndpoint(
          tosBucket.tosEndpoint || tosBucket.endpoint,
        ),
        bucket: tosBucket.bucket,
        accessKeyId: storageConfig.accessKey,
        accessKeySecret: storageConfig.secretKey,
      },
    };
  }

  /**
   * 应用 TTS 配置（设置 ttsConfig / ttsUrl，校验并初始化 TOS 客户端）
   *
   * @protected
   * @param {VolcengineTtsConfig} config - 完整的 TTS 配置（含 TOS）
   */
  protected applyConfig(config: VolcengineTtsConfig): void {
    this.ttsConfig = config;
    this.ttsUrl = config.endpoint;
    this.validateConfiguration();
    this.initializeTOS();
  }

  /**
   * 按显式注入的配置创建独立 TTS 客户端实例（非 DI，支持多账号）
   *
   * @description 供 models.dofe.ai 从数据库 ProviderKey 解析出 endpoint / apiKey / resourceId /
   * region / accessKey / secretKey / tos 后注入。每次调用返回**独立实例**，不做单例缓存，避免多账号
   * 串扰；绕过 DI 构造路径，不读取 `keys/config.json`，也不依赖 ConfigService / FileStorageService。
   *
   * @static
   * @param {VolcengineTtsConfig} config - 显式注入的 TTS 配置（含 TOS）
   * @param {VolcengineTtsDeps} deps - 运行时依赖（HTTP 客户端 + 日志）
   * @returns {VolcengineTtsClient} 独立客户端实例（未缓存，由调用方持有）
   *
   * @example
   * ```typescript
   * const client = VolcengineTtsClient.create(
   *   { endpoint, apiKey, resourceId, region, accessKey, secretKey, tos },
   *   { httpService, logger },
   * );
   * const result = await client.textToSpeech({ text: '你好', speaker });
   * ```
   */
  static create(
    config: VolcengineTtsConfig,
    deps: VolcengineTtsDeps,
  ): VolcengineTtsClient {
    const instance = Object.create(
      VolcengineTtsClient.prototype,
    ) as VolcengineTtsClient;
    Object.assign(instance, {
      configService: undefined,
      httpService: deps.httpService,
      fileApi: undefined,
      logger: deps.logger,
    });
    instance.applyConfig(config);
    return instance;
  }

  /**
   * 从 endpoint URL 中提取 TOS endpoint 域名
   * 例如: https://tos-s3-cn-shanghai.volces.com -> tos-s3-cn-shanghai.volces.com
   */
  private static extractTosEndpoint(endpointUrl: string): string {
    if (!endpointUrl) {
      return "tos-cn-shanghai.volces.com";
    }
    // 移除协议前缀
    return endpointUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }

  /**
   * 初始化火山云TOS客户端
   */
  private initializeTOS(): void {
    if (!this.ttsConfig.tos) {
      this.logger.warn("火山云TOS配置未提供，云存储功能将无法使用");
      return;
    }

    try {
      const { region, endpoint, bucket, accessKeyId, accessKeySecret } =
        this.ttsConfig.tos;

      if (!accessKeyId || !accessKeySecret) {
        this.logger.warn("火山云TOS配置不完整，云存储功能可能无法使用");
        this.tosClient = null;
        return;
      }

      this.cloudUrl = `https://${bucket}.${endpoint}`;

      this.tosClient = new TosClient({
        region,
        endpoint,
        accessKeyId,
        accessKeySecret,
      });

      if (environment.isProduction()) {
        this.logger.info("VolcengineTtsClient module initialized TOS client", {
          region,
          endpoint,
          bucket,
          accessKeyId,
          accessKeySecret,
        });
      } else {
        this.logger.debug("VolcengineTtsClient module initialized TOS client", {
          region,
          endpoint,
          bucket,
          accessKeyId,
          accessKeySecret,
        });
      }
    } catch (error) {
      this.logger.error(
        `火山云TOS客户端初始化失败: ${(error as Error).message}`,
      );
      this.tosClient = null;
    }
  }

  /**
   * 验证配置信息
   */
  private validateConfiguration(): void {
    const missingVars = [];

    if (!this.ttsConfig.apiKey) {
      missingVars.push("apiKey");
    }

    if (!this.ttsConfig.resourceId) {
      missingVars.push("resourceId");
    }

    if (missingVars.length > 0) {
      this.logger.warn(`缺少TTS配置项: ${missingVars.join(", ")}`);
      this.logger.warn("TTS服务可能无法正常工作，请检查配置文件");
    } else {
      if (environment.isProduction()) {
        this.logger.info("TTS configuration validated successfully");
      }
    }
  }

  /**
   * 安全解析JSON数据
   */
  private safeJsonParse(jsonString: string): TtsResponseDto | null {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      this.logger.debug(
        `JSON解析失败: ${(error as Error).message}, 数据: ${jsonString.substring(0, 50)}...`,
      );
      return null;
    }
  }

  /**
   * 获取音频时长（毫秒）
   */
  private async getAudioDuration(audioData: Buffer): Promise<number> {
    try {
      const metadata = await parseBuffer(audioData, {
        mimeType: "audio/mpeg",
      });
      return (metadata.format.duration || 0) * 1000; // 转换为毫秒
    } catch (error) {
      this.logger.warn(`获取音频时长失败: ${(error as Error).message}`);
      return 0;
    }
  }

  /**
   * 直接上传音频数据到火山云TOS
   */
  async uploadAudioToCloud(
    audioData: Buffer,
    fileName: string,
  ): Promise<{
    success: boolean;
    cloudUrl?: string;
    s3Uri?: string;
    duration?: number;
    error?: string;
  }> {
    try {
      this.logger.info(`开始上传音频数据到火山云TOS: ${fileName}`);
      if (!this.tosClient || !this.ttsConfig.tos) {
        throw new Error("火山云TOS客户端未初始化");
      }

      // 生成TOS对象键
      const objectKey = `tts/${Date.now()}/${fileName}`;

      // 上传到火山云TOS
      await this.tosClient.putObject({
        bucket: this.ttsConfig.tos.bucket,
        key: objectKey,
        body: audioData,
        contentType: "audio/mpeg",
      });

      return {
        success: true,
        cloudUrl: `${this.cloudUrl}/${objectKey}`,
        s3Uri: `tos://${this.ttsConfig.tos.bucket}/${objectKey}`,
      };
    } catch (error) {
      this.logger.error(
        `上传音频数据到火山云TOS失败: ${(error as Error).message}`,
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 语音合成主方法
   */
  async textToSpeech(request: TtsRequestDto): Promise<TtsResultDto> {
    try {
      // 构建请求头
      const headers = this.buildHeaders();

      // 解析 speaker（默认走音色列表随机选取，依赖 OpenAPI，保留在 client 内）
      const speaker =
        request.speaker ||
        (await this.getRandomVoice("🔥热门推荐")).voice.id ||
        "zh_male_beijingxiaoye_emo_v2_mars_bigtts";
      // 构建请求体（委托到纯函数 buildTtsPayload，便于无密钥 smoke 验证请求契约）
      const payload = buildTtsPayload(request, speaker);

      // 执行TTS请求
      const result = await this.executeTtsRequest(headers, payload);

      this.logger.info(`TTS合成完成，云存储URL: ${result.audio}`);
      return { ...result, text: request.text };
    } catch (error) {
      this.logger.error(
        `TTS合成失败: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 构建请求头
   */
  private buildHeaders(): Record<string, string> {
    return {
      "x-api-key": this.ttsConfig.apiKey,
      "X-Api-Resource-Id": this.ttsConfig.resourceId,
      Connection: "keep-alive",
      "Content-Type": "application/json",
    };
  }

  /**
   * 执行TTS请求
   */
  private async executeTtsRequest(
    headers: Record<string, string>,
    payload: any,
  ): Promise<TtsResultDto> {
    try {
      this.logger.info("发送TTS请求到字节跳动API");

      const response = await firstValueFrom(
        this.httpService.post(this.ttsUrl, payload, {
          headers,
          responseType: "stream",
        }),
      );

      // 获取日志ID（委托到共享 readVolcengineHeader，大小写不敏感 + 兼容 AxiosHeaders）
      const logId = readVolcengineHeader(response.headers, "x-tt-logid");
      this.logger.info(`请求日志ID: ${logId}`);

      // 处理流式响应
      return await this.processStreamResponse(response.data, logId);
    } catch (error: any) {
      this.logger.error(`TTS API请求失败: ${error.message}`);
      if (error.response) {
        this.logger.error("响应状态:", error.response.status);
        this.logger.error("响应头:", error.response.headers);
        this.logger.error("响应数据:", error.response.data);
      }
      throw new BadGatewayException(`TTS API请求失败: ${error.message}`);
    }
  }

  /**
   * 处理流式响应
   *
   * @description 行缓冲与 TOS/日志逻辑保留在本方法；每行 JSON 的协议分支归约委托到纯函数
   * {@link reduceTtsChunk}（见 tts-stream-reducer），可在无密钥环境下 smoke 验证。
   */
  private async processStreamResponse(
    stream: any,
    logId: string | undefined,
  ): Promise<TtsResultDto> {
    return new Promise((resolve, reject) => {
      const state = createTtsChunkReducerState();
      let buffer = ""; // 用于缓存不完整的数据

      stream.on("data", (chunk: Buffer) => {
        try {
          // 将新数据添加到缓冲区
          buffer += chunk.toString();

          // 按行分割数据
          const lines = buffer.split("\n");

          // 保留最后一个可能不完整的行
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            const data = this.safeJsonParse(line);
            if (!data) {
              continue;
            }

            reduceTtsChunk(state, data);

            if (state.completed) {
              this.logger.info("TTS合成完成");
              break;
            }

            if (state.error) {
              this.logger.error(`TTS API错误: ${state.error}`);
              break;
            }
          }
        } catch (parseError) {
          this.logger.error(
            `解析响应数据失败: ${(parseError as Error).message}`,
          );
        }
      });

      stream.on("end", async () => {
        this.logger.info(
          `流式响应结束，总音频大小: ${state.audioBuffer.length} bytes`,
        );

        // 处理缓冲区中剩余的数据
        if (buffer.trim()) {
          this.logger.debug(
            `处理缓冲区剩余数据: ${buffer.substring(0, 100)}...`,
          );
          const data = this.safeJsonParse(buffer);
          if (data) {
            const previousError = state.error;
            reduceTtsChunk(state, data);
            if (state.completed) {
              this.logger.info("TTS合成完成（缓冲区）");
            }
            if (state.error && state.error !== previousError) {
              this.logger.error(`TTS API错误（缓冲区）: ${state.error}`);
            }
          }
        }

        if (state.error) {
          this.logger.error(`TTS处理过程中发生错误: ${state.error}`);
          resolve({
            success: false,
            error: state.error,
          });
          return;
        }

        if (state.audioBuffer.length === 0) {
          this.logger.warn("未收到任何音频数据");
          resolve({
            success: false,
            error: "未收到音频数据",
          });
          return;
        }

        const audioData = state.audioBuffer;
        this.logger.info(
          `准备上传音频数据到云存储，大小: ${audioData.length} bytes`,
        );

        // 生成文件名
        const fileName = `tts_${Date.now()}_${logId || "unknown"}.mp3`;

        const audioDuration = await this.getAudioDuration(audioData);

        // 直接上传到云存储
        this.uploadAudioToCloud(audioData, fileName)
          .then((cloudResult) => {
            if (cloudResult.success) {
              this.logger.info("音频数据上传到云存储成功");
              resolve({
                success: true,
                audio: cloudResult.cloudUrl,
                duration: audioDuration,
              });
            } else {
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

      stream.on("error", (error: Error) => {
        this.logger.error(`流处理错误: ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * 获取音色列表
   */
  async getVoiceList(): Promise<any> {
    const result = await this.voiceList();

    // 统计总的声音数量
    let totalVoices = 0;
    const voiceIds = new Set();

    result.forEach((category: any) => {
      category.groups.forEach((group: any) => {
        // 统计声音ID
        group.items.forEach((item: any) => {
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
  async getRandomVoice(
    category?: string,
    gender?: "female" | "male",
  ): Promise<any> {
    const voiceData = await this.voiceList();

    // 如果指定了分类，先过滤出该分类的数据
    let filteredData = voiceData;
    if (category) {
      filteredData = voiceData.filter(
        (item: any) => item.Category === category,
      );
      if (filteredData.length === 0) {
        throw new Error(`未找到分类 "${category}" 的音色数据`);
      }
    }

    // 收集所有可用的音色
    const allVoices: any[] = [];
    filteredData.forEach((categoryItem: any) => {
      categoryItem.groups.forEach((group: any) => {
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
      throw new Error("没有可用的音色数据");
    }

    // 随机选择一个性别分组
    const randomGroup = allVoices[Math.floor(Math.random() * allVoices.length)];

    // 从该分组中随机选择一个音色
    const randomVoice =
      randomGroup.items[Math.floor(Math.random() * randomGroup.items.length)];

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
  async voiceList(): Promise<any> {
    const list = await this.volcengineApi({
      params: {
        Action: "ListBigModelTTSTimbres",
        Version: "2025-05-20",
      },
      body: {},
      method: "POST",
      Service: "speech_saas_prod",
    }).then((res) => {
      return res.Result?.Timbres ?? [];
    });

    // 用于存储按分类和性别分组的数据
    const categoryMap = new Map();

    // 遍历所有声音数据
    list.forEach((speaker: any) => {
      const speakerId = speaker.SpeakerID;

      speaker.TimbreInfos.forEach((timbre: any) => {
        const gender = timbre.Gender;
        const speakerName = timbre.SpeakerName;

        // 检查是否包含"多语种"分类，如果有则跳过整个声音
        const hasMultiLanguage = timbre.Categories.some(
          (categoryInfo: any) => categoryInfo.Category === "多语种",
        );

        if (hasMultiLanguage) {
          return; // 跳过包含"多语种"分类的声音
        }

        // 遍历每个声音的分类
        timbre.Categories.forEach((categoryInfo: any) => {
          const category = categoryInfo.Category;

          // 如果分类不存在，创建新的分类，并初始化男女两个性别分组
          if (!categoryMap.has(category)) {
            categoryMap.set(category, {
              Category: category,
              groups: [
                {
                  gender_title: "女声",
                  gender_type: "female",
                  items: [],
                },
                {
                  gender_title: "男声",
                  gender_type: "male",
                  items: [],
                },
              ],
            });
          }

          const categoryData = categoryMap.get(category);

          // 根据性别找到对应的分组
          const genderGroup = categoryData.groups.find(
            (group: any) =>
              (gender === "女" && group.gender_type === "female") ||
              (gender === "男" && group.gender_type === "male"),
          );

          if (genderGroup) {
            // 遍历情感信息，获取演示URL
            timbre.Emotions.forEach((emotion: any) => {
              // 检查是否已存在相同的声音项（避免重复）
              const existingItem = genderGroup.items.find(
                (item: any) =>
                  item.id === speakerId && item.voice_url === emotion.DemoURL,
              );

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
  private createHotGroup(list: any[]): any {
    const hotItems: any[] = [];

    // 遍历所有声音数据，筛选出热门音色
    list.forEach((speaker: any) => {
      const speakerId = speaker.SpeakerID;

      speaker.TimbreInfos.forEach((timbre: any) => {
        const gender = timbre.Gender;
        const speakerName = timbre.SpeakerName;

        // 检查是否包含"多语种"分类，如果有则跳过
        const hasMultiLanguage = timbre.Categories.some(
          (categoryInfo: any) => categoryInfo.Category === "多语种",
        );

        if (hasMultiLanguage) {
          return;
        }

        // 检查是否在热门列表中
        const isHot = hotList.includes(speakerId);
        if (!isHot) {
          return;
        }

        // 遍历情感信息，获取演示URL
        timbre.Emotions.forEach((emotion: any) => {
          // 检查是否已存在相同的声音项（避免重复）
          const existingItem = hotItems.find(
            (item: any) =>
              item.id === speakerId && item.voice_url === emotion.DemoURL,
          );

          if (!existingItem) {
            hotItems.push({
              id: speakerId,
              name: speakerName,
              voice_url: emotion.DemoURL,
              emotion: emotion.Emotion,
              emotion_type: emotion.EmotionType,
              demo_text: emotion.DemoText,
              gender: gender === "女" ? "female" : "male",
              gender_title: gender === "女" ? "女声" : "男声",
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
      Category: "🔥热门推荐",
      groups: [
        {
          gender_title: "热门音色",
          gender_type: "hot",
          items: sortedHotItems,
        },
      ],
    };
  }

  /**
   * 调用火山引擎 API
   */
  async volcengineApi({
    body = {},
    params,
    method = "POST",
    Service,
  }: {
    params: any;
    body?: any;
    method?: "POST" | "GET" | "PUT" | "DELETE" | "PATCH";
    Service: string;
  }) {
    const baseUrl = "https://open.volcengineapi.com";
    const openApiRequestData = {
      region: this.ttsConfig.region,
      method,
      params: params,
      headers: {},
      body: JSON.stringify(body),
    };

    const signer = new Signer(openApiRequestData, Service);

    // 签名
    signer.addAuthorization({
      accessKeyId: this.ttsConfig.accessKey,
      secretKey: this.ttsConfig.secretKey,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          url: baseUrl,
          headers: openApiRequestData.headers,
          params: openApiRequestData.params,
          method: openApiRequestData.method,
          data: body,
        }),
      );
      return response.data;
    } catch (error: unknown) {
      this.logger.error(
        `火山引擎API调用失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }
}
