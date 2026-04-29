// Truly independent clients - no agents-specific imports, no Prisma schema types
export * from './plugin';
export * from './internal/ai-provider';
export * from './internal/channel-verify';
export * from './internal/health-check';
export * from './internal/ocr';
export * from './internal/third-party-sse';
export * from './internal/wechat';

// Clients excluded (have agents-specific imports, Prisma schema types, or dependency issues):
// - ai: has @/config imports
// - agentx: has @/config imports
// - complexity-classifier: has @/config imports
// - crypt: has @/config imports
// - email: has @repo/contracts/errors, @/config imports, Prisma types
// - exchange-rate: has @/config imports
// - file-cdn: has @app/redis, @/config imports, Prisma FileBucketVendor
// - file-storage: has @app/redis, @repo/contracts/errors, @/config imports, Prisma FileBucketVendor
// - feishu: requires @larksuiteoapi/node-sdk
// - ip-info: has @/config imports
// - mlflow: has @/config imports
// - model-research-proxy: has @/config imports
// - model-verify: has Prisma ModelType
// - openclaw: requires @app/docker
// - openspeech: has @/config imports, Prisma FileBucketVendor/FileSource
// - provider-verify: has @repo/contracts issues
// - routing-llm: has @/config imports
// - sms: has @/config imports
// - sse: has @/config imports
// - transcode: has Prisma VideoInfo/AudioInfo/ImageInfo types
// - verify: has @/config imports
// - volcengine-tts: has @/config imports