/**
 * Root ESLint flat config for infra.dofe.ai
 *
 * This monorepo is NestJS/Node-based. We use the shared NestJS config
 * from packages/config/eslint.nestjs.config.mjs.
 *
 * @see packages/config/eslint.nestjs.config.mjs
 */
import nestjsConfig from './packages/config/eslint.nestjs.config.mjs';

export default [
  ...nestjsConfig,
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/_dist_tmp/**',
      '**/*.js',
      '**/*.mjs',
      'packages/config/**',
      'packages/prisma-crud-generator/**',
    ],
  },
];
