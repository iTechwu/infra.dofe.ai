"use strict";
/**
 * @fileoverview 存储桶解析器
 *
 * 本文件实现了存储桶的智能解析功能，负责：
 * - 根据 IP 地址进行区域感知的存储桶选择
 * - 根据公开/私有属性选择合适的存储桶
 * - 验证存储桶配置的有效性
 *
 * @module file-storage/bucket-resolver
 */
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
exports.BucketResolver = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const ip_geo_1 = require("../ip-geo");
const array_util_1 = __importDefault(require("../../../utils/dist/array.util"));
const enviroment_util_1 = __importDefault(require("../../../utils/dist/enviroment.util"));
/**
 * 存储桶解析器
 *
 * @description 负责根据各种条件智能解析存储桶配置。
 *
 * 解析优先级：
 * 1. 如果明确指定了 bucket，验证并使用
 * 2. 根据 IP 地址推断区域（大洲）
 * 3. 根据 isPublic 属性过滤
 * 4. 选择默认存储桶
 *
 * @class BucketResolver
 *
 * @example
 * ```typescript
 * @Injectable()
 * class MyService {
 *   constructor(private readonly resolver: BucketResolver) {}
 *
 *   async getBucket(ip: string) {
 *     const result = await this.resolver.resolve({
 *       ip,
 *       isPublic: false,
 *     });
 *     console.log('Resolved bucket:', result.bucket);
 *   }
 * }
 * ```
 */
