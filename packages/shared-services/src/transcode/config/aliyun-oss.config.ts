export interface AliyunOssConfig {
    endpoint: string;
    accessKeyId: string;
    accessKeySecret: string;
    defaultBucket?: string;
}

export interface AliyunOssTranscodeConfig {
    endpoint: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    region?: string;
}
