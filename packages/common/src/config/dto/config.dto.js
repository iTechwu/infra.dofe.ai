"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoResolutionDto = exports.Locale = exports.DoFeApp = void 0;
// ============================================================================
// DoFeApp Namespace (保持向后兼容)
// ============================================================================
var DoFeApp;
(function (DoFeApp) {
    // ========================================================================
    // API Response DTOs (非配置相关)
    // ========================================================================
    class Task {
        task;
    }
    DoFeApp.Task = Task;
})(DoFeApp || (exports.DoFeApp = DoFeApp = {}));
// ============================================================================
// Enums (非配置相关)
// ============================================================================
var Locale;
(function (Locale) {
    Locale["English"] = "en";
    Locale["ChineseSimplified"] = "zh-CN";
})(Locale || (exports.Locale = Locale = {}));
var VideoResolutionDto;
(function (VideoResolutionDto) {
    VideoResolutionDto["HD"] = "1080p";
    VideoResolutionDto["SD"] = "720p";
    VideoResolutionDto["SSD"] = "360p";
    VideoResolutionDto["UHD"] = "4k";
})(VideoResolutionDto || (exports.VideoResolutionDto = VideoResolutionDto = {}));
//# sourceMappingURL=config.dto.js.map