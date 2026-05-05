// i18n resources are loaded at runtime by nestjs-i18n
declare const __dirname: string;

export const i18nPaths = {
  en: __dirname + '/en',
  'zh-CN': __dirname + '/zh-CN',
  plaza: __dirname + '/plaza',
} as const;