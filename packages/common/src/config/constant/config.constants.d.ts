export declare const TRANSCODE_CONSTANTS: {
    readonly QUEUES: {
        readonly TRANSCODE: "transcode";
    };
    readonly SUFFIXES: {
        readonly SNAPSHOT: "_snapshot";
        readonly SPRITE: "_sprite_";
        readonly MP3: "";
        readonly E4K: "_4k";
        readonly E1080P: "_1080p";
        readonly E720P: "_720p";
        readonly E360P: "_360p";
        readonly HDR2SDR: ".hdr2sdr";
    };
    readonly TIMEOUTS: {
        readonly SIGNED_URL: 3600;
        readonly API_REQUEST: 30000;
    };
    readonly VIDEO: {
        readonly SPRITE_INTERVAL: 3;
        readonly DEFAULT_PRIORITY: 5;
        readonly MIN_DURATION: 0.1;
    };
    readonly API_PATHS: {
        readonly TEMPLATES: "/templates";
        readonly SCHEMA: "/schema";
        readonly TASKS: "/tasks";
        readonly INFO: "?info";
    };
    readonly SNAPSHOT_KEY: "video/snapshot,t_0";
    readonly EXTENSIONS: {
        readonly JPG: ".jpg";
        readonly MP4: ".mp4";
        readonly MP3: ".mp3";
        readonly WEBP: ".webp";
    };
    readonly ERROR_MESSAGES: {
        readonly INVALID_FILE: "Invalid file for transcoding";
        readonly BUCKET_NOT_SUPPORTED: "Bucket not supported for transcoding";
        readonly TEMPLATE_SCHEMA_FAILED: "Failed to get template schemas";
        readonly TASK_CREATION_FAILED: "Failed to create transcode task";
        readonly VIDEO_INFO_FAILED: "Failed to get video information";
    };
};
export declare const SUPPORTED_VIDEO_FORMATS: readonly ["mp4", "avi", "mov", "wmv", "flv", "webm", "mkv", "m4v", "3gp", "ogv"];
export declare const SUPPORTED_AUDIO_FORMATS: readonly ["mp3", "wav", "flac", "aac", "ogg", "wma", "m4a"];
export declare const SUPPORTED_IMAGE_FORMATS: readonly ["jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff", "svg"];
