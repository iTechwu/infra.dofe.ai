/**
 * Feature Configuration Errors
 *
 * 当运行时使用未配置的功能时抛出的标准错误。
 * 启动期校验失败会在 dev 环境警告、prod 环境阻止启动。
 * 运行时使用未配置功能始终 throw 此错误。
 */
export class FeatureNotConfiguredError extends Error {
  readonly feature: string;
  readonly missingKey: string;

  constructor(feature: string, missingKey: string, message?: string) {
    super(
      message ??
        `功能 "${feature}" 未配置。缺少: ${missingKey}。` +
          `请在 keys/config.json 或 config.local.yaml 中添加配置，` +
          `或在 REQUIRED_FEATURES 中移除此功能声明。`,
    );
    this.feature = feature;
    this.missingKey = missingKey;
    this.name = 'FeatureNotConfiguredError';
  }
}
