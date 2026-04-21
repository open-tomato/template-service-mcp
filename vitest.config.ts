import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['../../packages/mcp/tests/bun-polyfill.ts'],
    exclude: ['**/node_modules/**', 'tests/tools.test.ts'],
  },
});
