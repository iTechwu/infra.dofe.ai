"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVideoFrameRate = exports.isHDR = void 0;
const isHDR = (ffmpegInfo) => {
    const hdrStandards = {
        colorPrimaries: ['bt2020', 'smpte2084', 'arib-std-b67'],
        colorTransfers: ['smpte2084', 'arib-std-b67'],
    };
    return ffmpegInfo.streams.some((stream) => hdrStandards.colorPrimaries.includes(stream.color_primaries) ||
        hdrStandards.colorTransfers.includes(stream.color_transfer));
};
exports.isHDR = isHDR;
const getVideoFrameRate = (ffmpegInfo) => {
    // 平均帧率
    let rFrameRate = ffmpegInfo?.streams[0]?.r_frame_rate;
    if (!rFrameRate) {
        rFrameRate = ffmpegInfo?.streams[0]?.frame_rate;
    }
    if (!rFrameRate) {
        const nbFrames = ffmpegInfo?.streams[0]?.nb_frames;
        const duration = ffmpegInfo?.format?.duration || ffmpegInfo?.streams[0]?.duration;
        if (nbFrames && duration) {
            rFrameRate =
                (parseInt(nbFrames) / parseFloat(duration)).toFixed(4) + ':1';
        }
    }
    return rFrameRate;
};
exports.getVideoFrameRate = getVideoFrameRate;
//# sourceMappingURL=ffmpeg.util.js.map