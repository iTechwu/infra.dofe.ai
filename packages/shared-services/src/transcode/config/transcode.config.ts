import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getKeysConfig } from '@dofe/infra-common';
import {
    TranscodeConfig as ValidationTranscodeConfig,
    ZoneConfig,
    AppConfig,
} from '@dofe/infra-common';

// 新的转码配置接口，用于云服务转码
export interface CloudTranscodeConfig {
    timeout: number;
    maxRetries: number;
    defaultQuality: string;
    defaultFormat: string;
    defaultResolution: string;
    spriteOptions: {
        defaultWidth: number;
        defaultHeight: number;
        defaultInterval: number;
        defaultColumns: number;
        defaultLines: number;
    };
    snapshotOptions: {
        defaultWidth: number;
        defaultHeight: number;
        defaultFormat: string;
        defaultQuality: number;
    };
}

export const defaultCloudTranscodeConfig: CloudTranscodeConfig = {
    timeout: 30000, // 30秒
    maxRetries: 3,
    defaultQuality: 'medium',
    defaultFormat: 'mp4',
    defaultResolution: '720p',
    spriteOptions: {
        defaultWidth: 160,
        defaultHeight: 90,
        defaultInterval: 10,
        defaultColumns: 10,
        defaultLines: 10,
    },
    snapshotOptions: {
        defaultWidth: 1280,
        defaultHeight: 720,
        defaultFormat: 'jpg',
        defaultQuality: 90,
    },
};

@Injectable()
export class TranscodeConfigManager {
    // 已经废弃，使用云服务转码替代
    private transcodeConfig: ValidationTranscodeConfig;
    private cnZoneConfig: ZoneConfig;
    private appConfig: AppConfig;

    constructor(private readonly configService: ConfigService) {
        this.initializeConfig();
    }

    /**
     * 初始化配置
     */
    private initializeConfig(): void {
        // 获取转码配置
        this.transcodeConfig = getKeysConfig()
            ?.transcode as ValidationTranscodeConfig;

        // 获取应用配置
        this.appConfig = this.configService.getOrThrow<AppConfig>('app');

        // 获取中国区域配置
        this.cnZoneConfig = this.appConfig.zones.find(
            (zone) => zone.zone === 'cn',
        );

        if (!this.cnZoneConfig) {
            throw new Error('CN zone configuration not found');
        }
    }

    /**
     * 获取中国区域配置
     */
    getCnZoneConfig(): ZoneConfig {
        return this.cnZoneConfig;
    }

    /**
     * 获取应用配置
     */
    getAppConfig(): AppConfig {
        return this.appConfig;
    }

    /**
     * 获取区域配置列表
     */
    getAllZones(): ZoneConfig[] {
        return this.appConfig.zones;
    }

    /**
     * 根据区域名获取配置
     */
    getZoneConfig(zoneName: string): ZoneConfig | undefined {
        return this.appConfig.zones.find((zone) => zone.zone === zoneName);
    }

    /**
     * 检查是否为开发环境
     */
    isDevelopment(): boolean {
        return process.env.NODE_ENV === 'dev';
    }
}
