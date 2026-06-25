/**
 * ESLint configuration for NestJS projects
 * Usage: import and spread in your eslint config
 */
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";

const nestjsConfig = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettier,
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      parserOptions: {
        project: "./tsconfig.json",
      },
      globals: {
        node: true,
        jest: true,
      },
    },
    rules: {
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-require-imports": "off",
      "prettier/prettier": [
        "error",
        {
          semi: true,
          trailingComma: "all",
          singleQuote: true,
          printWidth: 100,
          tabWidth: 2,
        },
      ],
      /**
       * 禁止在 index.ts 中重导出 Module 类
       * 这是 Barrel Export 陷阱的核心规则
       *
       * ✅ 允许：导出类型、服务、常量
       * ❌ 禁止：export * from './xxx.module'
       *
       * 原因：
       * - 重导出 Module 会导致隐式依赖传递
       * - 导入一个包会意外加载所有子模块
       * - 破坏模块边界，增加启动时间
       */
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportAllDeclaration[source.value=/\\.module['\"]?$/]",
          message: "🚫 禁止重导出 Module 类。请使用显式导入：import { XxxModule } from '@dofe/infra-xxx/xxx-module'",
        },
      ],
    },
  },
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "*.js",
      "*.mjs",
      "coverage/**",
      ".turbo/**",
    ],
  }
);

export default nestjsConfig;
