// i18n resources are loaded at runtime by nestjs-i18n
declare const __dirname: string;

/**
 * nestjs-i18n loader 根目录（包含语言子目录 en/、zh-CN/）。
 * 基于运行时 __dirname 指向包 dist 目录：在 webpack external 模式下本模块
 * 不经 webpack 转译、由 Node 原生加载，__dirname 为真实绝对路径，agents 可
 * 确定性获取资源目录用于 fs 加载（无需依赖行为不确定的 require.resolve）。
 */
export const i18nLoaderPath = __dirname;

export const i18nPaths = {
  en: __dirname + '/en',
  'zh-CN': __dirname + '/zh-CN',
  plaza: __dirname + '/plaza',
} as const;