let BucketResolver = class BucketResolver {
    configService;
    ipGeoService;
    logger;
    /**
     * 存储桶配置列表
     * @private
     */
    bucketConfigs;
    /**
     * 应用配置
     * @private
     */
    appConfig;
    /**
     * 默认存储供应商
     * @private
     */
    defaultVendor;
    /**
     * 构造函数
     *
     * @param {ConfigService} configService - NestJS 配置服务
     * @param {IpGeoService} ipGeoService - IP 地理位置服务（infra 层）
     * @param {Logger} logger - Winston 日志记录器
     */
    constructor(configService, ipGeoService, logger) {
        this.configService = configService;
        this.ipGeoService = ipGeoService;
        this.logger = logger;
        this.bucketConfigs =
            configService.getOrThrow('buckets');
        this.appConfig = configService.getOrThrow('app');
        this.defaultVendor = this.appConfig.defaultVendor;
    }
    /**
     * 解析存储桶
     *
     * @description 根据提供的选项智能解析出最合适的存储桶配置。
     *
     * @param {BucketLookupOptions} options - 查询选项
     * @returns {Promise<BucketResolveResult>} 解析结果
     *
     * @example
     * ```typescript
     * // 根据 IP 解析
     * const result = await resolver.resolve({ ip: '8.8.8.8' });
     *
     * // 指定公开存储桶
     * const result = await resolver.resolve({ isPublic: true });
     *
     * // 明确指定存储桶
     * const result = await resolver.resolve({
     *   vendor: 'oss',
     *   bucket: 'my-bucket',
     * });
     * ```
     */
    async resolve(options = {}) {
        const { bucket, ip, isPublic, locale, vendor } = options;
        // 确定供应商
        const finalVendor = vendor ?? this.defaultVendor;
        // 如果明确指定了 bucket，验证并返回
        if (bucket) {
            if (this.validateBucket(finalVendor, bucket)) {
                const config = this.findBucketConfig(finalVendor, bucket);
                return { bucket, vendor: finalVendor, config };
            }
            // bucket 无效，继续使用默认逻辑
            this.logger.warn('Invalid bucket specified, falling back to default', {
                bucket,
                vendor: finalVendor,
            });
        }
        // 解析默认存储桶
        const defaultBucket = await this.resolveDefaultBucket(isPublic, ip, locale);
        const resolvedVendor = this.getVendorForBucket(defaultBucket) ?? finalVendor;
        const config = this.findBucketConfig(resolvedVendor, defaultBucket);
        return {
            bucket: defaultBucket,
            vendor: resolvedVendor,
            config,
        };
    }
    /**
     * 解析默认存储桶
     *
     * @description 根据公开属性、IP 和区域设置选择默认存储桶。
     *
     * @param {boolean} [isPublic] - 是否公开存储桶
     * @param {string} [ip] - 客户端 IP 地址
     * @param {string} [locale] - 区域设置
     * @returns {Promise<string>} 默认存储桶名称
     */
    async resolveDefaultBucket(isPublic, ip, locale) {
        // 确定区域
        let zone = enviroment_util_1.default.getBaseZone();
        if (ip) {
            const continent = await this.ipGeoService.getContinent(ip);
            zone = continent ?? zone;
        }
        locale = locale ?? zone;
        // 确定公开属性
        const finalIsPublic = isPublic ?? this.appConfig.defaultBucketPublic;
        // 过滤存储桶
        let buckets = array_util_1.default.filter(this.bucketConfigs, { isPublic: finalIsPublic }, this.appConfig.defaultBucketPublic);
        buckets = array_util_1.default.filter(buckets, { locale: locale }, zone);
        // 查找默认存储桶
        const bucketConfig = array_util_1.default.findOne(buckets, { isDefault: true }, false);
        if (bucketConfig?.bucket) {
            return bucketConfig.bucket;
        }
        // 回退到区域配置的默认存储桶
        const zoneConfig = this.appConfig.zones?.find((z) => z.zone === zone);
        return finalIsPublic
            ? (zoneConfig?.defaultPublicBucket ?? '')
            : (zoneConfig?.defaultPrivateBucket ?? '');
    }
    /**
     * 验证存储桶是否有效
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @returns {boolean} 是否有效
     */
    validateBucket(vendor, bucket) {
        return this.bucketConfigs.some((config) => config.bucket === bucket &&
            (config.vendor ?? this.defaultVendor) === vendor);
    }
    /**
     * 根据存储桶名称获取供应商
     *
     * @param {string} bucket - 存储桶名称
     * @returns {FileBucketVendor | undefined} 供应商或 undefined
     */
    getVendorForBucket(bucket) {
        const config = this.bucketConfigs.find((c) => c.bucket === bucket);
        return config?.vendor ?? this.defaultVendor;
    }
    /**
     * 查找存储桶配置
     *
     * @param {FileBucketVendor} vendor - 存储供应商
     * @param {string} bucket - 存储桶名称
     * @returns {DoFeUploader.Config | undefined} 配置或 undefined
     */
    findBucketConfig(vendor, bucket) {
        return this.bucketConfigs.find((config) => config.bucket === bucket &&
            (config.vendor ?? this.defaultVendor) === vendor);
    }
    /**
     * 获取所有存储桶配置
     *
     * @returns {DoFeUploader.Config[]} 配置列表
     */
    getAllConfigs() {
        return [...this.bucketConfigs];
    }
    /**
     * 根据属性过滤存储桶
     *
     * @param {Partial<DoFeUploader.Config>} filter - 过滤条件
     * @returns {DoFeUploader.Config[]} 匹配的配置列表
     */
    filterBuckets(filter) {
        return this.bucketConfigs.filter((config) => {
            for (const [key, value] of Object.entries(filter)) {
                if (config[key] !== value) {
                    return false;
                }
            }
            return true;
        });
    }
    /**
     * 生成新的文件键
     *
     * @description 根据根路径和扩展名生成唯一的文件键。
     *
     * @param {string} root - 根路径
     * @param {string} ext - 文件扩展名
     * @param {string} [bucket] - 存储桶名称
     * @returns {string} 生成的文件键
     *
     * @example
     * ```typescript
     * const key = resolver.generateFileKey('uploads', 'jpg', 'my-bucket');
     * // 返回: "my-bucket/dev/uploads/1704067200000-abc123.jpg"
     * ```
     */
    generateFileKey(root, ext, bucket) {
        const prefix = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        const env = enviroment_util_1.default.getEnv();
        if (bucket) {
            return `${bucket}/${env}/${root}/${prefix}.${ext}`;
        }
        return `${env}/${root}/${prefix}.${ext}`;
    }
};
exports.BucketResolver = BucketResolver;
exports.BucketResolver = BucketResolver = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        ip_geo_1.IpGeoService,
        winston_1.Logger])
], BucketResolver);
//# sourceMappingURL=bucket-resolver.js.map