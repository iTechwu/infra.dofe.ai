// i18n resources are loaded at runtime by nestjs-i18n
// This file exists to satisfy TypeScript compilation
export const i18nPaths = {
  en: __dirname + '/en',
  'zh-CN': __dirname + '/zh-CN',
} as const;
