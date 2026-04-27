/**
 * App Version Controller
 *
 * 提供版本检查 API 端点。
 *
 * **重要**: 此控制器使用 VERSION_NEUTRAL，不需要版本 header。
 * 前端应在启动时调用此 API 获取当前 API 版本，然后在后续请求中携带版本 header。
 */
import { AppVersionService, AppVersionInfo, VersionCheckResult } from './app-version.service';
export declare class AppVersionController {
    private readonly appVersionService;
    constructor(appVersionService: AppVersionService);
    /**
     * 获取服务端版本信息
     */
    getVersion(): AppVersionInfo;
    /**
     * 检查客户端版本兼容性
     */
    checkVersion(clientVersion?: string, buildVersion?: string): VersionCheckResult;
    /**
     * 简单的版本哈希检查 (轻量级)
     * 用于前端轮询检测
     */
    getBuildHash(): {
        hash: string;
        time: string;
    };
}
