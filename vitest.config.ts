import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.spec.ts', 'packages/*/src/**/*.test.ts'],
  },
});
